#!/usr/bin/env python3
"""
Real test for the /generate-postman endpoint using the math server
"""

import requests
import json
from datetime import datetime

# Configuration
MCP_BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"

def test_generate_postman_with_math_server():
    """Test the /generate-postman endpoint with a real math server example"""
    
    print("🧮 Testing /generate-postman with Math Server Configuration")
    print("=" * 60)
    
    # This is an example payload for a math server
    # In practice, users would provide their actual MCP server details
    payload = {
        "serverUrl": "https://mcp-proxy.yashmahe2021.workers.dev/mcp",
        "serverType": "http",
        "authToken": ""  # No auth token needed for this example
    }
    
    print("📤 Request payload:")
    print(json.dumps(payload, indent=2))
    print()
    
    try:
        print("🔄 Calling /generate-postman endpoint...")
        response = requests.post(
            f"{MCP_BRIDGE_URL}/generate-postman",
            json=payload,
            timeout=180  # 3 minutes timeout for discovery
        )
        
        print(f"📡 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("✅ SUCCESS! Postman collection generated")
            print(f"   Server: {result['metadata']['serverUrl']}")
            print(f"   Tools discovered: {result['metadata']['toolsCount']}")
            print(f"   Resources discovered: {result['metadata']['resourcesCount']}")
            print(f"   Prompts discovered: {result['metadata']['promptsCount']}")
            print(f"   Generated at: {result['metadata']['generatedAt']}")
            
            # Save the collection to a file
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            filename = f"math-server-collection-{timestamp}.json"
            
            with open(filename, 'w') as f:
                json.dump(result['collection'], f, indent=2)
            
            print(f"\n💾 Collection saved to: {filename}")
            
            # Show collection structure
            collection = result['collection']
            print(f"\n📋 Collection Structure:")
            print(f"   Name: {collection['info']['name']}")
            print(f"   Folders: {len(collection['item'])}")
            
            for folder in collection['item']:
                if 'item' in folder:
                    print(f"     📁 {folder['name']}: {len(folder['item'])} requests")
                else:
                    print(f"     📄 {folder['name']}: single request")
            
            # Show environment variables
            if 'variable' in collection:
                print(f"   Variables: {len(collection['variable'])}")
                for var in collection['variable']:
                    print(f"     🔧 {var['key']}: {var.get('value', 'N/A')}")
            
            # Show a sample tool request
            tools_folder = next((item for item in collection['item'] if item['name'] == 'Tools'), None)
            if tools_folder and 'item' in tools_folder and len(tools_folder['item']) > 0:
                sample_tool = tools_folder['item'][0]
                print(f"\n🔧 Sample Tool Request:")
                print(f"   Name: {sample_tool['name']}")
                print(f"   Method: {sample_tool['request']['method']}")
                print(f"   URL: {sample_tool['request']['url']['raw']}")
                
                # Show request body preview
                if 'body' in sample_tool['request'] and 'raw' in sample_tool['request']['body']:
                    body = json.loads(sample_tool['request']['body']['raw'])
                    print(f"   Tool: {body['params']['name']}")
                    print(f"   Parameters: {list(body['params']['arguments'].keys())}")
            
            return True
            
        else:
            print(f"❌ ERROR: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
                if 'details' in error_data:
                    print(f"   Details: {error_data['details']}")
            except:
                print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out - MCP server discovery took too long")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Main test function"""
    
    # Check if MCP Bridge is available first
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
    
    print()
    
    # Run the test
    success = test_generate_postman_with_math_server()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 Test completed successfully!")
        print("📥 You can now import the generated JSON file into Postman")
        print("🔗 Or upload it to Aisera for workflow automation")
    else:
        print("❌ Test failed - check the error messages above")

if __name__ == "__main__":
    main() 