#!/usr/bin/env node

/**
 * MCP Bridge - RESTful Proxy for Model Context Protocol Servers
 * A lightweight, LLM-agnostic proxy that connects to multiple MCP servers
 * and exposes their capabilities through a unified REST API.
 */

// Import dependencies
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const http = require('http');
const https = require('https');

// Configure axios with better connection management
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveMsecs: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveMsecs: 30000
});

// Set default axios configuration
axios.defaults.httpAgent = httpAgent;
axios.defaults.httpsAgent = httpsAgent;
axios.defaults.timeout = 60000; // 60 second default timeout for better reliability

// Load environment variables
require('dotenv').config();

// Risk level constants
const RISK_LEVEL = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

// Risk level descriptions
const RISK_LEVEL_DESCRIPTION = {
  [RISK_LEVEL.LOW]: "Low risk - Standard execution",
  [RISK_LEVEL.MEDIUM]: "Medium risk - Requires confirmation",
  [RISK_LEVEL.HIGH]: "High risk - Docker execution required"
};

console.log('Starting MCP Bridge...');

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression()); // Enable gzip compression for large responses
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON limit for large collections
app.use(morgan('dev'));

console.log('Middleware configured');

// Server state
const serverProcesses = new Map(); // Map of server IDs to processes
const pendingConfirmations = new Map(); // Map of request IDs to pending confirmations
const serverInitializationState = new Map(); // Track initialization state of servers

// Persistent config helpers
const configPath = process.env.MCP_CONFIG_PATH || path.join(process.cwd(), 'mcp_config.json');
function readFullConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    }
    return { mcpServers: {} };
  } catch (e) {
    console.error('Error reading mcp_config.json:', e);
    throw new Error('Failed to read config file');
  }
}
function writeFullConfig(configObj) {
  try {
    const json = JSON.stringify(configObj, null, 2);
    fs.writeFileSync(configPath, json, 'utf8');
  } catch (e) {
    console.error('Error writing mcp_config.json:', e);
    throw new Error('Failed to write config file');
  }
}

// Helper function to substitute environment variables in strings
function substituteEnvVars(text) {
  if (typeof text !== 'string') return text;
  
  return text.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    const value = process.env[envVar];
    if (value === undefined) {
      console.warn(`Warning: Environment variable ${envVar} is not set, keeping placeholder`);
      return match;
    }
    return value;
  });
}

// Helper function to recursively substitute environment variables in config objects
function substituteEnvVarsInConfig(obj) {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(substituteEnvVarsInConfig);
  } else if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsInConfig(value);
    }
    return result;
  }
  return obj;
}

// Helper function to load server configuration from file or environment
function loadServerConfig() {
  console.log('Loading server configuration...');
  let config = {};
  
  // Try to load from config file
  const configPath = process.env.MCP_CONFIG_PATH || path.join(process.cwd(), 'mcp_config.json');
  console.log(`Checking for config file at: ${configPath}`);
  
  try {
    if (fs.existsSync(configPath)) {
      const configFile = fs.readFileSync(configPath, 'utf8');
      let parsedConfig = JSON.parse(configFile);
      
      // Substitute environment variables in the config
      parsedConfig = substituteEnvVarsInConfig(parsedConfig);
      
      config = parsedConfig.mcpServers || {};
      console.log(`Loaded configuration from ${configPath}:`, Object.keys(config));
      
      // For backward compatibility, validate risk levels if present
      for (const [serverId, serverConfig] of Object.entries(config)) {
        if (serverConfig.riskLevel !== undefined) {
          if (![RISK_LEVEL.LOW, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH].includes(serverConfig.riskLevel)) {
            console.warn(`Warning: Invalid risk level ${serverConfig.riskLevel} for server ${serverId}, ignoring risk level`);
            delete serverConfig.riskLevel;
          } else if (serverConfig.riskLevel === RISK_LEVEL.HIGH && (!serverConfig.docker || !serverConfig.docker.image)) {
            console.warn(`Warning: Server ${serverId} has HIGH risk level but no docker configuration, downgrading to MEDIUM risk level`);
            serverConfig.riskLevel = RISK_LEVEL.MEDIUM;
          }
        }
      }
    } else {
      console.log(`No configuration file found at ${configPath}, using defaults or environment variables`);
    }
  } catch (error) {
    console.error(`Error loading configuration file: ${error.message}`);
  }
  
  // Allow environment variables to override config
  // Format: MCP_SERVER_NAME_COMMAND, MCP_SERVER_NAME_ARGS (comma-separated)
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('MCP_SERVER_') && key.endsWith('_COMMAND')) {
      const serverName = key.replace('MCP_SERVER_', '').replace('_COMMAND', '').toLowerCase();
      const command = process.env[key];
      const argsKey = `MCP_SERVER_${serverName.toUpperCase()}_ARGS`;
      const args = process.env[argsKey] ? process.env[argsKey].split(',') : [];
      
      // Create or update server config
      config[serverName] = {
        command,
        args
      };
      
      // Check for environment variables
      const envKey = `MCP_SERVER_${serverName.toUpperCase()}_ENV`;
      if (process.env[envKey]) {
        try {
          config[serverName].env = JSON.parse(process.env[envKey]);
        } catch (error) {
          console.error(`Error parsing environment variables for ${serverName}: ${error.message}`);
        }
      }
      
      // Check for risk level
      const riskLevelKey = `MCP_SERVER_${serverName.toUpperCase()}_RISK_LEVEL`;
      if (process.env[riskLevelKey]) {
        try {
          const riskLevel = parseInt(process.env[riskLevelKey], 10);
          if ([RISK_LEVEL.LOW, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH].includes(riskLevel)) {
            config[serverName].riskLevel = riskLevel;
            
            // For high risk level, check for docker configuration
            if (riskLevel === RISK_LEVEL.HIGH) {
              const dockerConfigKey = `MCP_SERVER_${serverName.toUpperCase()}_DOCKER_CONFIG`;
              if (process.env[dockerConfigKey]) {
                try {
                  config[serverName].docker = JSON.parse(process.env[dockerConfigKey]);
                } catch (error) {
                  console.error(`Error parsing docker configuration for ${serverName}: ${error.message}`);
                  console.warn(`Server ${serverName} has HIGH risk level but invalid docker configuration, downgrading to MEDIUM risk level`);
                  config[serverName].riskLevel = RISK_LEVEL.MEDIUM;
                }
              } else {
                console.warn(`Server ${serverName} has HIGH risk level but no docker configuration, downgrading to MEDIUM risk level`);
                config[serverName].riskLevel = RISK_LEVEL.MEDIUM;
              }
            }
          } else {
            console.warn(`Invalid risk level ${riskLevel} for server ${serverName}, ignoring risk level`);
          }
        } catch (error) {
          console.error(`Error parsing risk level for ${serverName}: ${error.message}`);
        }
      }
      
      console.log(`Added server from environment: ${serverName}`);
    }
  });
  
  console.log(`Loaded ${Object.keys(config).length} server configurations`);
  return config;
}

// Start an HTTP-based MCP server
async function startHTTPServer(serverId, config) {
  console.log(`Starting HTTP MCP server: ${serverId} at ${config.url}`);
  
  const riskLevel = config.riskLevel || 1; // Default to low risk for HTTP servers
  
  return new Promise((resolve, reject) => {
    try {
      // Create HTTP connection handler
      const httpServer = {
        riskLevel,
        pid: 'http-' + Date.now(), // Fake PID for HTTP connections
        config,
        type: 'http',
        url: config.url,
        
        // Method to send requests to HTTP server
        sendRequest: async (method, params = {}) => {
          const requestId = uuidv4();
          const request = {
            jsonrpc: "2.0",
            id: requestId,
            method: method,
            params: params
          };
          
          try {
            console.log(`Sending HTTP request to ${serverId}: ${method}`, params);
            const response = await axios.post(config.url, request, {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 0 // No timeout for background job processing
            });
            
            return response.data;
          } catch (error) {
            console.error(`Error sending request to HTTP server ${serverId}:`, error.message);
            throw error;
          }
        }
      };
      
      // Store the server
      serverProcesses.set(serverId, httpServer);
      serverInitializationState.set(serverId, 'starting');
      
      // Test the connection by sending an initialize request
      setTimeout(async () => {
        try {
          const initRequest = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {
                roots: {
                  listChanged: true
                },
                sampling: {}
              },
              clientInfo: {
                name: "mcp-bridge",
                version: "1.0.0"
              }
            }
          };
          
          const response = await axios.post(config.url, initRequest, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // Keep timeout for initialization
          });
          
          if (response.data && (response.data.result || response.data.id)) {
            console.log(`HTTP server ${serverId} initialized successfully`);
            serverInitializationState.set(serverId, 'initialized');
            resolve(httpServer);
          } else {
            throw new Error('Invalid initialization response');
          }
        } catch (error) {
          console.error(`Failed to initialize HTTP server ${serverId}:`, error.message);
          reject(error);
        }
      }, 500); // Quick test for HTTP servers
      
    } catch (error) {
      console.error(`Error starting HTTP server ${serverId}:`, error);
      reject(error);
    }
  });
}

// Initialize and connect to MCP servers
async function initServers() {
  console.log('Initializing MCP servers...');
  const serverConfig = loadServerConfig();
  
  console.log('Server configurations found:');
  console.log(JSON.stringify(serverConfig, null, 2));
  
  // Start each configured server
  for (const [serverId, config] of Object.entries(serverConfig)) {
    try {
      console.log(`Starting server: ${serverId}`);
      await startServer(serverId, config);
      console.log(`Server ${serverId} initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize server ${serverId}: ${error.message}`);
    }
  }
  
  console.log('All servers initialized');
}

