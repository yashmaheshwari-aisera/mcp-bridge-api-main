# MCP Bridge SSE Timeout Error Analysis & Fix

## 🔍 **Error Analysis**

### **Original Error**
```
SSE error for matallo-server: {
  type: 'error',
  message: 'TypeError: terminated: Body Timeout Error',
  code: undefined,
  defaultPrevented: false,
  cancelable: false,
  timeStamp: 2130424.859705001
}
```

### **Root Cause**
The "Body Timeout Error" occurs when the EventSource connection doesn't receive data within the expected timeframe. This is commonly caused by:

1. **Server-side connection limits**: MCP servers (especially those running on serverless platforms like Cloudflare Workers) may have connection timeout limits
2. **Network instability**: Intermittent network issues causing connection drops
3. **Missing heartbeat mechanism**: No keep-alive mechanism to maintain the connection
4. **Lack of retry logic**: No automatic reconnection when connections fail

## 🏗️ **MCP Bridge Architecture**

### **Overall System Architecture**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Native   │     │     Python      │     │  Other Clients  │
│   MCP Agent     │     │  Gemini Agent   │     │ (Web, Mobile)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ HTTP GET/POST         │ HTTP GET/POST         │ HTTP GET/POST
         │                       │                       │
         └─────────────────────────┬─────────────────────┘
                                   │
                     ┌─────────────────────────┐
                     │    MCP Bridge Server    │
                     │   (Express.js + REST)   │
                     │     Port 3000           │
                     └─────────────────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
          ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐
          │  STDIO MCP  │  │   HTTP MCP      │  │   SSE MCP   │
          │   Servers   │  │   Servers       │  │   Servers   │
          │  (Local)    │  │  (Remote API)   │  │ (Streaming) │
          └─────────────┘  └─────────────────┘  └─────────────┘
                                                       │
                                                ┌─────────────┐
                                                │ EventSource │
                                                │ Connection  │
                                                │+JSON-RPC    │
                                                └─────────────┘
```

### **API Endpoints**

#### **Server Management**
- `GET /health` - System health check with server status
- `GET /servers` - List all connected MCP servers
- `POST /servers` - Add new MCP server dynamically
- `DELETE /servers/:serverId` - Remove MCP server

#### **Tool Execution**
- `GET /servers/:serverId/tools` - List available tools
- `POST /servers/:serverId/tools/:toolName` - Execute tool
- `POST /tool/execute` - Background job execution
- `POST /results/:job_id` - Check job status

#### **Resources & Prompts**
- `GET /servers/:serverId/resources` - List resources
- `GET /servers/:serverId/resources/:resourceUri` - Get resource
- `GET /servers/:serverId/prompts` - List prompts
- `POST /servers/:serverId/prompts/:promptName` - Execute prompt

### **SSE Connection Flow**

```
1. Client Request → MCP Bridge API
2. MCP Bridge → EventSource(`${server_url}/sse`)
3. SSE Stream ← Server (Listen for events)
4. JSON-RPC Request → Server (HTTP POST)
5. Response ← Server (via SSE stream)
6. Parsed Response → Client
```

## 🛠️ **Implemented Solutions**

### **1. Connection Retry Logic**
```javascript
// Configurable retry parameters
const maxRetries = config.sse?.maxRetries || 3;
const retryDelay = config.sse?.retryDelay || 5000; // 5 seconds

// Automatic retry on connection failure
if (retryCount < maxRetries) {
  retryCount++;
  console.log(`Retrying SSE connection (${retryCount}/${maxRetries})...`);
  setTimeout(() => attemptConnection(), retryDelay);
}
```

### **2. Heartbeat Monitoring**
```javascript
// Keep-alive heartbeat every 15 seconds (configurable)
const heartbeatInterval = config.sse?.heartbeatInterval || 15000;

