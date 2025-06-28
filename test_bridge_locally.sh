#!/bin/bash

echo "🧪 TESTING MCP BRIDGE LOCALLY"
echo "============================="
echo ""

# Step 1: Start the server in background
echo "1. Starting local bridge server..."
nohup node mcp-bridge.js > /tmp/bridge_test.log 2>&1 &
SERVER_PID=$!
echo "   Server started with PID: $SERVER_PID"
sleep 3

# Step 2: Test Carlos's SSE server with get_bio
echo ""
echo "2. Testing Carlos's SSE server with get_bio command..."
RESPONSE=$(curl -s -X POST "http://localhost:3000/tool/execute/dynamic" \
     -H "Content-Type: application/json" \
     -d '{
       "mcp_server_url": "https://mcp-server.matallo.workers.dev/sse",
       "tool_name": "get_bio",
       "parameters": {}
     }')

echo "   Response: $RESPONSE"

# Extract job_id and bearer_token
JOB_ID=$(echo "$RESPONSE" | python3 -c "import json,sys;data=json.load(sys.stdin);print(data.get('job_id',''))" 2>/dev/null)
BEARER_TOKEN=$(echo "$RESPONSE" | python3 -c "import json,sys;data=json.load(sys.stdin);print(data.get('bearer_token',''))" 2>/dev/null)

if [ -n "$JOB_ID" ] && [ -n "$BEARER_TOKEN" ]; then
    echo "   ✅ Job queued successfully!"
    echo "   Job ID: $JOB_ID"
    echo "   Bearer Token: $BEARER_TOKEN"
    
    # Step 3: Wait and get result
    echo ""
    echo "3. Waiting for processing..."
    sleep 8
    
    echo "4. Getting result..."
    curl -s -X POST "http://localhost:3000/results/$JOB_ID" \
         -H "Authorization: Bearer $BEARER_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{}' | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    status = data.get('status', 'N/A')
    print(f'   Status: {status}')
    if status == 'COMPLETED':
        print('   🎉 SUCCESS! Bridge is working with Carlos SSE server!')
        result = data.get('result', {})
        if result.get('content'):
            for content in result['content']:
                if content.get('type') == 'text':
                    print(f'   Bio Result: {content.get(\"text\", \"N/A\")}')
    elif status == 'FAILED':
        print(f'   ❌ FAILED: {data.get(\"error\", \"Unknown\")}')
    else:
        print(f'   ⏳ Status: {status}')
except Exception as e:
    print(f'   ❌ Result parsing failed: {e}')
"
else
    echo "   ❌ Failed to queue job"
fi

# Cleanup
echo ""
echo "5. Cleaning up..."
kill $SERVER_PID 2>/dev/null
echo "   Server stopped"
echo ""
echo "✅ Bridge test complete!"