// Start a specific MCP server
async function startServer(serverId, config) {
  if (config.type === 'http') {
    return startHTTPServer(serverId, config);
  }
  if (config.type === 'sse') {
    // No persistent connection or initialization. Just register the server.
    const sseServer = {
      riskLevel: config.riskLevel || 1,
      pid: 'sse-' + Date.now(),
      config,
      type: 'sse',
      url: config.url
    };
    serverProcesses.set(serverId, sseServer);
    serverInitializationState.set(serverId, 'initialized');
    return Promise.resolve(sseServer);
  }
  
  console.log(`Starting MCP server process: ${serverId} with command: ${config.command} ${config.args.join(' ')}`);
  
  // Set default risk level to undefined for backward compatibility
  const riskLevel = config.riskLevel;
  
  if (riskLevel !== undefined) {
    console.log(`Server ${serverId} has risk level: ${riskLevel} (${RISK_LEVEL_DESCRIPTION[riskLevel]})`);
    
    // For high risk level, verify docker is configured
    if (riskLevel === RISK_LEVEL.HIGH) {
      if (!config.docker || typeof config.docker !== 'object') {
        throw new Error(`Server ${serverId} has HIGH risk level but no docker configuration`);
      }
      
      console.log(`Server ${serverId} will be started in docker container`);
    }
  } else {
    console.log(`Server ${serverId} has no risk level specified - using standard execution`);
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Get the npm path
      let commandPath = config.command;
      
      // If high risk, use docker
      if (riskLevel !== undefined && riskLevel === RISK_LEVEL.HIGH) {
        commandPath = 'docker';
        const dockerArgs = ['run', '--rm'];
        
        // Add any environment variables
        if (config.env && typeof config.env === 'object') {
          Object.entries(config.env).forEach(([key, value]) => {
            dockerArgs.push('-e', `${key}=${value}`);
          });
        }
        
        // Add volume mounts if specified
        if (config.docker.volumes && Array.isArray(config.docker.volumes)) {
          config.docker.volumes.forEach(volume => {
            dockerArgs.push('-v', volume);
          });
        }
        
        // Add network configuration if specified
        if (config.docker.network) {
          dockerArgs.push('--network', config.docker.network);
        }
        
        // Add the image and command
        dockerArgs.push(config.docker.image);
        
        // If original command was a specific executable, use it as the command in the container
        if (config.command !== 'npm' && config.command !== 'npx') {
          dockerArgs.push(config.command);
        }
        
        // Add the original args
        dockerArgs.push(...config.args);
        
        // Update args to use docker
        config = {
          ...config,
          originalCommand: config.command,
          command: commandPath,
          args: dockerArgs,
          riskLevel // Keep the risk level
        };
        
        console.log(`Transformed command for docker: ${commandPath} ${dockerArgs.join(' ')}`);
      }
      // If the command is npx or npm, try to find their full paths
      else if (config.command === 'npx' || config.command === 'npm') {
        // On Windows, try to use the npm executable from standard locations
        if (process.platform === 'win32') {
          const possiblePaths = [
            // Global npm installation
            path.join(process.env.APPDATA || '', 'npm', `${config.command}.cmd`),
            // Node installation directory
            path.join(process.env.ProgramFiles || '', 'nodejs', `${config.command}.cmd`),
            // Common Node installation location
            path.join('C:\\Program Files\\nodejs', `${config.command}.cmd`),
          ];
          
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              console.log(`Found ${config.command} at ${possiblePath}`);
              commandPath = possiblePath;
              break;
            }
          }
        } else {
          // On Unix-like systems, try using which to find the command
          try {
            const { execSync } = require('child_process');
            const whichOutput = execSync(`which ${config.command}`).toString().trim();
            if (whichOutput) {
              console.log(`Found ${config.command} at ${whichOutput}`);
              commandPath = whichOutput;
            }
          } catch (error) {
            console.error(`Error finding full path for ${config.command}:`, error.message);
          }
        }
      }
      
      console.log(`Using command path: ${commandPath}`);
      
      // Special handling for Windows command prompt executables (.cmd files)
      const isWindowsCmd = process.platform === 'win32' && commandPath.endsWith('.cmd');
      const actualCommand = isWindowsCmd ? 'cmd' : commandPath;
      const actualArgs = isWindowsCmd ? ['/c', commandPath, ...config.args] : config.args;
      
      console.log(`Spawning process with command: ${actualCommand} and args:`, actualArgs);
      
      // Combine environment variables
      const envVars = { ...process.env };
      
      // Add custom environment variables if provided
      if (config.env && typeof config.env === 'object') {
        console.log(`Adding environment variables for ${serverId}:`, config.env);
        Object.assign(envVars, config.env);
      } else {
        console.log(`No custom environment variables for ${serverId}`);
      }
      
      // Spawn the server process with shell option for better compatibility
      const serverProcess = spawn(actualCommand, actualArgs, {
        env: envVars,
        stdio: 'pipe',
        shell: !isWindowsCmd // Use shell only if not handling Windows .cmd specially
      });
      
      console.log(`Server process spawned for ${serverId}, PID: ${serverProcess.pid}`);
      
      // Initialize the server state as 'starting'
      serverInitializationState.set(serverId, 'starting');
      
      // Store the server process with its risk level
      serverProcesses.set(serverId, {
        process: serverProcess,
        riskLevel,
        pid: serverProcess.pid,
        config
      });
      
      // Set up initialization handler
      let initializationTimeout;
      const initializationHandler = (data) => {
        try {
          const responseText = data.toString();
          const lines = responseText.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              
              // Check if this is the initialize response
              if (response.id === 1 && response.result && response.result.protocolVersion) {
                console.log(`Server ${serverId} initialization completed successfully`);
                
                // Mark server as initialized
                serverInitializationState.set(serverId, 'initialized');
                
                // Remove the initialization handler
                serverProcess.stdout.removeListener('data', initializationHandler);
                
                // Clear the timeout
                if (initializationTimeout) {
                  clearTimeout(initializationTimeout);
                }
                
                // Send initialized notification to complete the handshake
                const initializedNotification = {
                  jsonrpc: "2.0",
                  method: "notifications/initialized"
                };
                
                serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');
                console.log(`Sent initialized notification to ${serverId}`);
                
                // Add regular stdout handler for future messages
                serverProcess.stdout.on('data', regularStdoutHandler);
                
                // Resolve the promise to indicate the server is ready
                resolve(serverProcess);
                return;
              }
            } catch (parseError) {
              // Ignore JSON parsing errors during initialization
              continue;
            }
          }
        } catch (error) {
          console.error(`Error processing initialization response from ${serverId}:`, error);
        }
      };
      
      // Set up regular stdout handler for non-initialization messages
      const regularStdoutHandler = (data) => {
        console.log(`[${serverId}] STDOUT: ${data.toString().trim()}`);
      };
      
      // Set up stderr handler
      serverProcess.stderr.on('data', (data) => {
        console.log(`[${serverId}] STDERR: ${data.toString().trim()}`);
      });
      
      serverProcess.on('error', (error) => {
        console.error(`[${serverId}] Process error: ${error.message}`);
        serverInitializationState.set(serverId, 'error');
        reject(error);
      });
      
      serverProcess.on('close', (code) => {
        console.log(`[${serverId}] Process exited with code ${code}`);
        serverProcesses.delete(serverId);
        serverInitializationState.delete(serverId);
      });
      
      // Add initialization handler first
      serverProcess.stdout.on('data', initializationHandler);
      
      // Set initialization timeout
      initializationTimeout = setTimeout(() => {
        console.error(`Server ${serverId} initialization timed out`);
        serverInitializationState.set(serverId, 'timeout');
        serverProcess.stdout.removeListener('data', initializationHandler);
        reject(new Error(`Server ${serverId} initialization timed out`));
              }, 30000); // 30 second timeout for initialization
      
      // Wait a moment for the process to start, then send initialize request
      setTimeout(() => {
        const initializeRequest = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            clientInfo: {
              name: "mcp-bridge",
              version: "1.0.0"
            },
            capabilities: {
              // Add capabilities as needed
            }
          }
        };
        
        serverProcess.stdin.write(JSON.stringify(initializeRequest) + '\n');
        console.log(`Sent initialize request to ${serverId}`);
      }, 1000);
      
    } catch (error) {
      console.error(`Error starting server ${serverId}:`, error);
      serverInitializationState.set(serverId, 'error');
      reject(error);
    }
  });
}

// Shutdown an MCP server
async function shutdownServer(serverId) {
  console.log(`Shutting down server: ${serverId}`);
  const serverInfo = serverProcesses.get(serverId);
  if (serverInfo) {
    if (serverInfo.type === 'http') {
      console.log(`Disconnecting HTTP server ${serverId}`);
      // HTTP servers don't need special cleanup
    } else if (serverInfo.type === 'sse') {
      // No persistent SSE connection to close
      // No heartbeat interval to clear
    } else {
      try {
        console.log(`Killing process for ${serverId}`);
        serverInfo.process.kill();
      } catch (error) {
        console.error(`Error killing process for ${serverId}: ${error.message}`);
      }
    }
    serverProcesses.delete(serverId);
  }
  serverInitializationState.delete(serverId);
  console.log(`Server ${serverId} shutdown complete`);
}

// MCP request handler
async function sendMCPRequest(serverId, method, params = {}, confirmationId = null) {
  const serverInfo = serverProcesses.get(serverId);
  if (!serverInfo) {
    throw new Error(`Server '${serverId}' not found or not connected`);
  }
  if (serverInfo.type === 'http') {
    // HTTP server: use HTTP request
    return await sendHttpMCPRequest(serverInfo.config.url, null, {
      jsonrpc: '2.0',
      id: confirmationId || uuidv4(),
      method,
      params
    }, method, params);
  } else if (serverInfo.type === 'sse') {
    // SSE server: open a new connection for this request only
    return await sendDynamicMCPRequest(serverInfo.config.url, null, method, params);
  } else {
    throw new Error(`Unknown server type for '${serverId}'`);
  }
}

// Job Queue System for Async Operations
console.log('Setting up job queue system');

// Job storage - In-memory Map (can be upgraded to Redis later)
const jobs = new Map();

// Crypto for secure token generation
const crypto = require('crypto');

// Generate 15-digit alphanumeric job ID
function generateJobId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate secure bearer token
function generateBearerToken() {
  return 'tok_' + crypto.randomBytes(32).toString('hex');
}

