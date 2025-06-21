#!/usr/bin/env python3
"""Minimal MCP-Bridge client.

Run:
    python client.py
"""
import os
import json
from textwrap import indent

import requests

BRIDGE = os.getenv("BRIDGE_URL", "https://3597-12-26-3-202.ngrok-free.app")
S = requests.Session()


def pretty(obj):
    return indent(json.dumps(obj, indent=2), "  ")


def health():
    r = S.get(f"{BRIDGE}/health", timeout=10)
    r.raise_for_status()
    return r.json()


def servers():
    return S.get(f"{BRIDGE}/servers", timeout=10).json()["servers"]


def tools(server_id: str):
    return S.get(f"{BRIDGE}/servers/{server_id}/tools", timeout=10).json()["tools"]


def call_tool(server_id: str, tool: str, **params):
    r = S.post(
        f"{BRIDGE}/servers/{server_id}/tools/{tool}",
        json=params,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    print("→ BRIDGE URL:", BRIDGE)

    print("\n== Health ==")
    print(pretty(health()))

    print("\n== Servers ==")
    svrs = servers()
    print(pretty(svrs))
    if not svrs:
        print("No servers connected – nothing else to do.")
        exit()

    sid = svrs[0]["id"]

    print(f"\n== Tools on {sid} ==")
    print(pretty(tools(sid)))

    # Example: call math add if present
    try:
        print("\n== Calling add(a=5,b=8) ==")
        res = call_tool(sid, "add", a=5, b=8)
        # The math server returns JSON inside content[0].text
        data = json.loads(res["content"][0]["text"])
        print("Result:", data["result"])
    except Exception as e:
        print("Could not call add tool:", e) 