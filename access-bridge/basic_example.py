#!/usr/bin/env python3
"""
Basic MCP Bridge Example - Simple API Integration
Shows how easy it is to use the deployed MCP Bridge API
"""

import requests
import json

# Your deployed MCP Bridge URL
BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"

def call_mcp_tool(tool_name, arguments):
    """
    Simple function to call any MCP tool
    
    Args:
        tool_name: Name of the tool (e.g., 'add', 'multiply') 
        arguments: Dictionary of arguments (e.g., {'a': 5, 'b': 3})
    
    Returns:
        The result from the MCP tool
    """
    url = f"{BRIDGE_URL}/servers/math-server/tools/{tool_name}"
    response = requests.post(url, json=arguments, timeout=6000)  # 100 minutes for tool execution
    response.raise_for_status()
    
    # Parse the MCP response and extract the actual result
    mcp_response = response.json()
    result_text = mcp_response['content'][0]['text']
    return json.loads(result_text)

def health_check():
    """Check if the MCP Bridge is working"""
    response = requests.get(f"{BRIDGE_URL}/health", timeout=30)
    response.raise_for_status()
    return response.json()

def main():
    """Basic demonstration of MCP Bridge usage"""
    print("🚀 Basic MCP Bridge Example")
    print("=" * 40)
    
    # Check if bridge is working
    try:
        health = health_check()
        print(f"✅ Bridge Status: {health['status']}")
        print()
    except Exception as e:
        print(f"❌ Bridge not available: {e}")
        return
    
    # Basic math operations
    examples = [
        ("add", {"a": 10, "b": 5}, "Addition"),
        ("multiply", {"a": 7, "b": 8}, "Multiplication"),
        ("power", {"base": 2, "exponent": 10}, "Power"),
        ("square_root", {"number": 144}, "Square Root"),
    ]
    
    print("🧮 Math Operations:")
    for tool, args, description in examples:
        try:
            result = call_mcp_tool(tool, args)
            print(f"   {description}: {result['result']}")
        except Exception as e:
            print(f"   {description}: Error - {e}")
    
    print()
    print("🎉 Basic example completed!")
    print("💡 You can now integrate MCP Bridge into any Python application!")

if __name__ == "__main__":
    main() 