// Enhanced sendMCPRequest for background jobs (no timeout)
// Send request to dynamic MCP server (no pre-configuration needed)
async function sendDynamicMCPRequest(serverUrl, authToken, method, params = {}) {
  const requestId = uuidv4();
  const request = {
    jsonrpc: "2.0",
    id: requestId,
    method: method,
    params: params
  };
  console.log(`[DYNAMIC] Attempting to connect to: ${serverUrl}`);
  console.log(`[MCP-FIX] Using correct MCP format - method: ${method}, params:`, params);
  
  // For SSE servers, always use the config URL (with /sse) for the initial GET
  return await sendSSEMCPRequest(serverUrl, authToken, request, method, params);
}

// HTTP MCP Request (existing working logic)
async function sendHttpMCPRequest(serverUrl, authToken, request, method, params) {
  console.log(`[HTTP-DEBUG] Attempting HTTP request to ${serverUrl}`);
  console.log(`[HTTP-DEBUG] Request payload:`, JSON.stringify(request, null, 2));
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const response = await axios.post(serverUrl, request, { headers });
    console.log(`[HTTP-DEBUG] HTTP Response status: ${response.status}`);
    console.log(`[HTTP-DEBUG] HTTP Response data:`, JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(`[HTTP-DEBUG] HTTP error status: ${error.response.status}`);
      console.log(`[HTTP-DEBUG] HTTP error data:`, JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// SSE MCP Request (proper streaming approach)
async function sendSSEMCPRequest(serverUrl, authToken, request, method, params) {
  console.log(`[SSE] (Cloudflare MCP) Connecting to ${serverUrl}`);

  const headers = {
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  console.log('[SSE-DEBUG] Request headers:', headers);

  return new Promise((resolve, reject) => {
    const axiosSource = axios.CancelToken.source();
    let sessionEndpoint = null;
    let jsonResponse = null;
    let buffer = '';
    let sseResponse = null;
    let sessionTimeout = null;
    let responseTimeout = null;
    let requestPosted = false;
    let dataChunkCount = 0;
    
    // 1. Open GET SSE connection to /sse (never strip /sse)
    axios
      .get(serverUrl, {
        headers,
        responseType: 'stream',
        timeout: 0,
        cancelToken: axiosSource.token,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        httpAgent: httpAgent,
        httpsAgent: httpsAgent
      })
      .then((_sseResponse) => {
        sseResponse = _sseResponse;
        console.log('[SSE-DEBUG] Response status:', sseResponse.status);
        console.log('[SSE-DEBUG] Response headers:', sseResponse.headers);
        
        // Check for session ID in headers (Cloudflare MCP pattern)
        const sessionId = sseResponse.headers['mcp-session-id'];
        if (sessionId) {
          console.log('[SSE-DEBUG] Found session ID in headers:', sessionId);
          
          // Post back to the same /sse endpoint with session ID in header
          const reqHeaders = { 
            'Content-Type': 'application/json',
            'MCP-Session-Id': sessionId
          };
          if (authToken) reqHeaders.Authorization = `Bearer ${authToken}`;
          
          console.log(`[SSE] Posting request to ${serverUrl} with session ID ${sessionId} [${request.id}]`);
          
          clearTimeout(sessionTimeout);
          
          axios
            .post(serverUrl, request, {
              headers: reqHeaders,
              timeout: 30000
            })
            .then((postResponse) => {
              console.log(`[SSE] POST successful to ${serverUrl}, status: ${postResponse.status}`);
              console.log(`[SSE] POST response data:`, JSON.stringify(postResponse.data, null, 2));
              
              // Check if the response is directly in the POST response
              if (postResponse.data && postResponse.data.id === request.id) {
                console.log(`[SSE] Response received directly in POST response for request ${request.id}`);
                jsonResponse = postResponse.data;
                clearTimeout(responseTimeout);
                if (sseResponse && sseResponse.data) sseResponse.data.destroy();
                resolve(postResponse.data);
                return;
              }
              
              // Check if the response is in SSE format in the POST response
              if (postResponse.data && typeof postResponse.data === 'string' && postResponse.data.startsWith('data: ')) {
                try {
                  const jsonStr = postResponse.data.substring(6).trim(); // Remove "data: " prefix
                  const parsedResponse = JSON.parse(jsonStr);
                  if (parsedResponse.id === request.id) {
                    console.log(`[SSE] Response received in SSE format in POST response for request ${request.id}`);
                    jsonResponse = parsedResponse;
                    clearTimeout(responseTimeout);
                    if (sseResponse && sseResponse.data) sseResponse.data.destroy();
                    resolve(parsedResponse);
                    return;
                  }
                } catch (parseErr) {
                  console.log(`[SSE] Failed to parse SSE-formatted response: ${parseErr.message}`);
                }
              }
              
              // For tool execution, the response might come via SSE stream instead of POST response
              console.log(`[SSE] POST successful, waiting for response via SSE stream for request ${request.id}`);
              requestPosted = true;
              // 4. Wait for the response via SSE
              responseTimeout = setTimeout(() => {
                if (!jsonResponse) {
                  if (sseResponse && sseResponse.data) sseResponse.data.destroy();
                  reject(new Error('No JSON response received from SSE server'));
                }
              }, 30000); // 30s to get response
            })
            .catch((postErr) => {
              console.log(`[SSE] POST failed to ${serverUrl}: ${postErr.response?.status} - ${postErr.message}`);
              if (sseResponse && sseResponse.data) sseResponse.data.destroy();
              reject(new Error(`[SSE] POST error: ${postErr.message}`));
            });
        }
        
        buffer = '';
        jsonResponse = null;
        requestPosted = false;

        // 2. Wait for session endpoint (fallback if not in headers) - REMOVED since Cloudflare MCP uses headers
        // The session ID is already handled above in the headers check
        
        function processEvent(eventBlock) {
          const lines = eventBlock.split('\n');
          for (const line of lines) {
            if (line.startsWith(':')) continue;
            if (!line.startsWith('data:')) continue;
            const data = line.replace(/^data:\s*/, '').trim();
            if (!data) continue;
            // 2.1. Look for session endpoint
            if (!sessionEndpoint && (data.startsWith('/') || (data.startsWith('{') && data.includes('endpoint')))) {
              let endpoint = null;
              if (data.startsWith('/')) {
                endpoint = data;
              } else {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.endpoint) endpoint = parsed.endpoint;
                } catch {}
              }
              if (endpoint) {
                sessionEndpoint = endpoint;
                    clearTimeout(sessionTimeout);
                // 3. POST the JSON-RPC request to the session endpoint
                const baseUrl = serverUrl.replace(/\/sse$/, '');
                const fullEndpoint = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
                const reqHeaders = { 'Content-Type': 'application/json' };
                if (authToken) reqHeaders.Authorization = `Bearer ${authToken}`;
                console.log(`[SSE] Posting request to session endpoint ${fullEndpoint} [${request.id}]`);
                axios
                  .post(fullEndpoint, request, {
                    headers: reqHeaders,
                    timeout: 0
                  })
                  .then(() => {
                    requestPosted = true;
                    // 4. Wait for the response via SSE
                    responseTimeout = setTimeout(() => {
                      if (!jsonResponse) {
                        if (sseResponse && sseResponse.data) sseResponse.data.destroy();
                        reject(new Error('No JSON response received from SSE server'));
                      }
                    }, 30000); // 30s to get response
                  })
                  .catch((postErr) => {
                    if (sseResponse && sseResponse.data) sseResponse.data.destroy();
                    reject(new Error(`[SSE] POST error: ${postErr.message}`));
                  });
                    return;
                  }
              }
            // 4.1. Wait for JSON-RPC response
            if (data.startsWith('{')) {
              try {
                const parsed = JSON.parse(data);
                if (parsed.jsonrpc === '2.0' && parsed.id === request.id) {
                  jsonResponse = parsed;
                  if (responseTimeout) clearTimeout(responseTimeout);
                  if (sseResponse && sseResponse.data) sseResponse.data.destroy();
                  if (parsed.error) {
                    return reject(new Error(parsed.error.message || 'Unknown error from SSE server'));
                  }
                  return resolve(parsed.result || parsed);
                }
              } catch {}
            }
          }
        }

        sseResponse.data.on('data', (chunk) => {
          dataChunkCount++;
          const chunkStr = chunk.toString();
          console.log(`[SSE-DEBUG] Chunk ${dataChunkCount} (posted: ${requestPosted}): ${chunkStr.substring(0, 200)}...`);
          buffer += chunk.toString();
          console.log('[SSE-DEBUG] Raw chunk received:', chunk.toString());
          let idx;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const eventBlock = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            console.log('[SSE-DEBUG] Processing event block:', eventBlock);
            processEvent(eventBlock);
          }
        });

        sseResponse.data.on('end', () => {
          console.log('[SSE-DEBUG] SSE connection ended');
          if (!jsonResponse) {
            reject(new Error('SSE connection ended without response'));
          }
        });
        
        sseResponse.data.on('close', () => {
          console.log('[SSE-DEBUG] SSE connection closed');
        });
        
        sseResponse.data.on('error', (err) => {
          console.log('[SSE-DEBUG] SSE connection error:', err.message);
          if (!jsonResponse) {
            reject(new Error(`SSE connection error: ${err.message}`));
          }
        });
      })
      .catch((err) => {
        if (err.response) {
          console.error('[SSE-DEBUG] Error response status:', err.response.status);
          console.error('[SSE-DEBUG] Error response headers:', err.response.headers);
          console.error('[SSE-DEBUG] Error response data:', err.response.data ? err.response.data.toString() : '');
        }
        if (sessionTimeout) clearTimeout(sessionTimeout);
        if (responseTimeout) clearTimeout(responseTimeout);
        reject(new Error(`[SSE] Failed to open SSE connection: ${err.message}`));
      });
  });
}

// Parse SSE session data to extract endpoint
function parseSSESessionData(sseData) {
  console.log(`[SSE] Parsing session data...`);
  
  try {
    // Handle common SSE response patterns
    const lines = sseData.split('\n');
    
    for (const line of lines) {
      // Pattern 1: data: /path/to/endpoint
      if (line.startsWith('data: /')) {
        const endpoint = line.replace('data: ', '').trim();
        console.log(`[SSE] Found endpoint pattern 1: ${endpoint}`);
        return { endpoint };
      }
      
      // Pattern 2: data: {"endpoint": "/path/to/endpoint"}
      if (line.startsWith('data: {')) {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          if (data.endpoint) {
            console.log(`[SSE] Found endpoint pattern 2: ${data.endpoint}`);
            return { endpoint: data.endpoint };
          }
        } catch (e) {
          // Continue trying other patterns
        }
      }
      
      // Pattern 3: data: sessionId=xyz&endpoint=/path
      if (line.includes('endpoint=')) {
        const match = line.match(/endpoint=([^&\s]+)/);
        if (match) {
          const endpoint = decodeURIComponent(match[1]);
          console.log(`[SSE] Found endpoint pattern 3: ${endpoint}`);
          return { endpoint };
        }
      }
    }
    
    // If no specific pattern found, log the data for debugging
    console.log(`[SSE] Could not parse session data:`, sseData.substring(0, 200));
    throw new Error('No endpoint found in SSE session data');
    
  } catch (error) {
    console.error(`[SSE] Session parsing error:`, error.message);
    throw error;
  }
}

