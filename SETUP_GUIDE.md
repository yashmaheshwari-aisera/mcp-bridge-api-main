# MCP Bridge API Setup Guide

## ✅ Current Status
- **MCP Bridge Server**: Running successfully on `http://localhost:3000`
- **Filesystem MCP Server**: Connected and working
- **Health Check**: ✅ Passed
- **API Endpoints**: ✅ All working

## 🔌 How to Connect Your Platform to the MCP Bridge API

### 1. REST API Endpoints

The MCP Bridge exposes the following REST endpoints:

#### **Server Management**
```bash
# Get all connected servers
GET /servers

# Add a new MCP server
POST /servers
{
  "id": "my-server",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-example"],
  "riskLevel": 1  // Optional: 1=low, 2=medium, 3=high
}

# Remove a server
DELETE /servers/{serverId}

# Health check
GET /health
```

#### **Tool Operations**
```bash
# List available tools for a server
GET /servers/{serverId}/tools

# Execute a tool
POST /servers/{serverId}/tools/{toolName}
{
  "parameter1": "value1",
  "parameter2": "value2"
}
```

#### **Resource Operations**
```bash
# List available resources
GET /servers/{serverId}/resources

# Read a specific resource
GET /servers/{serverId}/resources/{resourceUri}
```

#### **Prompt Operations**
```bash
# List available prompts
GET /servers/{serverId}/prompts

# Execute a prompt
POST /servers/{serverId}/prompts/{promptName}
{
  "argument1": "value1",
  "argument2": "value2"
}
```

### 2. Example Client Code

#### **Python Example**
```python
import requests
import json

class MCPBridgeClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def get_servers(self):
        response = requests.get(f"{self.base_url}/servers")
        return response.json()
    
    def get_tools(self, server_id):
        response = requests.get(f"{self.base_url}/servers/{server_id}/tools")
        return response.json()
    
    def execute_tool(self, server_id, tool_name, parameters={}):
        response = requests.post(
            f"{self.base_url}/servers/{server_id}/tools/{tool_name}",
            json=parameters
        )
        return response.json()
    
    def health_check(self):
        response = requests.get(f"{self.base_url}/health")
        return response.json()

# Usage
client = MCPBridgeClient()
print("Health:", client.health_check())
print("Servers:", client.get_servers())
print("Tools:", client.get_tools("filesystem"))

# Execute a tool
result = client.execute_tool("filesystem", "list_allowed_directories", {})
print("Allowed directories:", result)
```

#### **JavaScript/Node.js Example**
```javascript
const axios = require('axios');

class MCPBridgeClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }
    
    async getServers() {
        const response = await axios.get(`${this.baseUrl}/servers`);
        return response.data;
    }
    
    async getTools(serverId) {
        const response = await axios.get(`${this.baseUrl}/servers/${serverId}/tools`);
        return response.data;
    }
    
    async executeTool(serverId, toolName, parameters = {}) {
        const response = await axios.post(
            `${this.baseUrl}/servers/${serverId}/tools/${toolName}`,
            parameters
        );
        return response.data;
    }
    
    async healthCheck() {
        const response = await axios.get(`${this.baseUrl}/health`);
        return response.data;
    }
}

// Usage
const client = new MCPBridgeClient();
client.healthCheck().then(console.log);
client.getServers().then(console.log);
```

#### **cURL Examples**
```bash
# Health check
curl http://localhost:3000/health

# Get servers
curl http://localhost:3000/servers

# Get tools for filesystem server
curl http://localhost:3000/servers/filesystem/tools

# Execute a tool
curl -X POST http://localhost:3000/servers/filesystem/tools/list_allowed_directories \
  -H "Content-Type: application/json" \
  -d '{}'

# Create a file
curl -X POST http://localhost:3000/servers/filesystem/tools/write_file \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/Users/yashmaheshwari/mcp-test-directory/test.txt",
    "content": "Hello from MCP Bridge!"
  }'
```

## 🔗 How to Connect Your Existing MCP Server to the Bridge

