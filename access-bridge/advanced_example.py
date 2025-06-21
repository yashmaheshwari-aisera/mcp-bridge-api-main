#!/usr/bin/env python3
"""
Advanced MCP Bridge API Example
Shows more complex math operations using the deployed MCP Bridge
"""

from client import MCPBridgeClient
import json

def main():
    print("🧮 Advanced MCP Bridge Math Operations Demo")
    print("=" * 50)
    
    client = MCPBridgeClient()
    
    try:
        # Get the server info
        servers = client.list_servers()['servers']
        server_id = servers[0]['id']
        
        print(f"🎯 Using server: {server_id}")
        print()
        
        # Advanced Math Operations
        operations = [
            # Power operations
            ("power", {"base": 2, "exponent": 10}, "2^10"),
            ("square_root", {"number": 144}, "√144"),
            ("factorial", {"number": 5}, "5!"),
            
            # Trigonometry (angles in radians)
            ("sin", {"angle": 1.5708}, "sin(π/2)"),  # π/2 ≈ 1.5708
            ("cos", {"angle": 0}, "cos(0)"),
            ("tan", {"angle": 0.7854}, "tan(π/4)"),  # π/4 ≈ 0.7854
            
            # Logarithms
            ("ln", {"number": 2.71828}, "ln(e)"),
            ("log", {"number": 100, "base": 10}, "log₁₀(100)"),
            ("exp", {"x": 1}, "e^1"),
            
            # Complex operations
            ("quadratic", {"a": 1, "b": -5, "c": 6}, "x² - 5x + 6 = 0"),
            ("distance", {"x1": 0, "y1": 0, "x2": 3, "y2": 4}, "distance (0,0) to (3,4)"),
            ("mean", {"numbers": [1, 2, 3, 4, 5]}, "mean of [1,2,3,4,5]"),
            ("median", {"numbers": [1, 3, 3, 6, 7, 8, 9]}, "median of [1,3,3,6,7,8,9]"),
            ("complex_add", {"real1": 3, "imag1": 4, "real2": 1, "imag2": 2}, "(3+4i) + (1+2i)"),
        ]
        
        for tool_name, args, description in operations:
            try:
                result = client.execute_tool(server_id, tool_name, args)
                result_data = json.loads(result['content'][0]['text'])
                
                print(f"🔢 {description}")
                print(f"   Result: {result_data['result']}")
                print()
                
            except Exception as e:
                print(f"❌ Error with {tool_name}: {e}")
                print()
        
        print("🎯 Demonstrating Error Handling...")
        try:
            # This should cause a division by zero error
            result = client.execute_tool(server_id, 'divide', {'a': 10, 'b': 0})
            result_data = json.loads(result['content'][0]['text'])
            print(f"Division by zero result: {result_data}")
        except Exception as e:
            print(f"✅ Properly caught division by zero: {e}")
        
        print()
        print("🚀 Advanced demo completed!")
        print("💡 Your MCP Bridge can handle complex mathematical operations!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 