async function sendMCPRequestForJob(serverId, method, params = {}) {
  const serverInfo = serverProcesses.get(serverId);
  
  if (!serverInfo) {
    throw new Error(`Server '${serverId}' not found or not connected`);
  }
  
  // Handle HTTP servers
  if (serverInfo.type === 'http') {
    try {
      console.log(`[JOB] Sending HTTP request to ${serverId}: ${method}`, params);
      const response = await serverInfo.sendRequest(method, params);
      
      if (response.error) {
        throw new Error(response.error.message || 'Unknown error from HTTP server');
      }
      
      return response.result || response;
    } catch (error) {
      console.error(`[JOB] Error sending HTTP request to ${serverId}:`, error);
      throw error;
    }
  }
  
  // Handle SSE servers
  if (serverInfo.type === 'sse') {
    try {
      console.log(`[JOB] Sending SSE request to ${serverId}: ${method}`, params);
      const response = await serverInfo.sendRequest(method, params);
      
      if (response.error) {
        throw new Error(response.error.message || 'Unknown error from SSE server');
      }
      
      return response.result || response;
    } catch (error) {
      console.error(`[JOB] Error sending SSE request to ${serverId}:`, error);
      throw error;
    }
  }
  
  // Handle regular MCP servers with NO TIMEOUT for background jobs
  return new Promise((resolve, reject) => {
    // Check initialization state
    const initState = serverInitializationState.get(serverId);
    if (initState !== 'initialized') {
      const stateMessage = {
        'starting': 'Server is still starting up',
        'timeout': 'Server initialization timed out',
        'error': 'Server initialization failed'
      }[initState] || 'Server is not properly initialized';
      
      return reject(new Error(`${stateMessage}. Current state: ${initState}`));
    }
    
    const { process: serverProcess } = serverInfo;
    const requestId = uuidv4();
    
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params
    };
    
    console.log(`[JOB] Sending request to ${serverId}: ${method}`, params);
    
    // Set up response handler (NO TIMEOUT for background jobs)
    const messageHandler = (data) => {
      try {
        const responseText = data.toString();
        let parsedResponse = null;
        let jsonError = null;
        
        try {
          parsedResponse = JSON.parse(responseText);
        } catch (e) {
          const lines = responseText.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const lineResponse = JSON.parse(line);
              if (lineResponse.id === requestId) {
                parsedResponse = lineResponse;
                break;
              }
            } catch (lineError) {
              jsonError = lineError;
              console.error(`[JOB] Error parsing JSON line from ${serverId}:`, lineError);
            }
          }
        }
            
        if (parsedResponse && parsedResponse.id === requestId) {
          console.log(`[JOB] Received response from ${serverId} for request ${requestId}`);
          
          // Remove handler after response is received
          serverProcess.stdout.removeListener('data', messageHandler);
          
          if (parsedResponse.error) {
            return reject(new Error(parsedResponse.error.message || 'Unknown error'));
          }
          
          return resolve(parsedResponse.result);
        } else if (jsonError) {
          console.error(`[JOB] Failed to parse JSON response from ${serverId}`);
          serverProcess.stdout.removeListener('data', messageHandler);
          return reject(new Error(`Invalid response format from MCP server: ${jsonError.message}`));
        }
      } catch (error) {
        console.error(`[JOB] Error processing response from ${serverId}:`, error);
        serverProcess.stdout.removeListener('data', messageHandler);
        return reject(new Error(`Error processing response: ${error.message}`));
      }
    };
    
    // Add response handler (NO TIMEOUT)
    serverProcess.stdout.on('data', messageHandler);
    
    // Send the request
    try {
      serverProcess.stdin.write(JSON.stringify(request) + '\n');
    } catch (error) {
      serverProcess.stdout.removeListener('data', messageHandler);
      reject(new Error(`Failed to send request to ${serverId}: ${error.message}`));
      return;
    }
    
    // Handle error case
    const errorHandler = (error) => {
      serverProcess.stdout.removeListener('data', messageHandler);
      serverProcess.removeListener('error', errorHandler);
      reject(error);
    };
    
    serverProcess.once('error', errorHandler);
  });
}

// Background job processor
async function processJobInBackground(job_id) {
  console.log(`[JOB-ENTRY] Entering processJobInBackground for job: ${job_id}`);
  const job = jobs.get(job_id);
  if (!job) {
    console.error(`[JOB ${job_id}] Job not found in jobs map`);
    console.log(`[JOB-DEBUG] Available jobs:`, Array.from(jobs.keys()));
    return;
  }
  console.log(`[JOB ${job_id}] Starting background processing for tool: ${job.tool_name}`);
  console.log(`[JOB-DEBUG] Job details:`, JSON.stringify(job, null, 2));
  try {
    let result;
    if (job.dynamic_server_url) {
      console.log(`[JOB ${job_id}] Using dynamic MCP server: ${job.dynamic_server_url}`);
      console.log(`[MCP-FIX] Using CORRECT MCP format - calling tool directly:`, {
        url: job.dynamic_server_url,
        token: job.dynamic_auth_token,
        method: job.tool_name,  // Direct tool name as method
        params: job.parameters  // Direct parameters
      });
      result = await sendDynamicMCPRequest(
        job.dynamic_server_url,
        job.dynamic_auth_token,
        job.tool_name,
        job.parameters
      );
      console.log(`[MCP-FIX] sendDynamicMCPRequest result:`, JSON.stringify(result, null, 2));
    }
    else if (job.server_id) {
      if (!serverProcesses.has(job.server_id)) {
        throw new Error(`Server '${job.server_id}' not found or not connected`);
      }
      result = await sendMCPRequestForJob(job.server_id, 'tools/call', {
        name: job.tool_name,
        arguments: job.parameters
      });
    } 
    else {
      let foundServer = null;
      for (const [serverId, serverInfo] of serverProcesses) {
        try {
          const tools = await sendMCPRequestForJob(serverId, 'tools/list');
          if (tools && tools.tools && tools.tools.some(t => t.name === job.tool_name)) {
            foundServer = serverId;
            break;
          }
        } catch (error) {
          console.warn(`[JOB ${job_id}] Could not check tools for server ${serverId}:`, error.message);
        }
      }
      if (!foundServer) {
        throw new Error(`Tool '${job.tool_name}' not found on any connected server`);
      }
      console.log(`[JOB ${job_id}] Found tool '${job.tool_name}' on server '${foundServer}'`);
      result = await sendMCPRequestForJob(foundServer, 'tools/call', {
        name: job.tool_name,
        arguments: job.parameters
      });
    }
    console.log(`[JOB ${job_id}] Setting status to COMPLETED. Result:`, JSON.stringify(result, null, 2));
    job.status = 'COMPLETED';
    job.result = result;
    job.completed_at = new Date().toISOString();
    console.log(`[JOB ${job_id}] About to update jobs map. Job object:`, JSON.stringify(job, null, 2));
    jobs.set(job_id, job);
    console.log(`[JOB ${job_id}] Completed successfully. Result stored. Job object after set:`, JSON.stringify(jobs.get(job_id), null, 2));
  } catch (error) {
    job.status = 'FAILED';
    job.error = error.message;
    job.completed_at = new Date().toISOString();
    jobs.set(job_id, job);
    console.error(`[JOB ${job_id}] Failed:`, error.message);
    console.error(`[JOB ${job_id}] Job object after failure:`, JSON.stringify(job, null, 2));
  }
}

