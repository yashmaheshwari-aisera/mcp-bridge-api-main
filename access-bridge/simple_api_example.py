#!/usr/bin/env python3
"""
Example: How to integrate MCP Bridge into ANY API
This shows how simple it is to add MCP power to your existing code
"""

from client import call_mcp_tool, get_available_tools, health_check

def my_api_function(operation, num1, num2):
    """
    Your API function that now has MCP superpowers!
    Just call the MCP bridge for complex operations
    """
    
    # Simple operations you could handle locally
    if operation == "add":
        return call_mcp_tool('add', {'a': num1, 'b': num2})
    elif operation == "multiply":
        return call_mcp_tool('multiply', {'a': num1, 'b': num2})
    
    # Complex operations - let MCP handle it
    elif operation == "power":
        return call_mcp_tool('power', {'base': num1, 'exponent': num2})
    elif operation == "distance":
        return call_mcp_tool('distance', {'x1': 0, 'y1': 0, 'x2': num1, 'y2': num2})
    
    else:
        return {"error": "Unknown operation"}

def calculator_api():
    """Example API that uses MCP for calculations"""
    
    print("🧮 Calculator API with MCP Backend")
    print("=" * 40)
    
    # Check if MCP is available
    if health_check()['status'] != 'ok':
        return {"error": "MCP Bridge not available"}
    
    # Show available operations
    tools = get_available_tools()
    print(f"📊 Available operations: {[tool['name'] for tool in tools]}")
    print()
    
    # Example calculations
    examples = [
        ("add", 25, 17),
        ("multiply", 9, 7),
        ("power", 3, 4),
        ("distance", 6, 8),  # Distance from origin to (6,8)
    ]
    
    for op, a, b in examples:
        result = my_api_function(op, a, b)
        print(f"🔢 {op}({a}, {b}) = {result['result']}")
    
    print("\n✅ Your API now has MCP superpowers!")

# Flask/FastAPI example
def flask_route_example():
    """
    Example of how this would look in a Flask API
    """
    
    # Pseudo-code for Flask route:
    """
    @app.route('/calculate/<operation>')
    def calculate(operation):
        a = request.json.get('a')
        b = request.json.get('b')
        
        # Just call your MCP bridge!
        result = call_mcp_tool(operation, {'a': a, 'b': b})
        return jsonify(result)
    """
    
    print("💡 Flask Integration Example:")
    print("   Just call call_mcp_tool() in your route handlers!")
    print("   Your API instantly gets all MCP server capabilities!")

if __name__ == "__main__":
    calculator_api()
    print()
    flask_route_example() 