heartbeatIntervalId = setInterval(() => {
  if (eventSource.readyState === EventSource.OPEN) {
    console.log(`SSE heartbeat - connection alive`);
  } else if (eventSource.readyState === EventSource.CLOSED) {
    // Trigger reconnection
    attemptReconnection();
  }
}, heartbeatInterval);
```

### **3. Enhanced Error Handling**
```javascript
eventSource.onerror = (error) => {
  // Specific handling for Body Timeout Error
  if (error.message && error.message.includes('Body Timeout Error')) {
    console.warn('Body timeout detected - server-side connection limits');
    
    // Close and retry connection
    eventSource.close();
    if (retryCount < maxRetries) {
      attemptReconnection();
    }
  }
};
```

### **4. Configurable Connection Parameters**
```json
{
  "mcpServers": {
    "server-name": {
      "type": "sse",
      "url": "https://example.com",
      "sse": {
        "heartbeatInterval": 15000,    // 15 second heartbeat
        "maxRetries": 3,               // 3 retry attempts
        "retryDelay": 5000,           // 5 second retry delay
        "heartbeatTimeout": 30000     // 30 second timeout
      }
    }
  }
}
```

### **5. Graceful Cleanup**
```javascript
// Proper resource cleanup on shutdown
if (serverInfo.eventSource) {
  serverInfo.eventSource.close();
  
  if (serverInfo.heartbeatInterval) {
    clearInterval(serverInfo.heartbeatInterval);
  }
}
```

## 🧪 **Testing & Verification**

### **Test Script Usage**
```bash
# Run comprehensive tests
node test_sse_connection.js test

# Monitor connections continuously
node test_sse_connection.js monitor
```

### **Test Coverage**
1. **Server Health Check** - Verify all SSE servers are connected
2. **Tool Listing** - Test API endpoints for each SSE server
3. **Connection Resilience** - Multiple rapid requests to test stability
4. **Timeout Handling** - Extended operations to test timeout recovery
5. **Real-time Monitoring** - Continuous health monitoring

## 🚀 **Deployment & Usage**

### **1. Update Configuration**
Update your `mcp_config.json` with SSE-specific parameters:
```json
{
  "mcpServers": {
    "your-server": {
      "type": "sse",
      "url": "https://your-mcp-server.com",
      "riskLevel": 1,
      "sse": {
        "heartbeatInterval": 15000,
        "maxRetries": 3,
        "retryDelay": 5000,
        "heartbeatTimeout": 30000
      }
    }
  }
}
```

### **2. Restart MCP Bridge**
```bash
# Stop existing instance
pkill -f "node mcp-bridge.js"

# Start with new configuration
node mcp-bridge.js
```

### **3. Verify Fixes**
```bash
# Run test suite
node test_sse_connection.js

# Check logs for improved error handling
tail -f /path/to/your/logs
```

## 📊 **Expected Improvements**

### **Before Fix**
- ❌ SSE connections failing with "Body Timeout Error"
- ❌ No automatic recovery from connection drops
- ❌ Manual intervention required for failed connections
- ❌ Poor visibility into connection health

### **After Fix**
- ✅ Automatic retry logic for failed connections
- ✅ Heartbeat monitoring to detect issues early
- ✅ Graceful handling of timeout errors
- ✅ Configurable connection parameters
- ✅ Better logging and error visibility
- ✅ Improved connection stability under load

## 🔧 **Configuration Options**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `heartbeatInterval` | 15000ms | Frequency of connection health checks |
| `maxRetries` | 3 | Maximum connection retry attempts |
| `retryDelay` | 5000ms | Delay between retry attempts |
| `heartbeatTimeout` | 30000ms | Timeout for heartbeat responses |

## 🐛 **Troubleshooting**

### **Still Getting Timeout Errors?**
1. **Increase retry attempts**: Set `maxRetries` to 5-10
2. **Reduce heartbeat frequency**: Increase `heartbeatInterval` to 30000ms
3. **Check server logs**: Look for patterns in timeout occurrences
4. **Network diagnostics**: Test connection stability to SSE servers

### **High Resource Usage?**
1. **Increase heartbeat interval**: Reduce connection check frequency
2. **Reduce retry attempts**: Lower `maxRetries` if connections are stable
3. **Monitor server metrics**: Check CPU/memory usage patterns

### **Connection Still Unstable?**
1. **Check SSE server health**: Verify the MCP server itself is stable
2. **Network diagnostics**: Test network stability between bridge and servers
3. **Consider fallback**: Implement HTTP fallback for unstable SSE connections

## 📚 **Additional Resources**

- [EventSource MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

---

**Key Takeaway**: The SSE timeout errors were caused by lack of connection resilience. The implemented solutions provide automatic retry logic, heartbeat monitoring, and configurable parameters to handle various network conditions and server limitations. 