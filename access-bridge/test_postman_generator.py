#!/usr/bin/env python3
"""
Test script for MCP Bridge API /generate-postman endpoint
Tests the automatic MCP server discovery and Postman collection generation
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
MCP_BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"

def test_math_server_postman_generation():
    """Test generating Postman collection from the math server"""
    
    print("🧮 Testing MCP-to-Postman Generator with Math Server")
    print("=" * 60)
    
    # Math server configuration (HTTP/SSE MCP server)
    payload = {
        "serverUrl": "https://mcp-proxy.yashmahe2021.workers.dev/mcp",
        "serverType": "http",
        "authToken": ""  # No auth token required for math server
    }
    
    print("📤 Request Details:")
    print(f"   URL: {MCP_BRIDGE_URL}/generate-postman")
    print(f"   Method: POST")
    print(f"   Content-Type: application/json")
    print("   Payload:")
    print(json.dumps(payload, indent=4))
    print()
    
    try:
        print("🔄 Calling /generate-postman endpoint...")
        response = requests.post(
            f"{MCP_BRIDGE_URL}/generate-postman",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=180  # 3 minutes timeout for discovery
        )
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("✅ SUCCESS! Postman collection generated")
            print(f"   Server URL: {result['metadata']['serverUrl']}")
            print(f"   Tools discovered: {result['metadata']['toolsCount']}")
            print(f"   Resources discovered: {result['metadata']['resourcesCount']}")
            print(f"   Prompts discovered: {result['metadata']['promptsCount']}")
            print(f"   Generated at: {result['metadata']['generatedAt']}")
            
            # Save the collection to a file
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            filename = f"math-server-postman-collection-{timestamp}.json"
            
            with open(filename, 'w') as f:
                json.dump(result['collection'], f, indent=2)
            
            print(f"\n💾 Collection saved to: {filename}")
            
            # Analyze collection structure
            collection = result['collection']
            print(f"\n📋 Generated Collection Analysis:")
            print(f"   Collection Name: {collection['info']['name']}")
            print(f"   Schema Version: {collection['info']['schema']}")
            print(f"   Total Folders: {len(collection['item'])}")
            
            # Show folder breakdown
            for folder in collection['item']:
                if 'item' in folder:
                    print(f"     📁 {folder['name']}: {len(folder['item'])} requests")
                    if folder['name'] == 'Tools' and len(folder['item']) > 0:
                        # Show first few tools as examples
                        tools_sample = folder['item'][:5]
                        for tool in tools_sample:
                            print(f"       🔧 {tool['name']}")
                        if len(folder['item']) > 5:
                            print(f"       ... and {len(folder['item']) - 5} more tools")
                else:
                    print(f"     📄 {folder['name']}: single request")
            
            # Show environment variables
            if 'variable' in collection:
                print(f"   Environment Variables: {len(collection['variable'])}")
                for var in collection['variable']:
                    print(f"     🔧 {var['key']}: {var.get('value', 'N/A')}")
            
            # Show sample tool request details
            tools_folder = next((item for item in collection['item'] if item['name'] == 'Tools'), None)
            if tools_folder and 'item' in tools_folder and len(tools_folder['item']) > 0:
                sample_tool = tools_folder['item'][0]  # First tool (usually 'add')
                print(f"\n🔧 Sample Tool Request ('{sample_tool['name']}'):")
                print(f"   Method: {sample_tool['request']['method']}")
                print(f"   URL: {sample_tool['request']['url']['raw']}")
                
                # Parse and show request body
                if 'body' in sample_tool['request'] and 'raw' in sample_tool['request']['body']:
                    body = json.loads(sample_tool['request']['body']['raw'])
                    print(f"   JSON-RPC Method: {body['method']}")
                    print(f"   Tool Name: {body['params']['name']}")
                    print(f"   Parameters: {json.dumps(body['params']['arguments'], indent=6)}")
                
                # Show description
                if 'description' in sample_tool['request']:
                    desc_lines = sample_tool['request']['description'].split('\n')
                    print(f"   Description: {desc_lines[0]}")
            
            print(f"\n📊 Collection Statistics:")
            print(f"   Total file size: {len(json.dumps(collection))} characters")
            print(f"   Ready for import into Postman or Aisera")
            
            return True, filename
            
        else:
            print(f"❌ ERROR: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
                if 'details' in error_data:
                    print(f"   Details: {error_data['details']}")
            except:
                print(f"   Response: {response.text}")
            return False, None
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out - MCP server discovery took too long")
        return False, None
    except Exception as e:
        print(f"❌ Error: {e}")
        return False, None

def test_stdio_server_example():
    """Show example of stdio server configuration"""
    
    print("\n📚 Example: stdio MCP Server Configuration")
    print("=" * 60)
    
    stdio_payload = {
        "serverCommand": "npx",
        "serverArgs": ["@modelcontextprotocol/server-filesystem", "/safe/directory"],
        "serverEnv": {
            "DEBUG": "true",
            "NODE_ENV": "production"
        }
    }
    
    print("📤 stdio Server Request Example:")
    print(f"   URL: {MCP_BRIDGE_URL}/generate-postman")
    print(f"   Method: POST")
    print(f"   Content-Type: application/json")
    print("   Payload:")
    print(json.dumps(stdio_payload, indent=4))
    print("\n   Note: This would discover filesystem tools like read_file, write_file, etc.")

def show_aisera_integration_specs():
    """Show exact specifications for Aisera integration"""
    
    print("\n🔗 AISERA INTEGRATION SPECIFICATIONS")
    print("=" * 60)
    
    print("API Endpoint Configuration:")
    print(f"   URL: {MCP_BRIDGE_URL}/generate-postman")
    print("   Method: POST")
    print("   Headers:")
    print("     Content-Type: application/json")
    print()
    
    print("Request Body Options:")
    print()
    print("Option 1 - HTTP/SSE MCP Server:")
    http_body = {
        "serverUrl": "{{user_mcp_server_url}}",
        "serverType": "http",
        "authToken": "{{user_auth_token}}"
    }
    print(json.dumps(http_body, indent=2))
    
    print("\nOption 2 - stdio MCP Server:")
    stdio_body = {
        "serverCommand": "{{user_command}}",
        "serverArgs": ["{{user_args}}"],
        "serverEnv": {
            "{{env_key}}": "{{env_value}}"
        }
    }
    print(json.dumps(stdio_body, indent=2))
    
    print("\nResponse Format:")
    response_example = {
        "success": True,
        "collection": {
            "info": {
                "name": "MCP Server: user-server.com",
                "description": "Auto-generated collection...",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": ["... folders with tools, resources, prompts ..."],
            "variable": ["... environment variables ..."]
        },
        "metadata": {
            "serverUrl": "https://user-server.com",
            "toolsCount": 15,
            "resourcesCount": 3,
            "promptsCount": 2,
            "generatedAt": "2025-01-15T10:30:00.000Z"
        }
    }
    print(json.dumps(response_example, indent=2))

def main():
    """Main test function"""
    
    print("🚀 MCP Bridge API - Postman Collection Generator Test")
    print("Testing automatic MCP server discovery and collection generation")
    print("=" * 80)
    
    # Check if MCP Bridge is available
    try:
        print("🔍 Checking MCP Bridge availability...")
        health_response = requests.get(f"{MCP_BRIDGE_URL}/health", timeout=30)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"✅ MCP Bridge is online (uptime: {health_data.get('uptime', 0):.1f}s)")
            print(f"   Connected servers: {health_data.get('serverCount', 0)}")
            
            # Show available servers
            for server in health_data.get('servers', []):
                print(f"   📡 {server['id']}: {server['initialization_state']}")
        else:
            print(f"❌ MCP Bridge not available: {health_response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to MCP Bridge: {e}")
        return
    
    print()
    
    # Test 1: Generate collection for math server
    success, filename = test_math_server_postman_generation()
    
    # Test 2: Show stdio server example
    test_stdio_server_example()
    
    # Test 3: Show Aisera integration specifications
    show_aisera_integration_specs()
    
    # Summary
    print("\n" + "=" * 80)
    if success:
        print("🎉 TEST COMPLETED SUCCESSFULLY!")
        print(f"📁 Generated collection file: {filename}")
        print("📥 Ready for import into Postman or upload to Aisera")
        print("\n💡 Next Steps:")
        print("1. Import the JSON file into Postman to test manually")
        print("2. Use the Aisera specifications above to integrate")
        print("3. Users can now auto-generate collections for any MCP server")
    else:
        print("❌ Test failed - check error messages above")
    
    print("\n🔗 Production Endpoint:")
    print(f"   {MCP_BRIDGE_URL}/generate-postman")

if __name__ == "__main__":
    main() 