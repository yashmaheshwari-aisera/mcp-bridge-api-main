#!/usr/bin/env python3
"""
Timeout Test Script for MCP Bridge
Tests if the server can handle long-running operations (20+ minutes)
"""

import requests
import time
import sys
from datetime import datetime

# Your deployed MCP Bridge URL
BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"
# For local testing, use: "http://localhost:3000"

def test_long_timeout(minutes=20, local=False):
    """
    Test if the server can handle a long-running request.
    The client waits patiently (no timeout) to see if the server responds.
    """
    
    base_url = "http://localhost:3000" if local else BRIDGE_URL
    url = f"{base_url}/test/timeout/{minutes}"
    
    print(f"🧪 Testing {minutes}-minute server timeout...")
    print(f"📡 URL: {url}")
    print(f"⏰ Start time: {datetime.now().strftime('%H:%M:%S')}")
    
    # Calculate expected completion time
    expected_completion = datetime.fromtimestamp(time.time() + (minutes * 60))
    print(f"🎯 Expected completion: {expected_completion.strftime('%H:%M:%S')}")
    print()
    print("⚠️  This test will run for the FULL duration!")
    print("⚠️  The client will wait patiently to test server-side timeout limits.")
    print("⚠️  Press Ctrl+C to cancel if needed.")
    print("=" * 60)
    
    start_time = time.time()
    
    try:
        # NO CLIENT TIMEOUT - we want to test the server's ability to handle long requests
        print(f"🚀 Starting {minutes}-minute request... (client has no timeout)")
        response = requests.post(url)  # No timeout parameter!
        response.raise_for_status()
        
        end_time = time.time()
        actual_duration = end_time - start_time
        
        result = response.json()
        
        print()
        print("🎉 SUCCESS! Server handled the long request!")
        print("=" * 60)
        print(f"📊 Server Response: {result}")
        print(f"⏱️  Actual duration: {actual_duration:.1f} seconds ({actual_duration/60:.1f} minutes)")
        print(f"🎯 Expected duration: {minutes * 60} seconds ({minutes} minutes)")
        print(f"📈 Accuracy: {(actual_duration / (minutes * 60)) * 100:.1f}%")
        print()
        print("✅ CONCLUSION: 100-minute server timeout configuration is working!")
        print("   The server successfully held the connection open for 20+ minutes.")
        
        return True
        
    except requests.exceptions.RequestException as e:
        end_time = time.time()
        actual_duration = end_time - start_time
        print()
        print("❌ FAILED!")
        print("=" * 60)
        print(f"💥 Error after {actual_duration:.1f} seconds ({actual_duration/60:.1f} minutes): {e}")
        
        if actual_duration < 150:  # Less than 2.5 minutes
            print("🔍 ANALYSIS: Server timed out very quickly (< 2.5 min)")
            print("   This suggests the old Express.js 2-minute timeout is still active.")
        elif actual_duration < 1200:  # Less than 20 minutes but more than 2.5
            print("🔍 ANALYSIS: Server timed out before expected duration")
            print("   The timeout configuration may be partially working.")
        else:
            print("🔍 ANALYSIS: Unexpected error after significant time")
        
        return False
    
    except KeyboardInterrupt:
        end_time = time.time()
        actual_duration = end_time - start_time
        print()
        print("⚠️  Test cancelled by user")
        print(f"⏱️  Ran for {actual_duration:.1f} seconds ({actual_duration/60:.1f} minutes)")
        return False

def quick_test():
    """Quick test to verify the endpoint works with short duration"""
    print("🚀 Quick Test: 1-minute timeout")
    print("=" * 40)
    
    try:
        response = requests.post(f"{BRIDGE_URL}/test/timeout/1", timeout=90)  # 1 minute test, with 90s client timeout
        response.raise_for_status()
        result = response.json()
        print("✅ Quick test passed!")
        print(f"📊 Response: {result}")
        return True
    except Exception as e:
        print(f"❌ Quick test failed: {e}")
        return False

def main():
    """Run timeout tests"""
    
    if len(sys.argv) > 1:
        # Test specific duration from command line
        try:
            minutes = float(sys.argv[1])
            local = "--local" in sys.argv
            test_long_timeout(minutes, local)
        except ValueError:
            print("❌ Invalid duration. Please provide a number.")
            sys.exit(1)
    else:
        print("🚀 MCP Bridge Long Timeout Test")
        print("=" * 60)
        print("This tests if the server can handle 20-minute requests")
        print("(proving the 100-minute timeout configuration works)")
        print()
        
        # Check if server is available first
        try:
            health_response = requests.get(f"{BRIDGE_URL}/health", timeout=10)
            health_response.raise_for_status()
            print("✅ MCP Bridge is online and healthy")
            print()
        except Exception as e:
            print(f"❌ MCP Bridge is not accessible: {e}")
            return
        
        # Run quick test first
        if not quick_test():
            print("❌ Quick test failed, skipping long test")
            return
        
        print()
        print("🎯 Now running the 20-minute timeout test...")
        input("Press Enter to start the 20-minute test (or Ctrl+C to cancel)...")
        
        # Run the main 20-minute test
        test_long_timeout(20)

if __name__ == "__main__":
    main() 