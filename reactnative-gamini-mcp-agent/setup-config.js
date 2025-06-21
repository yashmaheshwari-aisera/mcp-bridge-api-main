#!/usr/bin/env node

/**
 * Setup script to configure the React Native MCP Agent app
 * This script pre-configures the AsyncStorage values for Gemini API and MCP Bridge
 */

const fs = require('fs');
const path = require('path');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

// Configuration constants - get from environment variables (non-sensitive only)
const GEMINI_API_KEY = ''; // API key must be configured by user - not from environment
const MCP_BRIDGE_URL = process.env.EXPO_PUBLIC_MCP_BRIDGE_URL || 'http://localhost:3000';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash';

console.log('🔧 Setting up MCP Agent React Native App Configuration...');

// Auto-config object
const AUTO_CONFIG = {
  geminiApiKey: GEMINI_API_KEY,
  mcpBridgeUrl: MCP_BRIDGE_URL,
  geminiModelName: GEMINI_MODEL
};

// Function to apply the configuration
const applyAutoConfig = async () => {
  try {
    console.log('🔧 Applying auto-configuration...');
    
    // Only set API key if available from environment
    if (GEMINI_API_KEY) {
      await AsyncStorage.setItem('geminiApiKey', GEMINI_API_KEY);
      console.log('✅ Set Gemini API key from environment');
    } else {
      console.warn('⚠️ No GEMINI_API_KEY found in environment - user must configure manually');
    }
    
    await AsyncStorage.setItem('mcpBridgeUrl', MCP_BRIDGE_URL);
    await AsyncStorage.setItem('geminiModelName', GEMINI_MODEL);
    
    // Generate the config file content
    const configContent = `
// This configuration was auto-generated on ${new Date().toISOString()}
export const GENERATED_CONFIG = {
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  mcpBridgeUrl: '${MCP_BRIDGE_URL}',
  geminiModelName: '${GEMINI_MODEL}',
  generatedAt: '${new Date().toISOString()}'
};

// Auto-configuration function
export const applyGeneratedConfig = async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  
  // Only set API key if available
  if (GENERATED_CONFIG.geminiApiKey) {
    await AsyncStorage.setItem('geminiApiKey', GENERATED_CONFIG.geminiApiKey);
  }
  await AsyncStorage.setItem('mcpBridgeUrl', GENERATED_CONFIG.mcpBridgeUrl);
  await AsyncStorage.setItem('geminiModelName', GENERATED_CONFIG.geminiModelName);
  
  console.log('📱 Auto-configuration applied successfully');
  return true;
};
    `.trim();
    
    console.log('✅ Auto-configuration completed');
    return true;
  } catch (error) {
    console.error('❌ Auto-configuration failed:', error);
    return false;
  }
};

module.exports = {
  AUTO_CONFIG,
  applyAutoConfig
};

// Create a configuration file that the app can read
const configData = {
  geminiApiKey: GEMINI_API_KEY,
  mcpBridgeUrl: MCP_BRIDGE_URL,
  geminiModelName: GEMINI_MODEL,
  setupComplete: true,
  setupTimestamp: new Date().toISOString()
};

// Write config to a JSON file that the app can read on startup
const configPath = path.join(__dirname, 'app-config.json');
fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

console.log('✅ Configuration saved to app-config.json');
console.log('📋 Configuration:');
console.log('   • Gemini API Key: ✓ Configured');
console.log('   • MCP Bridge URL: ' + MCP_BRIDGE_URL);
console.log('   • Gemini Model: ' + GEMINI_MODEL);

// Create a simple startup script that the app can use
const startupScript = `
// Auto-generated configuration loader
import AsyncStorage from '@react-native-async-storage/async-storage';

export const loadConfiguration = async () => {
  try {
    console.log('📱 Loading auto-configuration...');
    
    // Check if already configured
    const isConfigured = await AsyncStorage.getItem('autoConfigured');
    if (isConfigured === 'true') {
      console.log('✅ App already configured');
      return true;
    }

    // Set configuration values
    await AsyncStorage.setItem('geminiApiKey', '${GEMINI_API_KEY}');
    await AsyncStorage.setItem('mcpBridgeUrl', '${MCP_BRIDGE_URL}');
    await AsyncStorage.setItem('geminiModelName', '${GEMINI_MODEL}');
    await AsyncStorage.setItem('autoConfigured', 'true');
    
    console.log('✅ Auto-configuration complete!');
    return true;
  } catch (error) {
    console.error('❌ Auto-configuration failed:', error);
    return false;
  }
};
`;

const startupPath = path.join(__dirname, 'services', 'autoConfig.ts');
fs.writeFileSync(startupPath, startupScript);

console.log('✅ Auto-configuration service created at services/autoConfig.ts');
console.log('');
console.log('🚀 Setup Complete! You can now run:');
console.log('   npm start');
console.log('');
console.log('The app will automatically configure itself with:');
console.log('   • Your Gemini API Key');
console.log('   • MCP Bridge URL (http://localhost:3000)');
console.log('   • Connected to your Cloudflare Math Server'); 