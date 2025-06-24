#!/usr/bin/env node

/**
 * MCP Bridge - RESTful Proxy for Model Context Protocol Servers
 * A lightweight, LLM-agnostic proxy that connects to multiple MCP servers
 * and exposes their capabilities through a unified REST API.
 */

// Import dependencies
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const EventSource = require('eventsource');
const axios = require('axios');

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
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

console.log('Middleware configured');

// Server state
const serverProcesses = new Map(); // Map of server IDs to processes
const pendingConfirmations = new Map(); // Map of request IDs to pending confirmations
const serverInitializationState = new Map(); // Track initialization state of servers

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
              timeout: 30000
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
            timeout: 30000
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

// Start an SSE-based MCP server
async function startSSEServer(serverId, config) {
  console.log(`Starting SSE MCP server: ${serverId} at ${config.url}`);
  
  const riskLevel = config.riskLevel || 1; // Default to low risk for SSE servers
  
  return new Promise((resolve, reject) => {
    try {
      // Create EventSource connection
      const eventSource = new EventSource(`${config.url}/sse`);
      
      let initialized = false;
      const messageQueue = [];
      let responseHandlers = new Map();
      
      // Store the SSE connection with server info
      const sseServer = {
        eventSource,
        riskLevel,
        pid: 'sse-' + Date.now(), // Fake PID for SSE connections
        config,
        type: 'sse',
        url: config.url,
        messageQueue,
        responseHandlers,
        
        // Method to send requests to SSE server
        sendRequest: async (method, params = {}) => {
          const requestId = uuidv4();
          const request = {
            jsonrpc: "2.0",
            id: requestId,
            method: method,
            params: params
          };
          
          try {
            // Send request via HTTP POST to the server (try both endpoints)
            let response;
            try {
              response = await axios.post(`${config.url}/mcp`, request, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // Try the root endpoint
                response = await axios.post(config.url, request, {
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
              } else {
                throw error;
              }
            }
            
            return response.data;
          } catch (error) {
            console.error(`Error sending request to SSE server ${serverId}:`, error.message);
            throw error;
          }
        }
      };
      
      // Store the server
      serverProcesses.set(serverId, sseServer);
      serverInitializationState.set(serverId, 'starting');
      
      eventSource.onopen = () => {
        console.log(`SSE connection opened for ${serverId}`);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[${serverId}] SSE message:`, data);
          
          if (data.id && responseHandlers.has(data.id)) {
            const handler = responseHandlers.get(data.id);
            handler(data);
            responseHandlers.delete(data.id);
          }
        } catch (error) {
          console.error(`Error parsing SSE message from ${serverId}:`, error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error(`SSE error for ${serverId}:`, error);
        if (!initialized) {
          reject(new Error(`Failed to connect to SSE server at ${config.url}`));
        }
      };
      
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
          
          let response;
          try {
            response = await axios.post(`${config.url}/mcp`, initRequest, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
          } catch (error) {
            if (error.response && error.response.status === 404) {
              // Try the root endpoint
              response = await axios.post(config.url, initRequest, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });
            } else {
              throw error;
            }
          }
          
          if (response.data && response.data.result) {
            console.log(`SSE server ${serverId} initialized successfully`);
            serverInitializationState.set(serverId, 'initialized');
            initialized = true;
            resolve(sseServer);
          } else {
            throw new Error('Invalid initialization response');
          }
        } catch (error) {
          console.error(`Failed to initialize SSE server ${serverId}:`, error.message);
          if (!initialized) {
            reject(error);
          }
        }
      }, 1000); // Wait a second for SSE connection to stabilize
      
    } catch (error) {
      console.error(`Error starting SSE server ${serverId}:`, error);
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
  // Handle HTTP-based servers differently
  if (config.type === 'http') {
    return startHTTPServer(serverId, config);
  }
  
  // Handle SSE-based servers differently
  if (config.type === 'sse') {
    return startSSEServer(serverId, config);
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
    // Handle HTTP servers differently
    if (serverInfo.type === 'http') {
      console.log(`Disconnecting HTTP server ${serverId}`);
      // HTTP servers don't need special cleanup
    }
    // Handle SSE servers differently
    else if (serverInfo.type === 'sse') {
      try {
        console.log(`Closing SSE connection for ${serverId}`);
        if (serverInfo.eventSource) {
          serverInfo.eventSource.close();
        }
      } catch (error) {
        console.error(`Error closing SSE connection for ${serverId}: ${error.message}`);
      }
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
  
  // Clean up initialization state
  serverInitializationState.delete(serverId);
  
  console.log(`Server ${serverId} shutdown complete`);
}

// MCP request handler
async function sendMCPRequest(serverId, method, params = {}, confirmationId = null) {
  const serverInfo = serverProcesses.get(serverId);
  
  if (!serverInfo) {
    throw new Error(`Server '${serverId}' not found or not connected`);
  }
  
  // Handle HTTP servers differently
  if (serverInfo.type === 'http') {
    try {
      console.log(`Sending HTTP request to ${serverId}: ${method}`, params);
      const response = await serverInfo.sendRequest(method, params);
      
      if (response.error) {
        throw new Error(response.error.message || 'Unknown error from HTTP server');
      }
      
      return response.result || response;
    } catch (error) {
      console.error(`Error sending HTTP request to ${serverId}:`, error);
      throw error;
    }
  }
  
  // Handle SSE servers differently
  if (serverInfo.type === 'sse') {
    try {
      console.log(`Sending SSE request to ${serverId}: ${method}`, params);
      const response = await serverInfo.sendRequest(method, params);
      
      if (response.error) {
        throw new Error(response.error.message || 'Unknown error from SSE server');
      }
      
      return response.result || response;
    } catch (error) {
      console.error(`Error sending SSE request to ${serverId}:`, error);
      throw error;
    }
  }
  
  return new Promise((resolve, reject) => {
    if (!serverInfo) {
      return reject(new Error(`Server '${serverId}' not found or not connected`));
    }
    
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
    
    const { process: serverProcess, riskLevel, config } = serverInfo;
    
    // Only perform risk level checks if explicitly configured (for backward compatibility)
    if (riskLevel !== undefined && riskLevel === RISK_LEVEL.MEDIUM && method === 'tools/call' && !confirmationId) {
      // Generate a confirmation ID for this request
      const pendingId = uuidv4();
      console.log(`Medium risk level request for ${serverId}/${method} - requires confirmation (ID: ${pendingId})`);
      
      // Store the pending confirmation
      pendingConfirmations.set(pendingId, {
        serverId,
        method,
        params,
        timestamp: Date.now()
      });
      
      // Return a response that requires confirmation
      return resolve({
        requires_confirmation: true,
        confirmation_id: pendingId,
        risk_level: riskLevel,
        risk_description: RISK_LEVEL_DESCRIPTION[riskLevel],
        server_id: serverId,
        method,
        tool_name: params.name,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      });
    }
    
    const requestId = uuidv4();
    
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params
    };
    
    console.log(`Sending request to ${serverId}: ${method}`, params);
    
    // Set up one-time response handler
    const messageHandler = (data) => {
      try {
        const responseText = data.toString();
        // Handle potential multiline responses by properly joining and parsing
        let parsedResponse = null;
        let jsonError = null;
        
        try {
          // First try to parse the entire response as a single JSON object
          parsedResponse = JSON.parse(responseText);
        } catch (e) {
          // If that fails, try to split by lines and parse each line
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
              console.error(`Error parsing JSON line from ${serverId}:`, lineError);
            }
          }
        }
            
        if (parsedResponse && parsedResponse.id === requestId) {
              console.log(`Received response from ${serverId} for request ${requestId}`);
              
              // Remove handler after response is received
              serverProcess.stdout.removeListener('data', messageHandler);
              
          if (parsedResponse.error) {
            return reject(new Error(parsedResponse.error.message || 'Unknown error'));
              }
              
              // For high risk level, add information about docker execution (only if risk level is explicitly set)
              if (riskLevel !== undefined && riskLevel === RISK_LEVEL.HIGH) {
            const result = parsedResponse.result || {};
                return resolve({
                  ...result,
                  execution_environment: {
                    risk_level: riskLevel,
                    risk_description: RISK_LEVEL_DESCRIPTION[riskLevel],
                    docker: true,
                    docker_image: config.docker?.image || 'unknown'
                  }
                });
              }
              
          return resolve(parsedResponse.result);
        } else if (jsonError) {
          // If we couldn't parse any JSON and have an error, handle it gracefully
          console.error(`Failed to parse JSON response from ${serverId}`);
          // Clean up
          serverProcess.stdout.removeListener('data', messageHandler);
          
          // Provide a clean error response
          return reject(new Error(`Invalid response format from MCP server: ${jsonError.message}`));
        }
      } catch (error) {
        console.error(`Error processing response from ${serverId}:`, error);
        // Clean up
        serverProcess.stdout.removeListener('data', messageHandler);
        return reject(new Error(`Error processing response: ${error.message}`));
      }
    };
    
    // Add temporary response handler
    serverProcess.stdout.on('data', messageHandler);
    
    // Set a timeout for the request
    const timeout = setTimeout(() => {
      serverProcess.stdout.removeListener('data', messageHandler);
      reject(new Error(`Request to ${serverId} timed out after 10 seconds`));
    }, 10000);
    
    // Send the request
    try {
      serverProcess.stdin.write(JSON.stringify(request) + '\n');
    } catch (error) {
      clearTimeout(timeout);
      serverProcess.stdout.removeListener('data', messageHandler);
      reject(new Error(`Failed to send request to ${serverId}: ${error.message}`));
      return;
    }
    
    // Handle error case
    const errorHandler = (error) => {
      clearTimeout(timeout);
      serverProcess.stdout.removeListener('data', messageHandler);
      serverProcess.removeListener('error', errorHandler);
      reject(error);
    };
    
    serverProcess.once('error', errorHandler);
    
    // Clean up error handler when request completes
    const originalResolve = resolve;
    const originalReject = reject;
    
    resolve = (value) => {
      clearTimeout(timeout);
      serverProcess.removeListener('error', errorHandler);
      originalResolve(value);
    };
    
    reject = (error) => {
      clearTimeout(timeout);
      serverProcess.removeListener('error', errorHandler);
      originalReject(error);
    };
  });
}

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
    const { id, command, args, env, riskLevel, docker } = req.body;
    
    if (!id || !command) {
      console.log('Missing required fields');
      return res.status(400).json({
        error: "Server ID and command are required"
      });
    }
    
    if (serverProcesses.has(id)) {
      console.log(`Server with ID '${id}' already exists`);
      return res.status(409).json({
        error: `Server with ID '${id}' already exists`
      });
    }
    
    // Validate risk level if provided
    if (riskLevel !== undefined) {
      if (![RISK_LEVEL.LOW, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH].includes(riskLevel)) {
        return res.status(400).json({
          error: `Invalid risk level: ${riskLevel}. Valid values are: ${RISK_LEVEL.LOW} (low), ${RISK_LEVEL.MEDIUM} (medium), ${RISK_LEVEL.HIGH} (high)`
        });
      }
      
      // For high risk level, docker config is required
      if (riskLevel === RISK_LEVEL.HIGH && (!docker || !docker.image)) {
        return res.status(400).json({
          error: "Docker configuration with 'image' property is required for high risk level servers"
        });
      }
    }
    
    // Create the configuration object - only include riskLevel if explicitly set
    const config = { 
      command, 
      args: args || [], 
      env: env || {}
    };
    
    // Only add risk level if explicitly provided
    if (riskLevel !== undefined) {
      config.riskLevel = riskLevel;
      
      // Add docker config if provided for high risk levels
      if (riskLevel === RISK_LEVEL.HIGH && docker) {
        config.docker = docker;
      }
    }
    
    console.log(`Starting server '${id}' with config:`, config);
    await startServer(id, config);
    
    const serverInfo = serverProcesses.get(id);
    console.log(`Server '${id}' started successfully`);
    
    // Create response object
    const response = {
      id,
      status: "connected",
      pid: serverInfo.pid
    };
    
    // Only include risk level information if explicitly set
    if (serverInfo.riskLevel !== undefined) {
      response.risk_level = serverInfo.riskLevel;
      response.risk_description = RISK_LEVEL_DESCRIPTION[serverInfo.riskLevel];
      
      if (serverInfo.riskLevel === RISK_LEVEL.HIGH) {
        response.running_in_docker = true;
      }
    }
    
    res.status(201).json(response);
  } catch (error) {
    console.error(`Error starting server: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

// Stop a server
app.delete('/servers/:serverId', async (req, res) => {
  const { serverId } = req.params;
  console.log(`DELETE /servers/${serverId}`);
  
  if (!serverProcesses.has(serverId)) {
    console.log(`Server '${serverId}' not found`);
    return res.status(404).json({
      error: `Server '${serverId}' not found`
    });
  }
  
  try {
    console.log(`Shutting down server '${serverId}'`);
    await shutdownServer(serverId);
    console.log(`Server '${serverId}' shutdown complete`);
    res.json({
      status: "disconnected"
    });
  } catch (error) {
    console.error(`Error stopping server ${serverId}: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
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
    
    // Get risk level information for the response
    const riskLevel = serverInfo.riskLevel;
    
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
      // Return the parsed result
    res.json(result);
    } catch (jsonError) {
      console.error(`Error stringifying result for tool ${toolName}:`, jsonError);
      // If JSON serialization fails, return a clean error
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
      
      console.log('Postman collection generated successfully');
      
      res.json({
        success: true,
        collection: postmanCollection,
        metadata: {
          serverUrl: serverUrl || serverCommand,
          toolsCount: tools.length,
          resourcesCount: resources.length,
          promptsCount: prompts.length,
          generatedAt: new Date().toISOString()
        }
      });
      
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
  const baseUrl = serverConfig.url || '{{mcp_server_url}}';
  
  // Collection info
  const collection = {
    info: {
      name: collectionName,
      description: `Auto-generated Postman collection for MCP server: ${serverIdentifier}\n\nGenerated on: ${new Date().toISOString()}\n\nThis collection contains all discovered tools, resources, and prompts from the MCP server.`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [],
    variable: [
      {
        key: "mcp_server_url",
        value: serverConfig.url || "http://localhost:3000",
        description: "Base URL for the MCP server"
      }
    ]
  };
  
  // Add auth token variable if provided
  if (serverConfig.authToken) {
    collection.variable.push({
      key: "auth_token",
      value: serverConfig.authToken,
      description: "Authentication token for the MCP server"
    });
  }
  
  // Generate Tools folder
  if (tools.length > 0) {
    const toolsFolder = {
      name: "Tools",
      description: `MCP Tools (${tools.length} available)`,
      item: tools.map(tool => generateToolRequest(tool, baseUrl))
    };
    collection.item.push(toolsFolder);
  }
  
  // Generate Resources folder
  if (resources.length > 0) {
    const resourcesFolder = {
      name: "Resources",
      description: `MCP Resources (${resources.length} available)`,
      item: resources.map(resource => generateResourceRequest(resource, baseUrl))
    };
    collection.item.push(resourcesFolder);
  }
  
  // Generate Prompts folder
  if (prompts.length > 0) {
    const promptsFolder = {
      name: "Prompts",
      description: `MCP Prompts (${prompts.length} available)`,
      item: prompts.map(prompt => generatePromptRequest(prompt, baseUrl))
    };
    collection.item.push(promptsFolder);
  }
  
  // Add general MCP operations folder
  const generalFolder = {
    name: "General MCP Operations",
    description: "Standard MCP protocol operations",
    item: [
      {
        name: "List All Tools",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json" },
            ...(serverConfig.authToken ? [{ key: "Authorization", value: "Bearer {{auth_token}}" }] : [])
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/list"
            }, null, 2)
          },
          url: {
            raw: `${baseUrl}/mcp`,
            host: [baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
            path: ["mcp"]
          },
          description: "List all available tools on the MCP server"
        }
      },
      {
        name: "List All Resources",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json" },
            ...(serverConfig.authToken ? [{ key: "Authorization", value: "Bearer {{auth_token}}" }] : [])
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "resources/list"
            }, null, 2)
          },
          url: {
            raw: `${baseUrl}/mcp`,
            host: [baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
            path: ["mcp"]
          },
          description: "List all available resources on the MCP server"
        }
      },
      {
        name: "List All Prompts",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json" },
            ...(serverConfig.authToken ? [{ key: "Authorization", value: "Bearer {{auth_token}}" }] : [])
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({
              jsonrpc: "2.0",
              id: 3,
              method: "prompts/list"
            }, null, 2)
          },
          url: {
            raw: `${baseUrl}/mcp`,
            host: [baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
            path: ["mcp"]
          },
          description: "List all available prompts on the MCP server"
        }
      }
    ]
  };
  collection.item.push(generalFolder);
  
  return collection;
}

// Helper function to generate tool request
function generateToolRequest(tool, baseUrl) {
  const parameters = generateExampleParameters(tool.inputSchema);
  
  return {
    name: tool.name,
    request: {
      method: "POST",
      header: [
        { key: "Content-Type", value: "application/json" },
        { key: "Authorization", value: "Bearer {{auth_token}}", disabled: true }
      ],
      body: {
        mode: "raw",
        raw: JSON.stringify({
          jsonrpc: "2.0",
          id: `{{$randomInt}}`,
          method: "tools/call",
          params: {
            name: tool.name,
            arguments: parameters
          }
        }, null, 2)
      },
      url: {
        raw: `${baseUrl}/mcp`,
        host: [baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
        path: ["mcp"]
      },
      description: `${tool.description || 'No description available'}\n\nTool: ${tool.name}\n\n${generateParameterDocumentation(tool.inputSchema)}`
    }
  };
}

// Helper function to generate resource request
function generateResourceRequest(resource, baseUrl) {
  return {
    name: resource.name || resource.uri,
    request: {
      method: "POST",
      header: [
        { key: "Content-Type", value: "application/json" },
        { key: "Authorization", value: "Bearer {{auth_token}}", disabled: true }
      ],
      body: {
        mode: "raw",
        raw: JSON.stringify({
          jsonrpc: "2.0",
          id: `{{$randomInt}}`,
          method: "resources/read",
          params: {
            uri: resource.uri
          }
        }, null, 2)
      },
      url: {
        raw: `${baseUrl}/mcp`,
        host: [baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
        path: ["mcp"]
      },
      description: `${resource.description || 'No description available'}\n\nResource URI: ${resource.uri}\n\nMime Type: ${resource.mimeType || 'Unknown'}`
    }
  };
}

// Helper function to generate prompt request
function generatePromptRequest(prompt, baseUrl) {
  const arguments = generateExampleArguments(prompt.arguments);
  
  return {
    name: prompt.name,
    request: {
      method: "POST",
      header: [
        { key: "Content-Type", value: "application/json" },
        { key: "Authorization", value: "Bearer {{auth_token}}", disabled: true }
      ],
      body: {
        mode: "raw",
        raw: JSON.stringify({
          jsonrpc: "2.0",
          id: `{{$randomInt}}`,
          method: "prompts/get",
          params: {
            name: prompt.name,
            arguments: arguments
          }
        }, null, 2)
      },
      url: {
        raw: `${baseUrl}/mcp`,
        host: [baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
        path: ["mcp"]
      },
      description: `${prompt.description || 'No description available'}\n\nPrompt: ${prompt.name}\n\n${generateArgumentDocumentation(prompt.arguments)}`
    }
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
});