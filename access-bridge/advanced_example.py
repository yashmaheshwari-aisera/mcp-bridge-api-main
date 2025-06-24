#!/usr/bin/env python3
"""
Advanced MCP Bridge Example - Complex Math Operations
Demonstrates sophisticated mathematical operations using the MCP Bridge API
"""

import requests
import json

# Your deployed MCP Bridge URL
BRIDGE_URL = "https://mcp-bridge-api-main.onrender.com"

def call_mcp_tool(tool_name, arguments):
    """Execute an MCP tool and return the parsed result"""
    url = f"{BRIDGE_URL}/servers/math-server/tools/{tool_name}"
    response = requests.post(url, json=arguments, timeout=6000)  # 100 minutes for tool execution
    response.raise_for_status()
    
    mcp_response = response.json()
    result_text = mcp_response['content'][0]['text']
    return json.loads(result_text)

def get_available_tools():
    """Get list of all available tools from the math server"""
    url = f"{BRIDGE_URL}/servers/math-server/tools"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.json()['tools']

def demonstrate_advanced_math():
    """Demonstrate complex mathematical operations"""
    print("🧮 Advanced Mathematical Operations")
    print("=" * 50)
    
    # Advanced arithmetic operations
    print("📈 Advanced Arithmetic:")
    operations = [
        ("power", {"base": 2, "exponent": 16}, "2^16 (binary powers)"),
        ("factorial", {"number": 8}, "8! (factorial)"),
        ("exp", {"x": 2}, "e^2 (exponential)"),
        ("square_root", {"number": 2}, "√2 (irrational number)"),
    ]
    
    for tool, args, description in operations:
        try:
            result = call_mcp_tool(tool, args)
            print(f"   {description} = {result['result']}")
        except Exception as e:
            print(f"   {description}: Error - {e}")
    
    print()
    
    # Trigonometry (using radians)
    print("📐 Trigonometry:")
    import math
    trig_operations = [
        ("sin", {"angle": math.pi/2}, "sin(π/2) = sin(90°)"),
        ("cos", {"angle": 0}, "cos(0) = cos(0°)"),
        ("tan", {"angle": math.pi/4}, "tan(π/4) = tan(45°)"),
        ("sin", {"angle": math.pi/6}, "sin(π/6) = sin(30°)"),
    ]
    
    for tool, args, description in trig_operations:
        try:
            result = call_mcp_tool(tool, args)
            print(f"   {description} = {result['result']:.6f}")
        except Exception as e:
            print(f"   {description}: Error - {e}")
    
    print()
    
    # Logarithms
    print("📊 Logarithms:")
    log_operations = [
        ("ln", {"number": math.e}, "ln(e) (natural log of e)"),
        ("log", {"number": 1000, "base": 10}, "log₁₀(1000)"),
        ("log", {"number": 32, "base": 2}, "log₂(32) (binary log)"),
        ("ln", {"number": 1}, "ln(1)"),
    ]
    
    for tool, args, description in log_operations:
        try:
            result = call_mcp_tool(tool, args)
            print(f"   {description} = {result['result']}")
        except Exception as e:
            print(f"   {description}: Error - {e}")
    
    print()

