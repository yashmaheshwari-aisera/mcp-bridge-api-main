#!/usr/bin/env python3
"""
Simple MCP Bridge Client - Easy API Integration
Just basic functions to call your deployed MCP Bridge
"""

import requests
import json

# Your deployed MCP Bridge URL
BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"

def call_mcp_tool(tool_name, arguments, server_id="math-server"):
    """
    Simple function to call any MCP tool
    
    Args:
        tool_name: Name of the tool (e.g., 'add', 'multiply')
        arguments: Dict of arguments (e.g., {'a': 5, 'b': 3})
        server_id: Which MCP server to use (default: 'math-server')
    
    Returns:
        The result from the MCP tool
    """
    url = f"{BRIDGE_URL}/servers/{server_id}/tools/{tool_name}"
    response = requests.post(url, json=arguments)
    response.raise_for_status()
    
    # Parse the MCP response and extract the actual result
    mcp_response = response.json()
    result_text = mcp_response['content'][0]['text']
    return json.loads(result_text)

def get_available_tools(server_id="math-server"):
    """Get list of available tools from the MCP server"""
    url = f"{BRIDGE_URL}/servers/{server_id}/tools"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()['tools']

def health_check():
    """Check if the bridge is working"""
    response = requests.get(f"{BRIDGE_URL}/health")
    response.raise_for_status()
    return response.json()

# Example usage
if __name__ == "__main__":
    print("🚀 Simple MCP Bridge Test")
    
    # Check if bridge is working
    health = health_check()
    print(f"✅ Bridge Status: {health['status']}")
    
    # Do some math
    result = call_mcp_tool('add', {'a': 10, 'b': 5})
    print(f"➕ 10 + 5 = {result['result']}")
    
    result = call_mcp_tool('multiply', {'a': 7, 'b': 8})
    print(f"✖️  7 × 8 = {result['result']}")
    
    result = call_mcp_tool('power', {'base': 2, 'exponent': 10})
    print(f"🔢 2^10 = {result['result']}")
    
    print("🎉 Done! Your MCP Bridge is working!") 