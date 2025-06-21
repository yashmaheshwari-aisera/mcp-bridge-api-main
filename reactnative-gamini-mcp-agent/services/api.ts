import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create axios instance for MCP Bridge API
const mcpApi = axios.create();

// Helper function to normalize URL (remove trailing slash)
const normalizeUrl = (url: string): string => {
  if (!url) return url;
  return url.replace(/\/$/, ''); // Remove trailing slash if present
};

// Interceptor to set the base URL from storage
mcpApi.interceptors.request.use(async (config) => {
  let baseUrl = await AsyncStorage.getItem('mcpBridgeUrl');
  
  // FALLBACK: If AsyncStorage fails, use localhost MCP Bridge
  if (!baseUrl) {
    baseUrl = 'http://localhost:3000';
    console.log('🚨 Using fallback MCP Bridge URL:', baseUrl);
  }
  
  // Normalize the URL (remove trailing slash)
  baseUrl = normalizeUrl(baseUrl);
  console.log('🔍 DEBUG: Normalized MCP Bridge URL:', baseUrl);
  
  config.baseURL = baseUrl;
  return config;
});

// MCP Bridge API methods
export const mcpBridgeAPI = {
  // Set base URL for MCP Bridge API
  setBaseUrl: async (url: string) => {
    const normalizedUrl = normalizeUrl(url);
    console.log('🔍 DEBUG: Setting MCP Bridge URL:', normalizedUrl);
    await AsyncStorage.setItem('mcpBridgeUrl', normalizedUrl);
    return normalizedUrl;
  },

  // Get base URL for MCP Bridge API
  getBaseUrl: async () => {
    const url = await AsyncStorage.getItem('mcpBridgeUrl');
    const normalizedUrl = normalizeUrl(url || 'http://localhost:3000');
    console.log('🔍 DEBUG: Getting MCP Bridge URL:', normalizedUrl);
    return normalizedUrl;
  },

  // Check health of MCP Bridge
  checkHealth: async () => {
    try {
      console.log('🔍 DEBUG: Checking MCP Bridge health...');
      const response = await mcpApi.get('/health');
      console.log('🔍 DEBUG: Health check response:', response.status, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ DEBUG: Health check failed:', error);
      throw error;
    }
  },

  // Get all servers
  getServers: async () => {
    try {
      console.log('🔍 DEBUG: Getting servers...');
      const response = await mcpApi.get('/servers');
      console.log('🔍 DEBUG: Servers response:', response.status, response.data);
      return response.data.servers;
    } catch (error) {
      console.error('❌ DEBUG: Failed to get servers:', error);
      throw error;
    }
  },

  // Get all tools for a server
  getTools: async (serverId: string) => {
    try {
      console.log(`🔍 DEBUG: Getting tools for server ${serverId}...`);
      const response = await mcpApi.get(`/servers/${serverId}/tools`);
      console.log(`🔍 DEBUG: Tools response for ${serverId}:`, response.status, response.data);
      return response.data.tools;
    } catch (error) {
      console.error(`❌ DEBUG: Failed to get tools for server ${serverId}:`, error);
      throw error;
    }
  },

  // Execute a tool
  executeTool: async (serverId: string, toolName: string, parameters: any) => {
    try {
      console.log(`🔍 DEBUG: Executing tool ${toolName} on ${serverId}...`);
      const response = await mcpApi.post(`/servers/${serverId}/tools/${toolName}`, parameters);
      console.log(`🔍 DEBUG: Tool execution response:`, response.status, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ DEBUG: Failed to execute tool ${toolName}:`, error);
      throw error;
    }
  },

  // Confirm an operation (for medium risk level)
  confirmOperation: async (confirmationId: string, confirm: boolean) => {
    try {
      console.log(`🔍 DEBUG: Confirming operation ${confirmationId}: ${confirm}`);
      const response = await mcpApi.post(`/confirmations/${confirmationId}`, { confirm });
      console.log(`🔍 DEBUG: Confirmation response:`, response.status, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ DEBUG: Failed to confirm operation ${confirmationId}:`, error);
      throw error;
    }
  }
}; 