def demonstrate_problem_solving():
    """Demonstrate solving real-world mathematical problems"""
    print("🎯 Problem Solving Examples")
    print("=" * 50)
    
    # Quadratic equation solving
    print("📈 Quadratic Equations:")
    quadratic_problems = [
        ({"a": 1, "b": -5, "c": 6}, "x² - 5x + 6 = 0"),
        ({"a": 1, "b": -2, "c": -3}, "x² - 2x - 3 = 0"),
        ({"a": 2, "b": 4, "c": -6}, "2x² + 4x - 6 = 0"),
    ]
    
    for args, equation in quadratic_problems:
        try:
            result = call_mcp_tool("quadratic", args)
            roots = result['result']
            print(f"   {equation}")
            print(f"   → Roots: {roots}")
        except Exception as e:
            print(f"   {equation}: Error - {e}")
        print()
    
    # Distance calculations
    print("📏 Distance Calculations:")
    distance_problems = [
        ({"x1": 0, "y1": 0, "x2": 3, "y2": 4}, "Origin to (3,4) - Classic 3-4-5 triangle"),
        ({"x1": 1, "y1": 1, "x2": 4, "y2": 5}, "Point (1,1) to (4,5)"),
        ({"x1": -2, "y1": 3, "x2": 1, "y2": -1}, "Point (-2,3) to (1,-1)"),
    ]
    
    for args, description in distance_problems:
        try:
            result = call_mcp_tool("distance", args)
            print(f"   {description}")
            print(f"   → Distance: {result['result']:.6f}")
        except Exception as e:
            print(f"   {description}: Error - {e}")
        print()

def demonstrate_statistics():
    """Demonstrate statistical operations"""
    print("📊 Statistical Analysis")
    print("=" * 50)
    
    datasets = [
        ([1, 2, 3, 4, 5], "Simple sequence 1-5"),
        ([10, 20, 30, 40, 50], "Multiples of 10"),
        ([2, 4, 6, 8, 10, 12], "Even numbers"),
        ([1, 3, 3, 6, 7, 8, 9], "Mixed dataset with duplicate"),
    ]
    
    for data, description in datasets:
        print(f"📈 Dataset: {description}")
        print(f"   Data: {data}")
        
        try:
            mean_result = call_mcp_tool("mean", {"numbers": data})
            print(f"   → Mean: {mean_result['result']}")
        except Exception as e:
            print(f"   → Mean: Error - {e}")
        
        try:
            median_result = call_mcp_tool("median", {"numbers": data})
            print(f"   → Median: {median_result['result']}")
        except Exception as e:
            print(f"   → Median: Error - {e}")
        
        print()

def demonstrate_error_handling():
    """Demonstrate robust error handling"""
    print("🛡️ Error Handling Examples")
    print("=" * 50)
    
    error_cases = [
        ("divide", {"a": 10, "b": 0}, "Division by zero"),
        ("square_root", {"number": -4}, "Square root of negative number"),
        ("log", {"number": 0, "base": 10}, "Logarithm of zero"),
        ("factorial", {"number": -5}, "Factorial of negative number"),
    ]
    
    for tool, args, description in error_cases:
        print(f"Testing: {description}")
        try:
            result = call_mcp_tool(tool, args)
            print(f"   ✅ Result: {result['result']}")
        except requests.exceptions.HTTPError as e:
            print(f"   ❌ HTTP Error: {e}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        print()

def main():
    """Run all advanced examples"""
    print("🚀 Advanced MCP Bridge Demonstration")
    print("🔗 Connected to:", BRIDGE_URL)
    print()
    
    # Check connection
    try:
        health_response = requests.get(f"{BRIDGE_URL}/health", timeout=30)
        health_response.raise_for_status()
        print("✅ MCP Bridge is operational")
        print()
    except Exception as e:
        print(f"❌ Cannot connect to MCP Bridge: {e}")
        return
    
    # Show available tools
    try:
        tools = get_available_tools()
        print(f"🔧 Available tools: {len(tools)}")
        tool_names = [tool['name'] for tool in tools]
        print(f"   Tools: {', '.join(tool_names)}")
        print()
    except Exception as e:
        print(f"❌ Cannot fetch tools: {e}")
    
    # Run demonstrations
    demonstrate_advanced_math()
    demonstrate_problem_solving()
    demonstrate_statistics()
    demonstrate_error_handling()
    
    print("🎉 Advanced demonstration completed!")
    print("💡 Your MCP Bridge can handle sophisticated mathematical operations!")
    print("🔗 Ready for integration into complex applications!")

if __name__ == "__main__":
    main() 