// Job cleanup - remove expired jobs
function cleanupExpiredJobs() {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [job_id, job] of jobs) {
    if (new Date(job.expires_at) < now) {
      jobs.delete(job_id);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[CLEANUP] Removed ${cleanedCount} expired jobs`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredJobs, 10 * 60 * 1000);

// API Routes
console.log('Setting up API routes');

// Get server status
app.get('/servers', (req, res) => {
  console.log('GET /servers');
  const servers = Array.from(serverProcesses.entries()).map(([id, info]) => {
    // Create base server info
    const serverInfo = {
      id,
      connected: true,
      pid: info.pid,
      initialization_state: serverInitializationState.get(id) || 'unknown'
    };
    
    // Only include risk level information if it was explicitly set
    if (info.riskLevel !== undefined) {
      serverInfo.risk_level = info.riskLevel;
      serverInfo.risk_description = RISK_LEVEL_DESCRIPTION[info.riskLevel];
      
      if (info.riskLevel === RISK_LEVEL.HIGH) {
        serverInfo.running_in_docker = true;
      }
    }
    
    return serverInfo;
  });
  
  console.log(`Returning ${servers.length} servers`);
  res.json({ servers });
});

// Start a new server (manual configuration)
app.post('/servers', async (req, res) => {
  console.log('POST /servers', req.body);
  try {
    const { id, command, args, env, riskLevel, docker, type, url, description } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Server ID is required" });
    }
    if (serverProcesses.has(id)) {
      return res.status(409).json({ error: `Server with ID '${id}' already exists` });
    }
    // Validate risk level if provided
    if (riskLevel !== undefined) {
      if (![RISK_LEVEL.LOW, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH].includes(riskLevel)) {
        return res.status(400).json({ error: `Invalid risk level: ${riskLevel}. Valid values are: ${RISK_LEVEL.LOW} (low), ${RISK_LEVEL.MEDIUM} (medium), ${RISK_LEVEL.HIGH} (high)` });
      }
      if (riskLevel === RISK_LEVEL.HIGH && (!docker || !docker.image)) {
        return res.status(400).json({ error: "Docker configuration with 'image' property is required for high risk level servers" });
      }
    }
    // Allow SSE servers (type/url) or stdio servers (command)
    let config = { args: args || [], env: env || {} };
    if (command) config.command = command;
    if (type) config.type = type;
    if (url) config.url = url;
    if (riskLevel !== undefined) config.riskLevel = riskLevel;
    if (docker) config.docker = docker;
    if (description) config.description = description;
    // Try to start the server in memory if possible
    let started = false;
    if (command) {
      try {
        await startServer(id, config);
        started = true;
      } catch (e) {
        console.warn(`Warning: Could not start server process for '${id}': ${e.message}`);
      }
    } else if (type === 'sse' && url) {
      // Register SSE server in memory (simulate startServer for SSE)
      try {
        await startServer(id, config);
        started = true;
      } catch (e) {
        console.warn(`Warning: Could not register SSE server for '${id}': ${e.message}`);
      }
    }
    // Always persist to mcp_config.json if config is valid
    let fullConfig;
    try {
      fullConfig = readFullConfig();
      if (!fullConfig.mcpServers) fullConfig.mcpServers = {};
      fullConfig.mcpServers[id] = config;
      writeFullConfig(fullConfig);
    } catch (e) {
      // Rollback in-memory addition if started
      if (started) await shutdownServer(id);
      return res.status(500).json({ error: 'Failed to persist server config: ' + e.message });
    }
    // Prepare response
    let response = { id, status: started ? "connected" : "persisted", config };
    if (started && serverProcesses.get(id) && serverProcesses.get(id).pid) {
      response.pid = serverProcesses.get(id).pid;
    }
    if (riskLevel !== undefined) {
      response.risk_level = riskLevel;
      response.risk_description = RISK_LEVEL_DESCRIPTION[riskLevel];
      if (riskLevel === RISK_LEVEL.HIGH) {
        response.running_in_docker = true;
      }
    }
    res.status(started ? 201 : 202).json(response);
  } catch (error) {
    console.error(`Error starting server: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Stop a server
app.delete('/servers/:serverId', async (req, res) => {
  const { serverId } = req.params;
  console.log(`DELETE /servers/${serverId}`);
  let stopped = false;
  if (serverProcesses.has(serverId)) {
    try {
      await shutdownServer(serverId);
      stopped = true;
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  // Remove from mcp_config.json if present
  let fullConfig;
  let existedInConfig = false;
  try {
    fullConfig = readFullConfig();
    if (fullConfig.mcpServers && fullConfig.mcpServers[serverId]) {
      delete fullConfig.mcpServers[serverId];
      writeFullConfig(fullConfig);
      existedInConfig = true;
    }
  } catch (e) {
    // Rollback: try to restart the server (best effort)
    if (stopped) {
      // (Optional: could also log a warning and return error)
      return res.status(500).json({ error: 'Failed to update config file: ' + e.message });
    }
  }
  if (stopped || existedInConfig) {
    res.json({ status: "disconnected" });
  } else {
    res.status(404).json({ error: `Server '${serverId}' not found` });
  }
});

// Get tools for a server
app.get('/servers/:serverId/tools', async (req, res) => {
  const { serverId } = req.params;
  console.log(`GET /servers/${serverId}/tools`);

  try {
    if (!serverProcesses.has(serverId)) {
      return res.status(404).json({
        error: `Server '${serverId}' not found or not connected`
      });
    }
    const serverInfo = serverProcesses.get(serverId);
    
    // Use direct SSE server sendRequest method for better reliability
    if (serverInfo.type === 'sse' && serverInfo.sendRequest) {
      try {
        console.log(`[TOOLS-LIST] Using direct SSE sendRequest for ${serverId}`);
        const result = await serverInfo.sendRequest('tools/list', {});
        
        // Handle different response formats
        if (result && result.result) {
          res.json(result.result);
        } else {
          res.json(result);
        }
        return;
      } catch (sseError) {
        console.error(`[TOOLS-LIST] Direct SSE failed for ${serverId}:`, sseError.message);
        
        // Fallback to dynamic request
        try {
      const sseUrl = serverInfo.config.url.endsWith('/sse') ? serverInfo.config.url : serverInfo.config.url + '/sse';
      const result = await sendDynamicMCPRequest(sseUrl, null, 'tools/list', {});
          
          // Parse and format the response properly
          if (result && typeof result === 'string' && result.startsWith('data: ')) {
            // Handle raw SSE response format
            try {
              const jsonPart = result.replace(/^data:\s*/, '').trim();
              const parsed = JSON.parse(jsonPart);
              if (parsed.result) {
                res.json(parsed.result);
              } else {
                res.json(parsed);
              }
            } catch (parseError) {
              console.error(`Error parsing SSE response for ${serverId}:`, parseError);
              res.json({ tools: [], error: "Failed to parse server response" });
            }
          } else {
      res.json(result);
          }
      return;
        } catch (fallbackError) {
          console.error(`[TOOLS-LIST] Both direct and fallback failed for ${serverId}`);
          throw fallbackError;
    }
      }
    }
    
    // Default: use standard logic for non-SSE servers
    const result = await sendMCPRequest(serverId, 'tools/list');
    res.json(result);
  } catch (error) {
    console.error(`Error listing tools for ${serverId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Execute a tool on a server
app.post('/servers/:serverId/tools/:toolName', async (req, res) => {
  const { serverId, toolName } = req.params;
  const arguments = req.body;

  console.log(`POST /servers/${serverId}/tools/${toolName}`, arguments);

  try {
    if (!serverProcesses.has(serverId)) {
      return res.status(404).json({
        error: `Server '${serverId}' not found or not connected`
      });
    }
    const serverInfo = serverProcesses.get(serverId);
    
    // Use direct SSE server sendRequest method for better reliability
    if (serverInfo.type === 'sse' && serverInfo.sendRequest) {
      try {
        console.log(`[TOOL-EXEC] Using direct SSE sendRequest for ${serverId}`);
        const result = await serverInfo.sendRequest('tools/call', {
          name: toolName,
          arguments
        });
        
        // Handle different response formats
        if (result && result.result) {
          res.json(result.result);
        } else if (result && result.content) {
          res.json(result);
        } else {
          res.json(result);
        }
        return;
      } catch (sseError) {
        console.error(`[TOOL-EXEC] Direct SSE failed for ${serverId}:`, sseError.message);
        
        // Fallback to dynamic request
        try {
      const sseUrl = serverInfo.config.url.endsWith('/sse') ? serverInfo.config.url : serverInfo.config.url + '/sse';
      const result = await sendDynamicMCPRequest(sseUrl, null, 'tools/call', {
        name: toolName,
        arguments
      });
          
          // Parse and format the response properly
          if (result && typeof result === 'string' && result.startsWith('data: ')) {
            // Handle raw SSE response format
            try {
              const jsonPart = result.replace(/^data:\s*/, '').trim();
              const parsed = JSON.parse(jsonPart);
              if (parsed.result) {
                res.json(parsed.result);
              } else {
                res.json(parsed);
              }
            } catch (parseError) {
              console.error(`Error parsing SSE response for ${serverId}:`, parseError);
              res.status(500).json({ error: "Failed to parse server response" });
            }
          } else {
      res.json(result);
          }
      return;
        } catch (fallbackError) {
          console.error(`[TOOL-EXEC] Both direct and fallback failed for ${serverId}`);
          throw fallbackError;
        }
      }
    }
    // Default: use standard logic
    const result = await sendMCPRequest(serverId, 'tools/call', {
      name: toolName,
      arguments
    });
    // Ensure we have a valid result object to return
    if (result === undefined || result === null) {
      return res.status(500).json({ 
        error: "The MCP server returned an empty response" 
      });
    }
    // Handle different response formats
    try {
      res.json(result);
    } catch (jsonError) {
      console.error(`Error stringifying result for tool ${toolName}:`, jsonError);
      res.status(500).json({ 
        error: "Failed to format the response from the MCP server",
        details: jsonError.message
      });
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    res.status(500).json({ 
      error: `Error executing tool ${toolName}: ${error.message}` 
    });
  }
});

// Confirm a medium risk level request
app.post('/confirmations/:confirmationId', async (req, res) => {
  const { confirmationId } = req.params;
  const { confirm } = req.body;
  
  console.log(`POST /confirmations/${confirmationId}`, req.body);
  
  // Check if the confirmation exists
  if (!pendingConfirmations.has(confirmationId)) {
    return res.status(404).json({
      error: `Confirmation '${confirmationId}' not found or expired`
    });
  }
  
  const pendingRequest = pendingConfirmations.get(confirmationId);
  
  // Check if the confirmation is expired (10 minutes)
  const now = Date.now();
  if (now - pendingRequest.timestamp > 10 * 60 * 1000) {
    pendingConfirmations.delete(confirmationId);
    return res.status(410).json({
      error: `Confirmation '${confirmationId}' has expired`
    });
  }
  
  // If not confirmed, just delete the pending request
  if (!confirm) {
    pendingConfirmations.delete(confirmationId);
    return res.json({
      status: "rejected",
      message: "Request was rejected by the user"
    });
  }
  
  try {
    // Execute the confirmed request
    console.log(`Executing confirmed request for ${pendingRequest.serverId}`);
    const result = await sendMCPRequest(
      pendingRequest.serverId, 
      pendingRequest.method, 
      pendingRequest.params,
      confirmationId // Pass the confirmation ID to bypass confirmation check
    );
    
    // Delete the pending request
    pendingConfirmations.delete(confirmationId);
    
    // Return the result
    res.json(result);
  } catch (error) {
    console.error(`Error executing confirmed request: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get resources for a server
app.get('/servers/:serverId/resources', async (req, res) => {
  const { serverId } = req.params;
  console.log(`GET /servers/${serverId}/resources`);
  
  try {
    if (!serverProcesses.has(serverId)) {
      return res.status(404).json({
        error: `Server '${serverId}' not found or not connected`
      });
    }
    
    const result = await sendMCPRequest(serverId, 'resources/list');
    res.json(result);
  } catch (error) {
    console.error(`Error listing resources for ${serverId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific resource
app.get('/servers/:serverId/resources/:resourceUri', async (req, res) => {
  const { serverId, resourceUri } = req.params;
  console.log(`GET /servers/${serverId}/resources/${resourceUri}`);
  
  try {
    if (!serverProcesses.has(serverId)) {
      return res.status(404).json({
        error: `Server '${serverId}' not found or not connected`
      });
    }
    
    const decodedUri = decodeURIComponent(resourceUri);
    const result = await sendMCPRequest(serverId, 'resources/read', {
      uri: decodedUri
    });
    
    res.json(result);
  } catch (error) {
    console.error(`Error reading resource ${resourceUri}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get prompts for a server
app.get('/servers/:serverId/prompts', async (req, res) => {
  const { serverId } = req.params;
  console.log(`GET /servers/${serverId}/prompts`);
  
  try {
    if (!serverProcesses.has(serverId)) {
      return res.status(404).json({
        error: `Server '${serverId}' not found or not connected`
      });
    }
    
    const result = await sendMCPRequest(serverId, 'prompts/list');
    res.json(result);
  } catch (error) {
    console.error(`Error listing prompts for ${serverId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Execute a prompt
app.post('/servers/:serverId/prompts/:promptName', async (req, res) => {
  const { serverId, promptName } = req.params;
  const arguments = req.body;
  
  console.log(`POST /servers/${serverId}/prompts/${promptName}`, arguments);
  
  try {
    if (!serverProcesses.has(serverId)) {
      return res.status(404).json({
        error: `Server '${serverId}' not found or not connected`
      });
    }
    
    const result = await sendMCPRequest(serverId, 'prompts/get', {
      name: promptName,
      arguments
    });
    
    // Ensure we have a valid result object to return
    if (result === undefined || result === null) {
      return res.status(500).json({ 
        error: "The MCP server returned an empty response" 
      });
    }
    
    // Handle different response formats
    try {
      // Return the parsed result
    res.json(result);
    } catch (jsonError) {
      console.error(`Error stringifying result for prompt ${promptName}:`, jsonError);
      // If JSON serialization fails, return a clean error
      res.status(500).json({ 
        error: "Failed to format the response from the MCP server",
        details: jsonError.message
      });
    }
  } catch (error) {
    console.error(`Error executing prompt ${promptName}:`, error);
    res.status(500).json({
      error: `Error executing prompt ${promptName}: ${error.message}`
    });
  }
});

// Generate Postman collection from MCP server
app.post('/generate-postman', async (req, res) => {
  console.log('POST /generate-postman');
  
  try {
    const { serverUrl, serverType = 'http', authToken, serverCommand, serverArgs, serverEnv } = req.body;
    
    if (!serverUrl && !serverCommand) {
      return res.status(400).json({
        error: 'Either serverUrl (for HTTP/SSE) or serverCommand (for stdio) is required'
      });
    }
    
    console.log(`Generating Postman collection for MCP server: ${serverUrl || serverCommand}`);
    
    // Create a temporary server ID for discovery
    const tempServerId = `temp-${Date.now()}`;
    let tempServerStarted = false;
    
    try {
      // Determine server configuration based on provided parameters
      let serverConfig;
      
      if (serverUrl) {
        // HTTP/SSE server configuration
        serverConfig = {
          url: serverUrl,
          type: serverType,
          ...(authToken && { authToken })
        };
      } else {
        // stdio server configuration
        serverConfig = {
          command: serverCommand,
          args: serverArgs || [],
          env: serverEnv || {}
        };
      }
      
      // Temporarily start the server for discovery
      console.log(`Starting temporary server for discovery: ${tempServerId}`);
      await startServer(tempServerId, serverConfig);
      tempServerStarted = true;
      
      // Wait a moment for server to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Discover server capabilities
      console.log('Discovering server capabilities...');
      
      const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
        sendMCPRequest(tempServerId, 'tools/list').catch(e => ({ tools: [] })),
        sendMCPRequest(tempServerId, 'resources/list').catch(e => ({ resources: [] })),
        sendMCPRequest(tempServerId, 'prompts/list').catch(e => ({ prompts: [] }))
      ]);
      
      const tools = toolsResult.status === 'fulfilled' ? (toolsResult.value.tools || []) : [];
      const resources = resourcesResult.status === 'fulfilled' ? (resourcesResult.value.resources || []) : [];
      const prompts = promptsResult.status === 'fulfilled' ? (promptsResult.value.prompts || []) : [];
      
      console.log(`Discovered: ${tools.length} tools, ${resources.length} resources, ${prompts.length} prompts`);
      
      // Generate Postman collection
      const postmanCollection = generatePostmanCollection(serverUrl || serverCommand, tools, resources, prompts, serverConfig);
      
      console.log(`Postman collection generated successfully:`, {
        toolsCount: tools.length,
        resourcesCount: resources.length,
        promptsCount: prompts.length,
        collectionFolders: postmanCollection.item.length,
        collectionSize: JSON.stringify(postmanCollection).length
      });
      
      // Add metadata to the collection itself instead of wrapping it
      postmanCollection.metadata = {
        serverUrl: serverUrl || serverCommand,
        toolsCount: parseInt(tools.length, 10),
        resourcesCount: parseInt(resources.length, 10),
        promptsCount: parseInt(prompts.length, 10),
        generatedAt: new Date().toISOString()
      };
      
      // Return the collection directly (not wrapped) for proper Postman compatibility
      res.json(postmanCollection);
      
    } finally {
      // Clean up temporary server
      if (tempServerStarted) {
        try {
          console.log(`Cleaning up temporary server: ${tempServerId}`);
          await shutdownServer(tempServerId);
        } catch (cleanupError) {
          console.error(`Error cleaning up temporary server: ${cleanupError.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error generating Postman collection:', error);
    res.status(500).json({
      error: 'Failed to generate Postman collection',
      details: error.message
    });
  }
});

// Helper function to generate Postman collection
function generatePostmanCollection(serverIdentifier, tools, resources, prompts, serverConfig) {
  const collectionName = `MCP Server: ${serverIdentifier}`;
  const bridgeBaseUrl = 'https://mcp-bridge-api-main.onrender.com';
  
  // Determine appropriate server ID based on server type and URL
  let serverId = 'your-server-id';
  
  try {
    if (serverConfig.url) {
      // For HTTP/SSE servers, try to extract a meaningful ID from URL
      const urlLower = serverConfig.url.toLowerCase();
      
      // Check for specific server types in the full URL
      if (urlLower.includes('math') || urlLower.includes('calculator')) {
        serverId = 'math-server';
      } else if (urlLower.includes('filesystem') || urlLower.includes('files')) {
        serverId = 'filesystem-server';
      } else if (urlLower.includes('sqlite') || urlLower.includes('database')) {
        serverId = 'sqlite-server';
      } else if (urlLower.includes('postgres') || urlLower.includes('postgresql')) {
        serverId = 'postgres-server';
      } else if (urlLower.includes('memory') || urlLower.includes('cache')) {
        serverId = 'memory-server';
      } else if (urlLower.includes('proxy') && urlLower.includes('mcp')) {
        // Special case for MCP proxy servers - try to determine from path or context
        serverId = 'math-server'; // Default to math-server for the known proxy
      } else {
        // Generate a generic ID from the URL
        try {
          const url = new URL(serverConfig.url);
          const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '');
          serverId = hostname ? `${hostname}-server` : 'http-server';
        } catch (urlError) {
          serverId = 'http-server';
        }
      }
    } else if (serverConfig.command) {
      // For stdio servers, generate ID from command
      const commandLower = serverConfig.command.toLowerCase();
      const argsLower = (serverConfig.args || []).join(' ').toLowerCase();
      
      if (commandLower.includes('filesystem') || argsLower.includes('filesystem')) {
        serverId = 'filesystem-server';
      } else if (commandLower.includes('sqlite') || argsLower.includes('sqlite')) {
        serverId = 'sqlite-server';
      } else if (commandLower.includes('postgres') || argsLower.includes('postgres')) {
        serverId = 'postgres-server';
      } else if (argsLower.includes('everything')) {
        serverId = 'everything-server';
      } else if (commandLower.includes('math') || argsLower.includes('math')) {
        serverId = 'math-server';
      } else {
        // Generate generic ID from command
        const cmdName = serverConfig.command.split(/[/\\]/).pop().replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '');
        serverId = cmdName ? `${cmdName}-server` : 'stdio-server';
      }
    }
  } catch (error) {
    console.warn('Error generating server ID:', error);
    serverId = 'custom-server';
  }
  
  // Collection info with proper Postman ID
  const collection = {
    info: {
      _postman_id: uuidv4(),
      name: collectionName,
      description: `Auto-generated Postman collection for MCP server integration with Aisera.\n\nServer: ${serverIdentifier}\nGenerated: ${new Date().toISOString()}\nServer ID: ${serverId}\n\n🔧 SETUP INSTRUCTIONS:\n1. Import this collection into Postman or Aisera\n2. Update the 'server_id' environment variable if needed\n3. All requests use the MCP Bridge API for seamless integration\n\n📁 COLLECTION CONTENTS:\n• ${tools.length} Tools - Execute MCP server functions\n• ${resources.length} Resources - Access MCP server data\n• ${prompts.length} Prompts - Use MCP server templates\n• General Operations - List tools, resources, and health checks\n\n🌐 All requests go through: https://mcp-bridge-api-main.onrender.com\n\nReady for Aisera integration!`,
      version: "1.0.0",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [],
    variable: [
      {
        key: "url",
        value: bridgeBaseUrl,
        type: "string",
        description: "Base URL for the MCP Bridge API"
      },
      {
        key: "server_id",
        value: serverId,
        type: "string",
        description: "MCP Server ID in the bridge (update this to match your actual server ID)"
      }
    ]
  };
  
  // Add auth token variable if provided (for future use)
  if (serverConfig.authToken) {
    collection.variable.push({
      key: "auth_token",
      value: serverConfig.authToken,
      type: "string",
      description: "Authentication token (if required by bridge)"
    });
  }
  
  // Add helpful variables for common parameter values
  collection.variable.push({
    key: "unit",
    value: "radians",
    type: "string",
    description: "Unit for trigonometric functions (radians or degrees)"
  });
  
  collection.variable.push({
    key: "values",
    value: "[1, 2, 3, 4, 5]",
    type: "string",
    description: "Array of numbers for statistical functions (JSON format)"
  });
  
  // Generate Tools folder
  if (tools.length > 0) {
    const toolsFolder = {
      name: "Tools",
      description: `MCP Tools (${tools.length} available)`,
      item: tools.map(tool => generateToolRequest(tool, bridgeBaseUrl))
    };
    collection.item.push(toolsFolder);
  }
  
  // Generate Resources folder
  if (resources.length > 0) {
    const resourcesFolder = {
      name: "Resources",
      description: `MCP Resources (${resources.length} available)`,
      item: resources.map(resource => generateResourceRequest(resource, bridgeBaseUrl))
    };
    collection.item.push(resourcesFolder);
  }
  
  // Generate Prompts folder
  if (prompts.length > 0) {
    const promptsFolder = {
      name: "Prompts",
      description: `MCP Prompts (${prompts.length} available)`,
      item: prompts.map(prompt => generatePromptRequest(prompt, bridgeBaseUrl))
    };
    collection.item.push(promptsFolder);
  }
  
  // Add general MCP operations folder
  const generalFolder = {
    name: "General MCP Operations",
    description: "Standard MCP Bridge API operations",
    item: [
      {
        name: "List All Tools",
        request: {
          method: "GET",
          header: [
            { key: "Content-Type", value: "application/json" }
          ],
          url: {
            raw: `{{url}}/servers/{{server_id}}/tools`,
            host: ["{{url}}"],
            path: ["servers", "{{server_id}}", "tools"]
          },
          description: "List all available tools on the MCP server through the bridge"
        },
        response: []
      },
      {
        name: "List All Resources",
        request: {
          method: "GET",
          header: [
            { key: "Content-Type", value: "application/json" }
          ],
          url: {
            raw: `{{url}}/servers/{{server_id}}/resources`,
            host: ["{{url}}"],
            path: ["servers", "{{server_id}}", "resources"]
          },
          description: "List all available resources on the MCP server through the bridge"
        },
        response: []
      },
      {
        name: "List All Prompts",
        request: {
          method: "GET",
          header: [
            { key: "Content-Type", value: "application/json" }
          ],
          url: {
            raw: `{{url}}/servers/{{server_id}}/prompts`,
            host: ["{{url}}"],
            path: ["servers", "{{server_id}}", "prompts"]
          },
          description: "List all available prompts on the MCP server through the bridge"
        },
        response: []
      },
      {
        name: "Server Health Check",
        request: {
          method: "GET",
          header: [
            { key: "Content-Type", value: "application/json" }
          ],
          url: {
            raw: `{{url}}/health`,
            host: ["{{url}}"],
            path: ["health"]
          },
          description: "Check the health and status of all connected MCP servers"
        },
        response: []
      }
    ]
  };
  collection.item.push(generalFolder);
  
  return collection;
}

// Helper function to generate tool request
function generateToolRequest(tool, bridgeBaseUrl) {
  const parameters = generateExampleParameters(tool.inputSchema);
  
  return {
    name: tool.name,
    request: {
      method: "POST",
      header: [
        { key: "Content-Type", value: "application/json" }
      ],
      body: {
        mode: "raw",
        raw: JSON.stringify(parameters, null, 2),
        options: {
          raw: {
            language: "json"
          }
        }
      },
      url: {
        raw: `{{url}}/servers/{{server_id}}/tools/${tool.name}`,
        host: ["{{url}}"],
        path: ["servers", "{{server_id}}", "tools", tool.name]
      },
      description: `${tool.description || 'No description available'}\n\nTool: ${tool.name}\n\nThis request calls the MCP Bridge API which will execute the tool on the connected MCP server.\n\n${generateParameterDocumentation(tool.inputSchema)}`
    },
    response: []
  };
}

// Helper function to generate resource request
function generateResourceRequest(resource, bridgeBaseUrl) {
  return {
    name: resource.name || resource.uri,
    request: {
      method: "GET",
      header: [
        { key: "Content-Type", value: "application/json" }
      ],
      url: {
        raw: `{{url}}/servers/{{server_id}}/resources/${encodeURIComponent(resource.uri)}`,
        host: ["{{url}}"],
        path: ["servers", "{{server_id}}", "resources", encodeURIComponent(resource.uri)]
      },
      description: `${resource.description || 'No description available'}\n\nResource URI: ${resource.uri}\n\nMime Type: ${resource.mimeType || 'Unknown'}\n\nThis request gets the resource through the MCP Bridge API.`
    },
    response: []
  };
}

// Helper function to generate prompt request
function generatePromptRequest(prompt, bridgeBaseUrl) {
  const arguments = generateExampleArguments(prompt.arguments);
  
  return {
    name: prompt.name,
    request: {
      method: "POST",
      header: [
        { key: "Content-Type", value: "application/json" }
      ],
      body: {
        mode: "raw",
        raw: JSON.stringify(arguments, null, 2),
        options: {
          raw: {
            language: "json"
          }
        }
      },
      url: {
        raw: `{{url}}/servers/{{server_id}}/prompts/${prompt.name}`,
        host: ["{{url}}"],
        path: ["servers", "{{server_id}}", "prompts", prompt.name]
      },
      description: `${prompt.description || 'No description available'}\n\nPrompt: ${prompt.name}\n\nThis request executes the prompt through the MCP Bridge API.\n\n${generateArgumentDocumentation(prompt.arguments)}`
    },
    response: []
  };
}

// Helper function to generate example parameters from JSON schema
function generateExampleParameters(inputSchema) {
  if (!inputSchema || !inputSchema.properties) {
    return {};
  }
  
  const parameters = {};
  
  for (const [paramName, paramSchema] of Object.entries(inputSchema.properties)) {
    parameters[paramName] = generateExampleValue(paramSchema, paramName);
  }
  
  return parameters;
}

// Helper function to generate example arguments for prompts
function generateExampleArguments(argumentsArray) {
  if (!argumentsArray || !Array.isArray(argumentsArray)) {
    return {};
  }
  
  const arguments = {};
  
  for (const arg of argumentsArray) {
    arguments[arg.name] = generateExampleValueFromArg(arg);
  }
  
  return arguments;
}

// Helper function to generate example values based on parameter type
function generateExampleValue(schema, paramName) {
  const type = schema.type || 'string';
  const description = schema.description || '';
  
  switch (type) {
    case 'string':
      if (description.toLowerCase().includes('email')) return 'user@example.com';
      if (description.toLowerCase().includes('url')) return 'https://example.com';
      if (description.toLowerCase().includes('path')) return '/path/to/file';
      if (description.toLowerCase().includes('name')) return 'example_name';
      return `{{${paramName}}}`;
      
    case 'number':
    case 'integer':
      return schema.example || 42;
      
    case 'boolean':
      return schema.example !== undefined ? schema.example : true;
      
    case 'array':
      return schema.example || ['example_item'];
      
    case 'object':
      return schema.example || { "key": "value" };
      
    default:
      return `{{${paramName}}}`;
  }
}

// Helper function to generate example values for prompt arguments
function generateExampleValueFromArg(arg) {
  if (arg.required === false) {
    return `{{${arg.name}_optional}}`;
  }
  return `{{${arg.name}}}`;
}

// Helper function to generate parameter documentation
function generateParameterDocumentation(inputSchema) {
  if (!inputSchema || !inputSchema.properties) {
    return 'No parameters required.';
  }
  
  let doc = 'Parameters:\n';
  
  for (const [paramName, paramSchema] of Object.entries(inputSchema.properties)) {
    const type = paramSchema.type || 'any';
    const description = paramSchema.description || 'No description';
    const required = inputSchema.required && inputSchema.required.includes(paramName) ? ' (required)' : ' (optional)';
    
    doc += `- ${paramName} (${type})${required}: ${description}\n`;
  }
  
  return doc;
}

// Helper function to generate argument documentation for prompts
function generateArgumentDocumentation(argumentsArray) {
  if (!argumentsArray || !Array.isArray(argumentsArray) || argumentsArray.length === 0) {
    return 'No arguments required.';
  }
  
  let doc = 'Arguments:\n';
  
  for (const arg of argumentsArray) {
    const required = arg.required !== false ? ' (required)' : ' (optional)';
    const description = arg.description || 'No description';
    
    doc += `- ${arg.name}${required}: ${description}\n`;
  }
  
  return doc;
}

// ===== JOB QUEUE ENDPOINTS =====

// Job submission endpoint - Start async job
app.post('/tool/execute', async (req, res) => {
  console.log('POST /tool/execute', req.body);
  
  try {
    const { tool_name, server_id, ...parameters } = req.body;
    
    if (!tool_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tool_name'
      });
    }
    
    // Generate job identifiers
    const job_id = generateJobId();
    const bearer_token = generateBearerToken();
    
    // Create job record
    const job = {
      job_id,
      bearer_token,
      status: 'QUEUED',
      tool_name,
      server_id: server_id || null, // Optional specific server
      parameters,
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      expires_at: new Date(Date.now() + 24*60*60*1000).toISOString() // 24 hour TTL
    };
    
    // Store job
    jobs.set(job_id, job);
    
    console.log(`[JOB ${job_id}] Job queued for tool: ${tool_name}`);
    
    // Start background processing (non-blocking)
    setImmediate(() => processJobInBackground(job_id));
    
    // Return immediate response
    res.json({
      success: true,
      message: 'Job queued successfully',
      job_id: job_id,
      result_location: `/results/${job_id}`,
      bearer_token: bearer_token,
      status: 'QUEUED',
      tool_name: tool_name,
      estimated_completion: new Date(Date.now() + 10*60*1000).toISOString(), // 10 min estimate
      created_at: job.created_at,
      expires_at: job.expires_at
    });
    
  } catch (error) {
    console.error('Error queuing job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue job',
      message: error.message
    });
  }
});

// Dynamic MCP Server Tool Execution - Submit async job with dynamic MCP server
app.post('/tool/execute/dynamic', async (req, res) => {
  console.log('POST /tool/execute/dynamic', req.body);
  
  try {
    const { mcp_server_url, mcp_auth_token, tool_name, parameters } = req.body;
    
    // Validate required fields
    if (!mcp_server_url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: mcp_server_url'
      });
    }
    
    if (!tool_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tool_name'
      });
    }
    
    // Validate URL format
    try {
      new URL(mcp_server_url);
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mcp_server_url format',
        message: 'Must be a valid HTTP/HTTPS URL'
      });
    }
    
    // Validate MCP method format - tool names should be called directly
    console.log(`[MCP-FIX] Fixing request format for tool: ${tool_name}`);
    
    // Generate job identifiers
    const job_id = generateJobId();
    const bearer_token = generateBearerToken();
    
    // Create job record with dynamic server info
    const job = {
      job_id,
      bearer_token,
      status: 'QUEUED',
      tool_name,
      parameters: parameters || {},
      // Dynamic server configuration
      dynamic_server_url: mcp_server_url,
      dynamic_auth_token: mcp_auth_token || null,
      // Standard job fields
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      expires_at: new Date(Date.now() + 24*60*60*1000).toISOString() // 24 hour TTL
    };
    
    // Store job
    jobs.set(job_id, job);
    
    console.log(`[JOB ${job_id}] Dynamic job queued for tool: ${tool_name} on ${mcp_server_url}`);
    console.log(`[JOB-CREATE-DEBUG] Job stored in jobs map:`, JSON.stringify(job, null, 2));
    console.log(`[JOB-CREATE-DEBUG] Jobs map size:`, jobs.size);
    
    // Start background processing (non-blocking)
    console.log(`[JOB-CREATE-DEBUG] Calling setImmediate to process job: ${job_id}`);
    setImmediate(() => {
      console.log(`[JOB-CREATE-DEBUG] setImmediate callback executing for job: ${job_id}`);
      processJobInBackground(job_id);
    });
    
    // Return immediate response
    res.json({
      success: true,
      message: 'Dynamic job queued successfully',
      job_id: job_id,
      result_location: `/results/${job_id}`,
      bearer_token: bearer_token,
      status: 'QUEUED',
      tool_name: tool_name,
      mcp_server_url: mcp_server_url,
      estimated_completion: new Date(Date.now() + 10*60*1000).toISOString(), // 10 min estimate
      created_at: job.created_at,
      expires_at: job.expires_at
    });
    
  } catch (error) {
    console.error('Error queuing dynamic job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue dynamic job',
      message: error.message
    });
  }
});

// Result polling endpoint - Check job status and get results
app.post('/results/:job_id', (req, res) => {
  const { job_id } = req.params;
  const authHeader = req.headers.authorization;
  
  console.log(`POST /results/${job_id}`);
  let job = jobs.get(job_id);
  console.log(`[RESULTS-DEBUG] Job object for ${job_id}:`, JSON.stringify(job, null, 2));
  
  // Validate bearer token format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header',
      message: 'Use: Authorization: Bearer {token}'
    });
  }
  
  const provided_token = authHeader.substring(7); // Remove 'Bearer '
  job = jobs.get(job_id);
  
  // Validate job exists
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
      message: 'Invalid job ID or job has expired'
    });
  }
  
  // Validate bearer token
  if (job.bearer_token !== provided_token) {
    return res.status(401).json({
      success: false,
      error: 'Invalid bearer token',
      message: 'Token does not match job credentials'
    });
  }
  
  // Check if job expired
  if (new Date() > new Date(job.expires_at)) {
    jobs.delete(job_id); // Clean up expired job
    return res.status(410).json({
      success: false,
      error: 'Job expired',
      message: 'Job results are no longer available'
    });
  }

  // Helper to parse SSE/HTTP-wrapped results
  function parseJobResult(rawResult) {
    if (typeof rawResult === 'string') {
      // Handle SSE-wrapped: data: {...}
      const trimmed = rawResult.trim();
      if (trimmed.startsWith('data:')) {
        const dataPart = trimmed.replace(/^data:\s*/, '');
        // Try to parse as JSON
        try {
          const json = JSON.parse(dataPart);
          // If it's a JSON-RPC response, extract .result or .content
          if (json.result !== undefined) return json.result;
          if (json.content !== undefined) return json.content;
          return json;
        } catch (e) {
          // Not JSON, just return the string after 'data:'
          return dataPart;
        }
      }
      // Try to parse as JSON directly
      try {
        const json = JSON.parse(trimmed);
        if (json.result !== undefined) return json.result;
        if (json.content !== undefined) return json.content;
        return json;
      } catch (e) {
        // Not JSON, return as is
        return trimmed;
      }
    }
    // If it's already an object, try to extract .result or .content
    if (rawResult && typeof rawResult === 'object') {
      if (rawResult.result !== undefined) return rawResult.result;
      if (rawResult.content !== undefined) return rawResult.content;
      return rawResult;
    }
    // Otherwise, return as is
    return rawResult;
  }

  // Return appropriate response based on status
  switch (job.status) {
    case 'QUEUED':
      return res.json({
        success: false,
        status: 'QUEUED',
        message: 'Job is queued and waiting to start',
        progress: 'Waiting for processing slot...',
        retry_after: 10,
        job_id: job.job_id,
        tool_name: job.tool_name,
        created_at: job.created_at
      });
      
    case 'PROCESSING':
      return res.json({
        success: false,
        status: 'PROCESSING',
        message: 'Job is currently running',
        progress: 'Executing MCP operation...',
        retry_after: 10,
        job_id: job.job_id,
        tool_name: job.tool_name,
        created_at: job.created_at,
        started_at: job.started_at
      });
      
    case 'COMPLETED':
      const execution_time = job.completed_at && job.started_at ? 
        Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000) : null;
      const cleanResult = parseJobResult(job.result);
      return res.json({
        success: true,
        status: 'COMPLETED',
        result: cleanResult,
        job_id: job.job_id,
        tool_name: job.tool_name,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        execution_time_seconds: execution_time
      });
      
    case 'FAILED': 
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: job.error,
        job_id: job.job_id,
        tool_name: job.tool_name,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        message: 'Job execution failed'
      });
      
    default:
      return res.status(500).json({
        success: false,
        error: 'Unknown job status',
        status: job.status,
        job_id: job.job_id
      });
  }
});