### Method 1: Configuration File (`mcp_config.json`)

Edit the `mcp_config.json` file to add your MCP server:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
    },
    "your-server": {
      "command": "path/to/your/mcp/server",
      "args": ["--arg1", "value1", "--arg2", "value2"],
      "env": {
        "API_KEY": "your-api-key",
        "CONFIG_PATH": "/path/to/config"
      },
      "riskLevel": 1
    }
  }
}
```

### Method 2: Environment Variables

```bash
# Set your MCP server configuration
export MCP_SERVER_YOURSERVER_COMMAND="python"
export MCP_SERVER_YOURSERVER_ARGS="/path/to/your/server.py,--port,8080"
export MCP_SERVER_YOURSERVER_ENV='{"API_KEY":"your-key"}'
export MCP_SERVER_YOURSERVER_RISK_LEVEL=1
```

### Method 3: Runtime API Call

```bash
curl -X POST http://localhost:3000/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "your-server",
    "command": "python",
    "args": ["/path/to/your/server.py", "--port", "8080"],
    "env": {
      "API_KEY": "your-api-key"
    },
    "riskLevel": 1
  }'
```

### Common MCP Server Types

#### **Python MCP Server**
```json
{
  "python-server": {
    "command": "python",
    "args": ["/path/to/your/mcp_server.py"],
    "env": {
      "PYTHONPATH": "/path/to/dependencies"
    }
  }
}
```

#### **NPM Package MCP Server**
```json
{
  "npm-server": {
    "command": "npx",
    "args": ["-y", "@your-org/your-mcp-server", "--config", "/path/to/config.json"]
  }
}
```

#### **Docker MCP Server (High Risk)**
```json
{
  "docker-server": {
    "command": "docker",
    "args": ["run", "--rm", "-i", "your-mcp-server-image"],
    "riskLevel": 3,
    "docker": {
      "image": "your-mcp-server-image",
      "options": ["--rm", "-i"]
    }
  }
}
```

## 🔐 Security Risk Levels

The MCP Bridge supports 3 risk levels:

- **Level 1 (Low)**: Standard execution
- **Level 2 (Medium)**: Requires user confirmation before execution
- **Level 3 (High)**: Runs in Docker container with isolation

### Handling Confirmations (Medium Risk)

When a tool requires confirmation, the API will return:

```json
{
  "confirmation_required": true,
  "confirmation_id": "uuid-here",
  "tool_info": {
    "name": "dangerous_tool",
    "description": "This tool requires confirmation"
  }
}
```

Confirm the operation:

```bash
curl -X POST http://localhost:3000/confirmations/{confirmation_id} \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

## 🛠️ Testing Your Setup

### 1. Test Current Filesystem Server
```bash
# Test file creation
curl -X POST http://localhost:3000/servers/filesystem/tools/write_file \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/Users/yashmaheshwari/mcp-test-directory/hello.txt",
    "content": "Hello from your MCP Bridge!"
  }'

# Test file reading
curl -X POST http://localhost:3000/servers/filesystem/tools/read_file \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/Users/yashmaheshwari/mcp-test-directory/hello.txt"
  }'
```

### 2. Monitor Server Logs
The MCP Bridge logs all operations. Watch the console where you started `node mcp-bridge.js` for debugging.

### 3. Health Monitoring
```bash
# Regular health check
curl http://localhost:3000/health | jq '.'
```

## 🚀 Next Steps

1. **Add Your MCP Server**: Follow Method 1, 2, or 3 above
2. **Test Your Server**: Use the API endpoints to verify connectivity
3. **Build Your Client**: Use the example code to create your own client
4. **Scale**: Add multiple MCP servers as needed
5. **Secure**: Implement authentication if deploying publicly

## 📞 Getting Help

- Check the MCP Bridge console logs for detailed error messages
- Verify your MCP server runs independently before connecting to the bridge
- Use the `/health` endpoint to monitor system status
- Test individual API endpoints with cURL before building your client 