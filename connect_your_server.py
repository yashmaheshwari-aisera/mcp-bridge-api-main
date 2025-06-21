#!/usr/bin/env python3
"""
Template for connecting your own MCP server to the MCP Bridge
Replace the placeholder values with your actual MCP server details.
"""

import requests
import json
import time

# MCP Bridge configuration
MCP_BRIDGE_URL = "http://localhost:3000"

# YOUR MCP SERVER CONFIGURATION - REPLACE THESE VALUES
YOUR_SERVER_CONFIG = {
    "id": "your-server-name",           # Unique identifier for your server
    "command": "python",                # Command to start your server (python, node, npx, etc.)
    "args": [                          # Arguments to pass to your server
        "/path/to/your/mcp_server.py",  # Path to your MCP server script
        "--port", "8080",               # Any additional arguments
        "--config", "/path/to/config.json"
    ],
    "env": {                           # Environment variables (optional)
        "API_KEY": "your-api-key",
        "DATABASE_URL": "your-db-url",
        "DEBUG": "true"
    },
    "riskLevel": 1                     # 1=low, 2=medium (requires confirmation), 3=high (docker)
}

# Examples of different server types:
EXAMPLE_CONFIGS = {
    # Python MCP Server
    "python_server": {
        "id": "my-python-server",
        "command": "python",
        "args": ["/path/to/your/mcp_server.py"],
        "env": {"PYTHONPATH": "/path/to/dependencies"},
        "riskLevel": 1
    },
    
    # Node.js MCP Server
    "nodejs_server": {
        "id": "my-node-server", 
        "command": "node",
        "args": ["/path/to/your/mcp_server.js"],
        "env": {"NODE_ENV": "production"},
        "riskLevel": 1
    },
    
    # NPM Package MCP Server
    "npm_package_server": {
        "id": "npm-server",
        "command": "npx",
        "args": ["-y", "@your-org/your-mcp-server", "--config", "/path/to/config.json"],
        "riskLevel": 1
    },
    
    # High-risk server (runs in Docker)
    "docker_server": {
        "id": "docker-server",
        "command": "docker",
        "args": ["run", "--rm", "-i", "your-mcp-server-image"],
        "riskLevel": 3,
        "docker": {
            "image": "your-mcp-server-image",
            "options": ["--rm", "-i"]
        }
    }
}

def connect_server(server_config):
    """Connect your MCP server to the bridge"""
    
    print(f"🔌 Connecting server '{server_config['id']}' to MCP Bridge...")
    print(f"   Command: {server_config['command']} {' '.join(server_config['args'])}")
    
    try:
        # Add the server to the bridge
        response = requests.post(
            f"{MCP_BRIDGE_URL}/servers",
            json=server_config,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ Server connected successfully!")
            print(f"   Server ID: {result['id']}")
            print(f"   Status: {result['status']}")
            print(f"   PID: {result['pid']}")
            
            if 'risk_level' in result:
                print(f"   Risk Level: {result['risk_level']} - {result['risk_description']}")
            
            return True
            
        elif response.status_code == 409:
            print(f"⚠️  Server '{server_config['id']}' already exists")
            return False
            
        else:
            print(f"❌ Failed to connect server: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to MCP Bridge at {MCP_BRIDGE_URL}")
        print("   Make sure the MCP Bridge is running with: node mcp-bridge.js")
        return False
    except Exception as e:
        print(f"❌ Error connecting server: {e}")
        return False

def test_server(server_id):
    """Test if the connected server is working"""
    
    print(f"\n🧪 Testing server '{server_id}'...")
    
    try:
        # Check if server is listed
        response = requests.get(f"{MCP_BRIDGE_URL}/servers")
        servers = response.json().get("servers", [])
        
        server = next((s for s in servers if s['id'] == server_id), None)
        if not server:
            print(f"❌ Server '{server_id}' not found in server list")
            return False
            
        print(f"✅ Server found in list (PID: {server['pid']})")
        
        # Try to get tools
        response = requests.get(f"{MCP_BRIDGE_URL}/servers/{server_id}/tools")
        if response.status_code == 200:
            tools = response.json().get("tools", [])
            print(f"✅ Server responding - {len(tools)} tools available")
            
            # List the tools
            if tools:
                print("   Available tools:")
                for tool in tools[:5]:  # Show first 5 tools
                    print(f"      📦 {tool.get('name', 'Unknown')}")
                if len(tools) > 5:
                    print(f"      ... and {len(tools) - 5} more")
            else:
                print("   No tools available (this might be normal)")
            
            return True
        else:
            print(f"❌ Server not responding to tools request: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing server: {e}")
        return False

def disconnect_server(server_id):
    """Disconnect a server from the bridge"""
    
    print(f"\n🔌 Disconnecting server '{server_id}'...")
    
    try:
        response = requests.delete(f"{MCP_BRIDGE_URL}/servers/{server_id}")
        
        if response.status_code == 200:
            print(f"✅ Server '{server_id}' disconnected successfully")
            return True
        elif response.status_code == 404:
            print(f"⚠️  Server '{server_id}' was not found")
            return False
        else:
            print(f"❌ Failed to disconnect server: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error disconnecting server: {e}")
        return False

def main():
    """Main function to connect and test your MCP server"""
    
    print("🚀 MCP Server Connection Tool")
    print("=" * 50)
    
    # Check if MCP Bridge is running
    try:
        response = requests.get(f"{MCP_BRIDGE_URL}/health")
        health = response.json()
        print(f"✅ MCP Bridge is running (Uptime: {health.get('uptime', 0):.1f}s)")
    except:
        print(f"❌ MCP Bridge is not running at {MCP_BRIDGE_URL}")
        print("   Start it with: node mcp-bridge.js")
        return
    
    # Connect your server
    if connect_server(YOUR_SERVER_CONFIG):
        # Test the server
        if test_server(YOUR_SERVER_CONFIG["id"]):
            print(f"\n🎉 Your MCP server is successfully connected and working!")
            print(f"   You can now use it via the REST API or client applications.")
            
            # Optionally disconnect (comment out if you want to keep it connected)
            # disconnect_server(YOUR_SERVER_CONFIG["id"])
        else:
            print(f"\n⚠️  Server connected but not responding properly.")
            print(f"   Check your server logs and configuration.")
    
    print(f"\n📋 Next steps:")
    print(f"   1. Update YOUR_SERVER_CONFIG with your actual server details")
    print(f"   2. Make sure your MCP server is working independently")
    print(f"   3. Run this script again to connect it to the bridge")
    print(f"   4. Use the API endpoints to interact with your server")

if __name__ == "__main__":
    main() 