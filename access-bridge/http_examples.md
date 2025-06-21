# Pure HTTP Examples - Use MCP Bridge from ANY Language

Your MCP Bridge works with simple HTTP requests - no special libraries needed!

## 🔥 cURL Examples

```bash
# Check if bridge is working
curl https://mcp-bridge-api-main.onrender.com/health

# See what tools are available
curl https://mcp-bridge-api-main.onrender.com/servers/math-server/tools

# Do math operations
curl -X POST https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/add \
  -H "Content-Type: application/json" \
  -d '{"a": 15, "b": 25}'

curl -X POST https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/power \
  -H "Content-Type: application/json" \
  -d '{"base": 2, "exponent": 10}'
```

## 🟨 JavaScript/Node.js

```javascript
// Simple function to call MCP tools
async function callMCP(tool, args) {
    const response = await fetch(
        `https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/${tool}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        }
    );
    const result = await response.json();
    return JSON.parse(result.content[0].text);
}

// Use it in your code
const sum = await callMCP('add', {a: 10, b: 5});
console.log(sum.result); // 15
```

## 🐹 Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func callMCP(tool string, args map[string]interface{}) (map[string]interface{}, error) {
    url := fmt.Sprintf("https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/%s", tool)
    
    jsonData, _ := json.Marshal(args)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    
    // Parse the MCP response
    content := result["content"].([]interface{})[0].(map[string]interface{})
    var mcpResult map[string]interface{}
    json.Unmarshal([]byte(content["text"].(string)), &mcpResult)
    
    return mcpResult, nil
}

// Usage
result, _ := callMCP("multiply", map[string]interface{}{"a": 7, "b": 8})
fmt.Println(result["result"]) // 56
```

## 🦀 Rust

```rust
use reqwest;
use serde_json::{json, Value};

async fn call_mcp(tool: &str, args: Value) -> Result<Value, Box<dyn std::error::Error>> {
    let url = format!("https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/{}", tool);
    
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&args)
        .send()
        .await?;
    
    let result: Value = response.json().await?;
    let content_text = result["content"][0]["text"].as_str().unwrap();
    let mcp_result: Value = serde_json::from_str(content_text)?;
    
    Ok(mcp_result)
}

// Usage
let result = call_mcp("add", json!({"a": 20, "b": 22})).await?;
println!("{}", result["result"]); // 42
```

## 🐍 Python (without our client)

```python
import requests
import json

def call_mcp(tool, args):
    url = f"https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/{tool}"
    response = requests.post(url, json=args)
    result = response.json()
    return json.loads(result['content'][0]['text'])

# Usage
result = call_mcp('power', {'base': 3, 'exponent': 4})
print(result['result'])  # 81
```

## 🌐 Any HTTP Client

The pattern is always the same:

1. **POST** to: `https://mcp-bridge-api-main.onrender.com/servers/math-server/tools/{TOOL_NAME}`
2. **Headers**: `Content-Type: application/json`
3. **Body**: JSON with the tool arguments
4. **Parse**: The result is in `response.content[0].text` (as JSON string)

## 🔄 Works with ANY MCP Server

Just change `math-server` to any other server ID in the URL. The bridge automatically:
- Discovers available tools
- Handles different argument formats  
- Returns results in a consistent format

Your bridge is **completely generic** - it will work with any MCP server you connect to it! 