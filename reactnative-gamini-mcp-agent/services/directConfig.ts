// Direct configuration - bypasses AsyncStorage loading issues
import AsyncStorage from '@react-native-async-storage/async-storage';

// Direct configuration values for immediate use (fallback when AsyncStorage isn't ready)
const DIRECT_CONFIG = {
  // API key must be configured by user - never use public environment variables for secrets
  geminiApiKey: '',
  mcpBridgeUrl: process.env.EXPO_PUBLIC_MCP_BRIDGE_URL || 'http://localhost:3000',
  geminiModelName: process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash'
};

// Get configuration directly
export const getDirectConfig = () => {
  return DIRECT_CONFIG;
};

// Check if basic configuration is available (non-sensitive parts)
export const hasBasicConfig = () => {
  return !!(DIRECT_CONFIG.mcpBridgeUrl && DIRECT_CONFIG.geminiModelName);
};

// Force set configuration if not already present (non-sensitive only)
export const forceSetConfigurationNow = async () => {
  try {
    console.log('🔧 Force setting configuration...');
    
    // Check what we have in AsyncStorage
    const existingBridgeUrl = await AsyncStorage.getItem('mcpBridgeUrl');
    const existingModel = await AsyncStorage.getItem('geminiModelName');
    
    let updated = false;
    
    // Set bridge URL if missing
    if (!existingBridgeUrl && DIRECT_CONFIG.mcpBridgeUrl) {
      await AsyncStorage.setItem('mcpBridgeUrl', DIRECT_CONFIG.mcpBridgeUrl);
      console.log('📝 Set MCP Bridge URL from direct config');
      updated = true;
    }
    
    // Set model if missing
    if (!existingModel && DIRECT_CONFIG.geminiModelName) {
      await AsyncStorage.setItem('geminiModelName', DIRECT_CONFIG.geminiModelName);
      console.log('📝 Set Gemini model from direct config');
      updated = true;
    }
    
    // Never automatically set API key - user must configure this
    const existingApiKey = await AsyncStorage.getItem('geminiApiKey');
    if (!existingApiKey) {
      console.log('🔑 API key missing - user must configure in Settings');
    }
    
    console.log(`🔧 Force configuration complete (updated: ${updated})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to force set configuration:', error);
    return false;
  }
};

export default DIRECT_CONFIG; 