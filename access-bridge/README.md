# Access-Bridge Demo

A minimal Python client that connects to your **public MCP Bridge** hosted at

```
https://3597-12-26-3-202.ngrok-free.app
```

and shows how to

1. Check health
2. List connected MCP servers
3. List tools on the first server
4. Execute the `add` tool on the `math-server`

## Quick start

```bash
cd access-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python client.py
```

Edit `client.py` to call other tools/prompts or adjust the base URL. 