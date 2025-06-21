# Environment Variables Setup

This document explains how to securely configure credentials for the MCP Bridge API.

## 🔐 Security Updates

The codebase has been updated to remove hardcoded credentials. All sensitive values now come from environment variables or user configuration.

## 📋 Required Environment Variables

### 1. Create .env file in the root directory:

```bash
# MCP Bridge Configuration
# Copy this content to a new .env file and fill in your actual values

# Gemini API Key - Get from Google AI Studio (https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# MCP Server URL - Your Cloudflare Worker or other MCP server endpoint  
MCP_SERVER_URL=https://your-mcp-server.workers.dev/mcp

# Optional: Customize other settings
PORT=3000
NODE_ENV=development
```

### 2. For React Native app configuration:

```bash
# Only non-sensitive environment variables for React Native
# Create .env.local in the root directory:

# MCP Bridge URL (not sensitive - can be public)
EXPO_PUBLIC_MCP_BRIDGE_URL=http://localhost:3000

# Gemini Model (not sensitive - can be public)  
EXPO_PUBLIC_GEMINI_MODEL=gemini-1.5-flash

# ⚠️ DO NOT PUT API KEYS IN EXPO_PUBLIC_* VARIABLES
# These are bundled into the client and visible to users!
```

## 🔒 React Native Security Approach

**Important:** React Native/Expo apps handle sensitive data differently than server-side code:

### ❌ **What NOT to do:**
- Never use `EXPO_PUBLIC_GEMINI_API_KEY` - this makes your API key visible to anyone
- `EXPO_PUBLIC_*` variables are bundled into the client code and are **public**
- API keys in client-side code can be extracted by users

### ✅ **What TO do:**
- **API keys must be configured by users** through the app's Settings tab
- API keys are stored securely in the device's AsyncStorage
- Only non-sensitive configuration uses `EXPO_PUBLIC_*` variables

## 🚀 Quick Setup

1. **Get your Gemini API Key:**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key (starts with `AIzaSy...`)

2. **For MCP Bridge server, create .env file:**
   ```bash
   # In the root directory
   echo "GEMINI_API_KEY=your_actual_api_key_here" > .env
   echo "MCP_SERVER_URL=https://mcp-proxy.yashmahe2021.workers.dev/mcp" >> .env
   ```

3. **For React Native app:**
   - The app will prompt you to configure your API key on first launch
   - Go to Settings tab and enter your Gemini API key
   - The MCP Bridge URL will be set automatically to localhost:3000

4. **Start the services:**
   ```bash
   # Start MCP Bridge (loads from .env)
   node mcp-bridge.js
   
   # Start React Native app
   cd reactnative-gamini-mcp-agent && npx expo start
   ```

## 🛡️ Security Improvements Made

### ✅ What was changed:
- Removed all hardcoded API keys from source code
- Updated MCP Bridge to use environment variable substitution
- **Removed insecure `EXPO_PUBLIC_GEMINI_API_KEY` usage**
- Modified React Native app to require user configuration of API keys
- Added proper API key validation and error handling
- Updated configuration files to use secure patterns

### ✅ Files updated:
- `mcp-bridge.js` - Added environment variable support
- `mcp_config.json` - Uses `${MCP_SERVER_URL}` placeholder
- `reactnative-gamini-mcp-agent/services/autoConfig.ts` - No API key defaults
- `reactnative-gamini-mcp-agent/services/directConfig.ts` - Removed public API key variables
- `reactnative-gamini-mcp-agent/services/gemini.ts` - Better error handling
- `reactnative-gamini-mcp-agent/components/Settings.tsx` - Updated validation
- `reactnative-gamini-mcp-agent/components/ChatComponent.tsx` - Better config checking

## ⚠️ Important Notes

1. **Never commit .env files to version control**
2. **Add .env and .env.local to your .gitignore**
3. **Each developer needs their own API key**
4. **For production, use secure secret management**
5. **React Native users must configure API keys manually in the app**

## 🔧 Verification

After setting up environment variables, verify they work:

```bash
# Test MCP Bridge
node -e "require('dotenv').config(); console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'MISSING');"

# Start the bridge
node mcp-bridge.js
```

For React Native, the app will show configuration prompts if API keys are missing.

## 🚨 Troubleshooting

- **Error: "Environment variable MCP_SERVER_URL is not set"**
  - Add `MCP_SERVER_URL=https://your-server.com` to your .env file

- **Error: "No GEMINI_API_KEY found"**
  - For MCP Bridge: Add `GEMINI_API_KEY=your_key_here` to your .env file
  - For React Native: Configure API key in the Settings tab

- **React Native app says "Configuration Required"**
  - This is normal and secure behavior
  - Open the Settings tab and enter your Gemini API key
  - The app will save it securely on your device

- **Why can't I use EXPO_PUBLIC_GEMINI_API_KEY?**
  - `EXPO_PUBLIC_*` variables are embedded in the client bundle
  - This makes API keys visible to anyone who inspects the app
  - It's a security vulnerability that could lead to API abuse

## 🎯 Summary

- **Server-side (MCP Bridge)**: Uses `.env` file with `GEMINI_API_KEY`
- **Client-side (React Native)**: Users configure API keys through the UI
- **Public variables**: Only use `EXPO_PUBLIC_*` for non-sensitive configuration
- **Security**: API keys are never embedded in client code 