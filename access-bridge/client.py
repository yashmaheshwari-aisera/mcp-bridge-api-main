#!/usr/bin/env python3
"""
MCP Bridge API Client
Demonstrates how to interact with the deployed MCP Bridge API
"""

import requests
import json
import os
from typing import Dict, Any, Optional

# Configuration - Update this with your deployed Render URL
BASE_URL = os.getenv('MCP_BRIDGE_URL', 'http://localhost:3000')

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
    
    def list_tools(self, server_name: Optional[str] = None) -> Dict[str, Any]:
        """List available tools"""
        url = f"{self.base_url}/tools"
        if server_name:
            url += f"?server={server_name}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def execute_tool(self, tool_name: str, arguments: Dict[str, Any], server_name: Optional[str] = None) -> Dict[str, Any]:
        """Execute a tool with given arguments"""
        url = f"{self.base_url}/tools/{tool_name}"
        if server_name:
            url += f"?server={server_name}"
        
        response = self.session.post(
            url,
            json=arguments,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        return response.json()

def main():
    """Demo the MCP Bridge API client"""
    
    # Check if we have a custom URL
    if BASE_URL == 'http://localhost:3000':
        print("🔧 Using local development server")
        print("💡 To use deployed service, set environment variable:")
        print("   export MCP_BRIDGE_URL=https://your-render-url.onrender.com")
        print()
    else:
        print(f"🌐 Using deployed service: {BASE_URL}")
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
        servers = client.list_servers()
        for server in servers['servers']:
            print(f"📡 {server['id']} - {server['initialization_state']} (Risk: {server['risk_level']})")
        print()
        
        # 3. List Tools
        print("3️⃣ Available Tools...")
        tools = client.list_tools()
        for tool in tools['tools']:
            print(f"🔧 {tool['name']}: {tool['description']}")
        print()
        
        # 4. Execute Math Operations
        print("4️⃣ Testing Math Operations...")
        
        # Addition
        result = client.execute_tool('add', {'a': 15, 'b': 27})
        print(f"➕ 15 + 27 = {result['content'][0]['text']}")
        
        # Subtraction
        result = client.execute_tool('subtract', {'a': 50, 'b': 23})
        print(f"➖ 50 - 23 = {result['content'][0]['text']}")
        
        # Multiplication
        result = client.execute_tool('multiply', {'a': 8, 'b': 7})
        print(f"✖️  8 × 7 = {result['content'][0]['text']}")
        
        # Division
        result = client.execute_tool('divide', {'a': 100, 'b': 4})
        print(f"➗ 100 ÷ 4 = {result['content'][0]['text']}")
        
        print()
        print("🎉 All tests completed successfully!")
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to {BASE_URL}")
        print("💡 Make sure the MCP Bridge is running and the URL is correct")
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
        print(f"Response: {e.response.text if e.response else 'No response'}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main() 