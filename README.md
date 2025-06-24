# MCP Bridge API

## A Lightweight, LLM-Agnostic RESTful Proxy for Model Context Protocol Servers

<img src="./screenshot.png" alt="MCP Bridge Mobile Interface" width="650"/>

*Figure: The React Native MCP Agent interface showing the chat screen with tool execution results (left) and the settings screen with MCP Bridge connection status and Gemini API configuration (right)*

**Authors:**  
Arash Ahmadi, Sarah S. Sharif, and Yaser M. Banad*  
School of Electrical, and Computer Engineering, University of Oklahoma, Oklahoma, United States  
*Corresponding author: bana@ou.edu

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![arXiv](https://img.shields.io/badge/arXiv-2504.08999-b31b1b.svg)](https://arxiv.org/abs/2504.08999)

## 🎉 Quick Start - System Ready!

**Your MCP Bridge system is fully operational and configured!**

### 🚀 Start Using the System

```bash
# Terminal 1: Start MCP Bridge
node mcp-bridge.js

# Terminal 2: Start React Native App
cd reactnative-gamini-mcp-agent
npm start
```

**Features Ready:**
- ✅ **React Native App**: Beautiful mobile interface with Gemini AI integration
- ✅ **MCP Bridge Server**: Running on `http://localhost:3000`
- ✅ **Cloudflare Math Server**: 18 mathematical operations available
- ✅ **User-Configurable Settings**: Everything configurable through the mobile UI
- ✅ **Production Deployment**: Available at `https://mcp-bridge-api-main.onrender.com`

## 📚 Introduction

MCP Bridge is a lightweight, fast, and LLM-agnostic proxy that connects to multiple Model Context Protocol (MCP) servers and exposes their capabilities through a unified REST API. It enables any client on any platform to leverage MCP functionality without process execution constraints.

### ⚠️ The Problem We Solve

- Many MCP servers use STDIO transports requiring local process execution
- Edge devices, mobile devices, web browsers cannot efficiently run npm or Python MCP servers
- Direct MCP server connections are impractical in resource-constrained environments
- Multiple isolated clients connecting to the same servers causes redundancy

### 🏗️ Our Solution

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Native   │     │     Python      │     │  Other Clients  │
│   MCP Agent     │     │  Gemini Agent   │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         │                       ▼                       │
         │           ┌───────────────────────┐          │
         └──────────►│      REST API         │◄─────────┘
                     │                       │
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │     MCP Bridge        │
                     │                       │
                     └───────────┬───────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               ▼
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
        │  MCP Server │  │  MCP Server │  │  MCP Server │
        │   (STDIO)   │  │    (HTTP)   │  │    (SSE)    │
        └─────────────┘  └─────────────┘  └─────────────┘
```

## 🔧 Installation & Setup

### 📦 Prerequisites

- Node.js 18+ for MCP Bridge
- Python 3.8+ for Python clients
- React Native development environment for mobile app

### ⚡ Quick Installation

#### 1. MCP Bridge Server

```bash
# Install dependencies
npm install

# Start the server
node mcp-bridge.js
```

#### 2. React Native Mobile App

```bash
# Navigate to the React Native app directory
cd reactnative-gamini-mcp-agent

# Install dependencies
npm install

# Start the development server
npx expo start
```

#### 3. Python Client Examples (Optional)

```bash
# Install requests (only dependency needed)
pip install requests

# Run basic example
cd access-bridge && python basic_example.py

# Run advanced example
python advanced_example.py
```

## 📱 React Native MCP Agent

The React Native MCP Agent is a modern, cross-platform mobile application that provides intuitive access to MCP tools through a clean, user-friendly interface.

### ✨ Key Features

- **Cross-Platform**: Runs on iOS, Android, and web platforms
- **Intelligent Chat Interface**: Natural language interaction with AI-powered tool selection
- **Real-Time Tool Execution**: Visual feedback for MCP tool calls
- **User-Configurable Settings**: Configure everything through the UI
- **Conversation Management**: Persistent chat history with AI-generated titles
- **Modern UI/UX**: Dark theme with glassmorphism effects
- **Security Integration**: Built-in support for risk-level confirmation workflows
- **Multi-Model Support**: Compatible with various Gemini models

### 🎛️ Smart Configuration

The app includes intelligent default configuration while allowing full user customization:

- **Default Gemini API Key**: Pre-loaded for convenience
- **Default MCP Bridge URL**: `http://localhost:3000`
- **Visual Indicators**: Clear badges showing "Default" vs "Custom" settings
- **Configuration Banner**: Appears when using default values
- **One-Click Reset**: Return to original defaults anytime

### 🔄 Configuration Flow

```
User Updates Settings → AsyncStorage → Services Use Updated Values → Real-time UI Updates
```

## 🐍 Python MCP-Gemini Agent

A command-line client for desktop environments featuring:

- **Multi-step reasoning**: Supports sequenced tool calls for complex operations
- **Security confirmation flow**: Integrated handling for risk-based operations
- **Flexible JSON display**: Control verbosity for better readability
- **Configurable connection**: Connect to any MCP Bridge instance

### Usage Examples

```bash
# Basic usage
python llm_test.py

# Hide JSON results for cleaner output
python llm_test.py --hide-json

# Connect to custom MCP Bridge server
python llm_test.py --mcp-url http://192.168.1.100:3000
```

## 🌉 MCP Bridge Server

The core server component that bridges HTTP requests to MCP protocol:

### 🛡️ Risk-Based Security System

```javascript
const RISK_LEVEL = {
  LOW: 1,      // Standard execution
  MEDIUM: 2,   // Requires user confirmation  
  HIGH: 3      // Docker isolation required
};
```

### 📡 REST API Endpoints

```bash
# Server Management
GET    /health                           # System health check
GET    /servers                          # List all connected servers
POST   /servers                          # Add new server dynamically
DELETE /servers/:serverId                # Remove server

# Tool Operations
GET    /servers/:serverId/tools          # List available tools
POST   /servers/:serverId/tools/:toolName # Execute tool

# Resource & Prompt Operations
GET    /servers/:serverId/resources      # List resources
GET    /servers/:serverId/prompts        # List prompts
POST   /servers/:serverId/prompts/:name  # Execute prompt

# Security
POST   /confirmations/:confirmationId    # Confirm risky operations

# Postman Collection Generation
POST   /generate-postman                 # Generate Postman collection from MCP server
```

## 🔧 Postman Collection Generator

The MCP Bridge API includes a powerful `/generate-postman` endpoint that automatically discovers MCP server capabilities and generates ready-to-use Postman collections. This enables seamless integration with workflow automation platforms like Aisera.

### ✨ Key Features

- **Automatic Discovery**: Connects to any MCP server and discovers all tools, resources, and prompts
- **Multiple Transport Support**: Works with HTTP/SSE and stdio MCP servers
- **Complete Collection Generation**: Creates organized folders, request templates, and documentation
- **Smart Parameter Handling**: Generates example values and Postman variables
- **Authentication Support**: Includes bearer token authentication for secure connections
- **Aisera Integration Ready**: Perfect for workflow automation platform integration

### 🚀 Usage Examples

#### HTTP/SSE MCP Server
```bash
curl -X POST https://mcp-bridge-api-main.onrender.com/generate-postman \
  -H "Content-Type: application/json" \
  -d '{
    "serverUrl": "https://your-mcp-server.com",
    "serverType": "http",
    "authToken": "your-auth-token"
  }'
```

#### stdio MCP Server
```bash
curl -X POST https://mcp-bridge-api-main.onrender.com/generate-postman \
  -H "Content-Type: application/json" \
  -d '{
    "serverCommand": "npx",
    "serverArgs": ["@modelcontextprotocol/server-filesystem", "/safe/directory"],
    "serverEnv": {
      "DEBUG": "true"
    }
  }'
```

### 📋 Generated Collection Structure

The generated Postman collection includes:

- **Tools Folder**: Individual requests for each MCP tool with parameter templates
- **Resources Folder**: Requests to read available MCP resources
- **Prompts Folder**: Requests to execute MCP prompts with arguments
- **General Operations**: Standard MCP protocol operations (list tools, resources, prompts)
- **Environment Variables**: Pre-configured variables for server URL and authentication
- **Documentation**: Comprehensive descriptions extracted from MCP tool metadata

### 🔄 Aisera Integration Workflow

1. **User Input**: Aisera user provides their MCP server URL
2. **API Call**: Aisera calls `/generate-postman` with server details
3. **Discovery**: API connects and discovers all server capabilities
4. **Generation**: Complete Postman collection is generated with all tools
5. **Download**: User receives ready-to-import collection JSON file
6. **Integration**: Collection is uploaded to Aisera for immediate use

### 📝 Response Format

```json
{
  "success": true,
  "collection": {
    "info": {
      "name": "MCP Server: your-server.com",
      "description": "Auto-generated collection...",
      "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "item": [...],
    "variable": [...]
  },
  "metadata": {
    "serverUrl": "https://your-server.com",
    "toolsCount": 15,
    "resourcesCount": 8,
    "promptsCount": 3,
    "generatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### 🧪 Testing

Run the test script to see the generator in action:

```bash
python test_postman_generator.py
```

## 🧮 Cloudflare Math Server Integration

Your system includes a powerful math server with **18 mathematical functions**:

### Basic Arithmetic
- `add`, `subtract`, `multiply`, `divide`

### Advanced Mathematics
- `power`, `square_root`, `factorial`, `exp`

### Trigonometry
- `sin`, `cos`, `tan`

### Logarithms
- `log`, `ln`

### Algebra & Geometry
- `quadratic`, `distance`

### Statistics
- `mean`, `median`

### Complex Numbers
- `complex_add`

### Example Usage

```bash
# Basic math operation
curl -X POST http://localhost:3000/servers/math-server/tools/add \
  -H "Content-Type: application/json" \
  -d '{"a": 15, "b": 27}'

# Advanced operation
curl -X POST http://localhost:3000/servers/math-server/tools/quadratic \
  -H "Content-Type: application/json" \
  -d '{"a": 1, "b": -5, "c": 6}'
```

## ⚙️ Configuration

### Environment Variables

Create `.env` file in the root directory:

```bash
GEMINI_API_KEY=your_actual_gemini_api_key_here
MCP_SERVER_URL=https://mcp-proxy.yashmahe2021.workers.dev/mcp
PORT=3000
```

Create `.env.local` in the React Native directory:

```bash
EXPO_PUBLIC_GEMINI_API_KEY=your_actual_gemini_api_key_here
EXPO_PUBLIC_MCP_BRIDGE_URL=http://localhost:3000
EXPO_PUBLIC_GEMINI_MODEL=gemini-1.5-flash
```

### Server Configuration (`mcp_config.json`)

```json
{
  "mcpServers": {
    "math-server": {
      "type": "http",
      "url": "${MCP_SERVER_URL}",
      "description": "Cloudflare-hosted math MCP server"
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/safe/directory"]
    }
  }
}
```

## 🚀 Production Deployment

Your MCP Bridge is deployed and accessible at:
**https://mcp-bridge-api-main.onrender.com**

### Deployment Features

- ✅ **Docker Container**: Scalable, reproducible deployment
- ✅ **GitHub Integration**: Automatic deployments on code changes
- ✅ **HTTPS Security**: Secure connections
- ✅ **24/7 Availability**: Always accessible
- ✅ **Health Monitoring**: Built-in status checks

### Using the Deployed API

```bash
# Health check
curl https://mcp-bridge-api-main.onrender.com/health

# Execute operations
curl -X POST https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/add \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 5}'
```

## 🛠️ Client Examples

### Python Client

```python
import requests

class MCPBridgeClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def execute_tool(self, server_id, tool_name, parameters={}):
        response = requests.post(
            f"{self.base_url}/servers/{server_id}/tools/{tool_name}",
            json=parameters
        )
        return response.json()

# Usage
client = MCPBridgeClient()
result = client.execute_tool("math-server", "add", {"a": 10, "b": 5})
print(f"Result: {result}")
```

### JavaScript Client

```javascript
class MCPBridgeClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }
    
    async executeTool(serverId, toolName, parameters = {}) {
        const response = await fetch(
            `${this.baseUrl}/servers/${serverId}/tools/${toolName}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parameters)
            }
        );
        return response.json();
    }
}
```

## 🔒 Security Features

- **Environment Variable Support**: No hardcoded credentials
- **Risk-Based Execution**: Three-tier security model
- **Docker Isolation**: High-risk operations run in containers
- **User Confirmation**: Medium/high-risk operations require approval
- **HTTPS Support**: Secure communications
- **Input Validation**: Comprehensive parameter checking

## 📊 Project Structure

```
mcp-bridge-api-main/
├── mcp-bridge.js                 # Core MCP Bridge server
├── mcp_config.json              # Server configuration
├── package.json                 # Node.js dependencies
├── Dockerfile                   # Container configuration
├── reactnative-gamini-mcp-agent/ # Mobile app
│   ├── app/                     # React Native screens
│   ├── components/              # UI components
│   ├── services/                # API and configuration services
│   └── types/                   # TypeScript definitions
├── access-bridge/               # Python client examples
│   ├── basic_example.py        # Simple API integration example
│   └── advanced_example.py     # Complex mathematical operations demo
└── TECHNICAL_DOCS.md           # Detailed technical documentation
```

## 🎯 Use Cases

1. **Mathematical APIs**: Expose powerful math via REST
2. **AI-Powered Calculators**: Natural language math with LLMs
3. **Educational Tools**: Interactive learning applications
4. **Scientific Computing**: Complex calculations in workflows
5. **Cross-Platform Math**: Access from any HTTP-capable device
6. **Mobile Applications**: Native mobile interfaces for MCP tools
7. **Serverless Computing**: Leverage cloud infrastructure

## 🚨 Troubleshooting

### Common Issues

1. **MCP Bridge won't start**: Check environment variables in `.env`
2. **React Native build fails**: Ensure all dependencies are installed
3. **API calls failing**: Verify MCP Bridge is running on port 3000
4. **Math operations failing**: Check Cloudflare worker is accessible
5. **Mobile app crashes**: Check `.env.local` has required variables

### Getting Help

- Check logs with `node mcp-bridge.js` for server issues
- Use `/health` endpoint to verify system status
- Test with `curl` commands before using client libraries
- Verify environment variables are properly loaded

## 🔮 Next Steps

### Immediate Actions
- ✅ Your system is ready to use right now!
- ✅ Try the mobile app by running `npx expo start`
- ✅ Test with the Python clients in `access-bridge/`

### Future Enhancements
- Add more MCP servers to the configuration
- Implement API authentication and rate limiting
- Create monitoring dashboard
- Build client libraries for other languages
- Add more AI models beyond Gemini

## 📄 Citation

If you use this project in your research, please cite:

```bibtex
@article{ahmadi2025mcp,
  title={MCP Bridge: A Lightweight, LLM-Agnostic RESTful Proxy for Model Context Protocol Servers},
  author={Ahmadi, Arash and Sharif, Sarah and Banad, Yaser M},
  journal={arXiv preprint arXiv:2504.08999},
  year={2025}
}
```

## 📞 Support

- **GitHub Repository**: https://github.com/yashmaheshwari-aisera/mcp-bridge-api-main
- **Live API**: https://mcp-bridge-api-main.onrender.com
- **License**: MIT
- **Status**: ✅ PRODUCTION READY

---

**🎉 Your MCP Bridge system is fully operational and ready for production use!** 

The combination of the intelligent React Native mobile app, robust MCP Bridge server, and comprehensive Python clients creates a powerful ecosystem for building sophisticated LLM-powered applications with MCP tool integration.
