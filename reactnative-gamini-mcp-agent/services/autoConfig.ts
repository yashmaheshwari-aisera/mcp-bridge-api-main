// Auto-generated configuration loader
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default configuration values - these are only used as initial defaults
const DEFAULT_CONFIG = {
  geminiApiKey: '', // No default API key - must be configured by user
  mcpBridgeUrl: process.env.EXPO_PUBLIC_MCP_BRIDGE_URL || 'http://localhost:3000', 
  geminiModelName: process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash'
};

export const loadConfiguration = async () => {
  try {
    console.log('📱 Loading configuration...');
    
    // Check if already configured
    const isConfigured = await AsyncStorage.getItem('initialConfigLoaded');
    if (isConfigured === 'true') {
      console.log('✅ App already has initial configuration');
      
      // Verify the values are actually there
      const existingApiKey = await AsyncStorage.getItem('geminiApiKey');
      const existingBridgeUrl = await AsyncStorage.getItem('mcpBridgeUrl');
      const existingModel = await AsyncStorage.getItem('geminiModelName');
      
      console.log('🔍 Verifying existing configuration:');
      console.log(`   API Key: ${existingApiKey ? 'SET' : 'MISSING - User must configure'}`);
      console.log(`   Bridge URL: ${existingBridgeUrl ? 'SET' : 'MISSING'}`);
      console.log(`   Model: ${existingModel ? 'SET' : 'MISSING'}`);
      
      // If URL or model are missing, re-set them (but not API key - user must set that)
      if (!existingBridgeUrl || !existingModel) {
        console.log('⚠️ Some configuration missing, re-setting non-sensitive defaults...');
        await setNonSensitiveDefaults();
      }
      
      return true;
    }

    // Set initial defaults (non-sensitive only)
    await setNonSensitiveDefaults();
    
    // Mark that initial configuration has been loaded
    await AsyncStorage.setItem('initialConfigLoaded', 'true');
    
    console.log('✅ Initial configuration loaded');
    console.log('🔑 User must configure API key in Settings tab');
    return true;
  } catch (error) {
    console.error('❌ Initial configuration failed:', error);
    return false;
  }
};

// Set only non-sensitive default values
const setNonSensitiveDefaults = async () => {
  try {
    // Never set a default API key - user must configure this
    await AsyncStorage.setItem('mcpBridgeUrl', DEFAULT_CONFIG.mcpBridgeUrl);
    console.log('📝 Set default MCP Bridge URL');
    
    await AsyncStorage.setItem('geminiModelName', DEFAULT_CONFIG.geminiModelName);
    console.log('📝 Set default Gemini model');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to set defaults:', error);
    return false;
  }
};

// Helper to get current configuration values (for debugging)
export const getCurrentConfig = async () => {
  try {
    const config = {
      geminiApiKey: await AsyncStorage.getItem('geminiApiKey'),
      mcpBridgeUrl: await AsyncStorage.getItem('mcpBridgeUrl'),
      geminiModelName: await AsyncStorage.getItem('geminiModelName')
    };
    console.log('📋 Current configuration:', {
      ...config,
      geminiApiKey: config.geminiApiKey ? `${config.geminiApiKey.substring(0, 10)}...` : 'Not configured'
    });
    return config;
  } catch (error) {
    console.error('❌ Failed to get current configuration:', error);
    return null;
  }
};

// Check if app is properly configured
export const isAppConfigured = async () => {
  try {
    console.log('🔍 DEBUGGING: Checking if app is configured...');
    
    const apiKey = await AsyncStorage.getItem('geminiApiKey');
    const bridgeUrl = await AsyncStorage.getItem('mcpBridgeUrl');
    
    console.log('🔍 DEBUGGING: Raw values from storage:');
    console.log(`   API Key: ${apiKey ? `${apiKey.substring(0, 15)}...` : 'NULL/UNDEFINED'}`);
    console.log(`   Bridge URL: ${bridgeUrl ? bridgeUrl : 'NULL/UNDEFINED'}`);
    
    // Check API key
    const hasApiKey = !!(apiKey && apiKey.trim());
    const apiKeyValid = hasApiKey && apiKey.trim().startsWith('AIzaSy');
    
    // Check bridge URL  
    const hasBridgeUrl = !!(bridgeUrl && bridgeUrl.trim());
    
    console.log('🔍 DEBUGGING: Validation results:');
    console.log(`   Has API Key: ${hasApiKey}`);
    console.log(`   API Key Valid Format: ${apiKeyValid}`);
    console.log(`   Has Bridge URL: ${hasBridgeUrl}`);
    
    const configured = apiKeyValid && hasBridgeUrl;
    
    console.log(`🔍 DEBUGGING: Final result: ${configured ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
    
    if (!configured) {
      console.log('❌ DEBUGGING: Configuration failed because:');
      if (!hasApiKey) console.log('   - API key is missing or empty');
      if (!apiKeyValid) console.log('   - API key does not start with AIzaSy');
      if (!hasBridgeUrl) console.log('   - Bridge URL is missing or empty');
    }
    
    return configured;
  } catch (error) {
    console.error('❌ DEBUGGING: Failed to check configuration:', error);
    return false;
  }
};

// Reset to defaults (for development/testing)
export const resetToDefaults = async () => {
  try {
    await setNonSensitiveDefaults();
    // Clear the API key - user must set it again
    await AsyncStorage.removeItem('geminiApiKey');
    await AsyncStorage.removeItem('initialConfigLoaded');
    console.log('🔄 Reset to default configuration (API key cleared)');
    return true;
  } catch (error) {
    console.error('❌ Failed to reset configuration:', error);
    return false;
  }
};

// Force immediate configuration (for troubleshooting)
export const forceLoadConfiguration = async () => {
  try {
    console.log('🚨 FORCE LOADING CONFIGURATION...');
    
    // Remove the flag so it re-loads
    await AsyncStorage.removeItem('initialConfigLoaded');
    
    // Force set non-sensitive defaults only
    await setNonSensitiveDefaults();
    
    // Set the flag
    await AsyncStorage.setItem('initialConfigLoaded', 'true');
    
    // Verify it worked
    const verification = await getCurrentConfig();
    
    console.log('✅ FORCE LOAD COMPLETE');
    return verification;
  } catch (error) {
    console.error('❌ FORCE LOAD FAILED:', error);
    return null;
  }
};

// Force set configuration immediately (non-sensitive only) so UI doesn't crash if values are missing
export const forceSetConfigurationNow = async (): Promise<boolean> => {
  try {
    console.log('🔧 DEBUGGING: forceSetConfigurationNow called');
    // Ensure non-sensitive defaults exist
    await setNonSensitiveDefaults();
    // Do NOT set API key – user controls that
    return true;
  } catch (error) {
    console.error('❌ DEBUGGING: forceSetConfigurationNow failed:', error);
    return false;
  }
};