// Alternative GET endpoint for result polling (for compatibility)
app.get('/results/:job_id', (req, res) => {
  // Redirect to POST endpoint for consistency
  req.method = 'POST';
  app.handle(req, res);
});

// Job status endpoint - List all jobs (optional admin endpoint)
app.get('/jobs', (req, res) => {
  console.log('GET /jobs');
  
  const jobList = Array.from(jobs.values()).map(job => ({
    job_id: job.job_id,
    status: job.status,
    tool_name: job.tool_name,
    server_id: job.server_id,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    expires_at: job.expires_at
    // Note: bearer_token is intentionally excluded for security
  }));
  
  res.json({
    total_jobs: jobList.length,
    jobs: jobList
  });
});

// Test endpoint for long-running operations
app.post('/test/timeout/:minutes', (req, res) => {
  const minutes = parseFloat(req.params.minutes);
  const maxMinutes = 95; // Stay under 100 minute limit
  
  if (isNaN(minutes) || minutes < 0.01 || minutes > maxMinutes) {
    return res.status(400).json({ 
      error: `Invalid minutes. Must be between 0.01 and ${maxMinutes}` 
    });
  }
  
  const startTime = Date.now();
  const durationMs = minutes * 60 * 1000;
  
  console.log(`Starting ${minutes}-minute timeout test...`);
  
  setTimeout(() => {
    const actualDuration = Date.now() - startTime;
    console.log(`Timeout test completed after ${actualDuration}ms`);
    
    res.json({
      status: 'completed',
      requested_duration_minutes: minutes,
      actual_duration_ms: actualDuration,
      actual_duration_minutes: Math.round(actualDuration / 60000 * 100) / 100,
      message: `Successfully completed ${minutes}-minute timeout test`,
      timestamp: new Date().toISOString()
    });
  }, durationMs);
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('GET /health');
  
  const servers = Array.from(serverProcesses.entries()).map(([id, info]) => {
    // Create base server info
    const serverInfo = {
      id,
      pid: info.pid,
      initialization_state: serverInitializationState.get(id) || 'unknown'
    };
    
    // Only include risk level information if explicitly set
    if (info.riskLevel !== undefined) {
      serverInfo.risk_level = info.riskLevel;
      serverInfo.risk_description = RISK_LEVEL_DESCRIPTION[info.riskLevel];
      
      if (info.riskLevel === RISK_LEVEL.HIGH) {
        serverInfo.running_in_docker = true;
      }
    }
    
    return serverInfo;
  });
  
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    serverCount: serverProcesses.size,
    servers
  });
});

