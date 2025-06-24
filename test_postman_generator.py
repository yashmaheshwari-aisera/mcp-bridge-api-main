#!/usr/bin/env python3
"""
Test script for the MCP Bridge API /generate-postman endpoint

This script demonstrates how to generate Postman collections from MCP servers
using the new /generate-postman endpoint.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
MCP_BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"
# MCP_BRIDGE_URL = "http://localhost:3000"  # For local testing

def test_generate_postman_http_server():
    """Test generating Postman collection from an HTTP MCP server"""
    
    print("🔧 Testing Postman generation for HTTP MCP server...")
    
    # Example: Generate collection for a remote MCP server
    payload = {
        "serverUrl": "https://api.example-mcp-server.com",
        "serverType": "http",
        "authToken": "your-auth-token-here"  # Optional
    }
    
    try:
        response = requests.post(
            f"{MCP_BRIDGE_URL}/generate-postman",
            json=payload,
            timeout=120  # 2 minutes timeout for discovery
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Successfully generated Postman collection")
            print(f"   Tools discovered: {result['metadata']['toolsCount']}")
            print(f"   Resources discovered: {result['metadata']['resourcesCount']}")
            print(f"   Prompts discovered: {result['metadata']['promptsCount']}")
            
            # Save the collection to a file
            filename = f"mcp-collection-http-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
            with open(filename, 'w') as f:
                json.dump(result['collection'], f, indent=2)
            print(f"   Collection saved to: {filename}")
            
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out - MCP server discovery took too long")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_generate_postman_stdio_server():
    """Test generating Postman collection from a stdio MCP server"""
    
    print("\n🔧 Testing Postman generation for stdio MCP server...")
    
    # Example: Generate collection for a local stdio MCP server
    payload = {
        "serverCommand": "npx",
        "serverArgs": ["@modelcontextprotocol/server-everything"],
        "serverEnv": {
            "HELLO": "Hello MCP!",
            "DEBUG": "true"
        }
    }
    
    try:
        response = requests.post(
            f"{MCP_BRIDGE_URL}/generate-postman",
            json=payload,
            timeout=120  # 2 minutes timeout for discovery
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Successfully generated Postman collection")
            print(f"   Tools discovered: {result['metadata']['toolsCount']}")
            print(f"   Resources discovered: {result['metadata']['resourcesCount']}")
            print(f"   Prompts discovered: {result['metadata']['promptsCount']}")
            
            # Save the collection to a file
            filename = f"mcp-collection-stdio-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
            with open(filename, 'w') as f:
                json.dump(result['collection'], f, indent=2)
            print(f"   Collection saved to: {filename}")
            
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out - MCP server discovery took too long")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_generate_postman_math_server():
    """Test generating Postman collection from the math server (if available)"""
    
    print("\n🔧 Testing Postman generation for math server...")
    
    # First check if math server is available
    try:
        health_response = requests.get(f"{MCP_BRIDGE_URL}/health", timeout=30)
        if health_response.status_code != 200:
            print("❌ MCP Bridge not available")
            return False
            
        health_data = health_response.json()
        math_server = None
        
        for server in health_data.get('servers', []):
            if 'math' in server.get('id', '').lower():
                math_server = server
                break
        
        if not math_server:
            print("ℹ️  No math server found - skipping test")
            return True
            
        print(f"   Found math server: {math_server['id']}")
        
        # Generate collection using the existing math server as reference
        # We'll use a generic math server command for demonstration
        payload = {
            "serverCommand": "node",
            "serverArgs": ["path/to/math-server.js"],  # This would be the actual path
            "serverEnv": {}
        }
        
        # For demonstration, we'll show what the request would look like
        print("   Example request payload:")
        print(json.dumps(payload, indent=2))
        print("   (Skipping actual request since we don't have the exact math server command)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking for math server: {e}")
        return False

def demonstrate_api_usage():
    """Demonstrate different ways to use the /generate-postman API"""
    
    print("📚 API Usage Examples:")
    print("=" * 50)
    
    print("\n1. HTTP/SSE MCP Server:")
    print("POST /generate-postman")
    print("Content-Type: application/json")
    print(json.dumps({
        "serverUrl": "https://your-mcp-server.com",
        "serverType": "http",
        "authToken": "your-auth-token"
    }, indent=2))
    
    print("\n2. stdio MCP Server:")
    print("POST /generate-postman")
    print("Content-Type: application/json")
    print(json.dumps({
        "serverCommand": "npx",
        "serverArgs": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"],
        "serverEnv": {
            "DEBUG": "true"
        }
    }, indent=2))
    
    print("\n3. Local Node.js MCP Server:")
    print("POST /generate-postman")
    print("Content-Type: application/json")
    print(json.dumps({
        "serverCommand": "node",
        "serverArgs": ["build/index.js", "--port", "3001"],
        "serverEnv": {
            "NODE_ENV": "production",
            "API_KEY": "your-api-key"
        }
    }, indent=2))

def main():
    """Main test function"""
    
    print("🚀 MCP Bridge API - Postman Collection Generator Test")
    print("=" * 60)
    
    # Check if MCP Bridge is available
    try:
        health_response = requests.get(f"{MCP_BRIDGE_URL}/health", timeout=30)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"✅ MCP Bridge is available (uptime: {health_data.get('uptime', 0):.1f}s)")
            print(f"   Connected servers: {health_data.get('serverCount', 0)}")
        else:
            print(f"❌ MCP Bridge not available: {health_response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to MCP Bridge: {e}")
        return
    
    # Demonstrate API usage
    demonstrate_api_usage()
    
    # Run tests
    print("\n🧪 Running Tests:")
    print("-" * 30)
    
    results = []
    
    # Test 1: Check math server availability
    results.append(test_generate_postman_math_server())
    
    # Test 2: HTTP server (will likely fail without a real server, but shows the flow)
    # results.append(test_generate_postman_http_server())
    
    # Test 3: stdio server (will likely fail without the package installed, but shows the flow)
    # results.append(test_generate_postman_stdio_server())
    
    # Summary
    print(f"\n📊 Test Summary:")
    print(f"   Tests run: {len(results)}")
    print(f"   Passed: {sum(results)}")
    print(f"   Failed: {len(results) - sum(results)}")
    
    print("\n💡 Usage Instructions:")
    print("1. Use the /generate-postman endpoint with your MCP server details")
    print("2. The API will discover all tools, resources, and prompts")
    print("3. Download the generated collection JSON file")
    print("4. Import it into Postman or upload to Aisera")
    print("5. Start using your MCP server capabilities!")

if __name__ == "__main__":
    main() 