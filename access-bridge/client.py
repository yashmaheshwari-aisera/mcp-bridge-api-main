#!/usr/bin/env python3
"""
MCP Bridge API Client
Demonstrates how to interact with the deployed MCP Bridge API
"""

import requests
import json
import os
from typing import Dict, Any, Optional

# Configuration - Your deployed Render URL
BASE_URL = os.getenv('MCP_BRIDGE_URL', 'https://mcp-bridge-api-main.onrender.com')

class MCPBridgeClient:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
    def health_check(self) -> Dict[str, Any]:
        """Check if the MCP Bridge is healthy"""
        response = self.session.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def list_servers(self) -> Dict[str, Any]:
        """List all connected MCP servers"""
        response = self.session.get(f"{self.base_url}/servers")
        response.raise_for_status()
        return response.json()
    
    def list_tools(self, server_id: str) -> Dict[str, Any]:
        """List available tools for a specific server"""
        response = self.session.get(f"{self.base_url}/servers/{server_id}/tools")
        response.raise_for_status()
        return response.json()
    
    def execute_tool(self, server_id: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool with given arguments on a specific server"""
        response = self.session.post(
            f"{self.base_url}/servers/{server_id}/tools/{tool_name}",
            json=arguments,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        return response.json()

def main():
    """Demo the MCP Bridge API client"""
    
    print(f"🌐 Using deployed MCP Bridge: {BASE_URL}")
    print("💡 To use a different URL, set: export MCP_BRIDGE_URL=https://your-url.com")
    print()
    
    client = MCPBridgeClient()
    
    try:
        # 1. Health Check
        print("1️⃣ Health Check...")
        health = client.health_check()
        print(f"✅ Status: {health['status']}")
        print(f"⏱️  Uptime: {health['uptime']:.2f}s")
        print(f"🔗 Servers: {health['serverCount']}")
        print()
        
        # 2. List Servers
        print("2️⃣ Connected Servers...")
        servers_response = client.list_servers()
        servers = servers_response['servers']
        
        if not servers:
            print("❌ No servers connected")
            return
            
        for server in servers:
            print(f"📡 {server['id']} - {server['initialization_state']} (Risk: {server['risk_level']})")
        
        # Use the first server for testing
        server_id = servers[0]['id']
        print(f"\n🎯 Using server: {server_id}")
        print()
        
        # 3. List Tools
        print("3️⃣ Available Tools...")
        tools_response = client.list_tools(server_id)
        tools = tools_response['tools']
        
        for tool in tools:
            print(f"🔧 {tool['name']}: {tool['description']}")
        print()
        
        # 4. Execute Math Operations
        print("4️⃣ Testing Math Operations...")
        
        # Addition
        result = client.execute_tool(server_id, 'add', {'a': 15, 'b': 27})
        add_result = json.loads(result['content'][0]['text'])
        print(f"➕ 15 + 27 = {add_result['result']}")
        
        # Subtraction
        result = client.execute_tool(server_id, 'subtract', {'a': 50, 'b': 23})
        sub_result = json.loads(result['content'][0]['text'])
        print(f"➖ 50 - 23 = {sub_result['result']}")
        
        # Multiplication
        result = client.execute_tool(server_id, 'multiply', {'a': 8, 'b': 7})
        mul_result = json.loads(result['content'][0]['text'])
        print(f"✖️  8 × 7 = {mul_result['result']}")
        
        # Division
        result = client.execute_tool(server_id, 'divide', {'a': 100, 'b': 4})
        div_result = json.loads(result['content'][0]['text'])
        print(f"➗ 100 ÷ 4 = {div_result['result']}")
        
        print()
        print("🎉 All tests completed successfully!")
        print(f"🚀 Your MCP Bridge at {BASE_URL} is working perfectly!")
        print("📊 The bridge successfully connects to the MCP server and executes tools!")
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to {BASE_URL}")
        print("💡 Make sure the MCP Bridge is running and the URL is correct")
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
        print(f"Response: {e.response.text if e.response else 'No response'}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
        print("💡 The response format might have changed")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main() 