// Start the server with extended timeouts
const server = app.listen(PORT, async () => {
  console.log(`MCP Bridge server running on port ${PORT}`);
  await initServers();
  console.log('Ready to handle requests');
});

// Configure server timeouts for long-running operations
// Allow requests to run up to Render's 100 minute limit
const MAX_MS = 100 * 60 * 1000;    // 100 minutes in milliseconds

server.setTimeout(MAX_MS);          // max time before socket timeout
server.keepAliveTimeout = MAX_MS;   // max time to keep idle sockets open
server.headersTimeout = MAX_MS;     // must be >= keepAliveTimeout

console.log('Server configured with 100-minute timeout limits (matching Render platform limit)');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down servers...');
  
  const shutdownPromises = [];
  for (const serverId of serverProcesses.keys()) {
    shutdownPromises.push(shutdownServer(serverId));
  }
  
  await Promise.all(shutdownPromises);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down servers...');
  
  const shutdownPromises = [];
  for (const serverId of serverProcesses.keys()) {
    shutdownPromises.push(shutdownServer(serverId));
  }
  
  await Promise.all(shutdownPromises);
  process.exit(0);
});// Server restart trigger - Wed Jun 25 09:55:59 PDT 2025
// Deployment trigger Fri Jun 27 10:26:17 PDT 2025
