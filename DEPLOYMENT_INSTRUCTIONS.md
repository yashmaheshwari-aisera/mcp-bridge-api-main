# MCP Bridge Deployment Instructions

## ✅ What's Been Completed

1. **Docker Image Built & Tested** ✅
   - Container builds successfully
   - Health endpoint working at `/health`
   - MCP server connection verified

2. **GitHub Repository Created** ✅
   - Repository: https://github.com/yashmaheshwari-aisera/mcp-bridge-api-main
   - All code pushed successfully
   - Render configuration file added

## 🚀 Next Steps: Deploy to Render

Since the Render CLI had issues, please follow these manual deployment steps:

### Step 1: Go to Render Dashboard
1. Visit https://render.com/
2. Sign up/Login with your GitHub account

### Step 2: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub account if not already connected
3. Select the repository: `yashmaheshwari-aisera/mcp-bridge-api-main`

### Step 3: Configure Deployment
- **Name**: `mcp-bridge`
- **Environment**: `Docker`
- **Plan**: `Free`
- **Branch**: `main`
- **Dockerfile Path**: `./Dockerfile`

### Step 4: Set Environment Variables
In the "Environment" section, add:

1. **GEMINI_API_KEY**
   - Value: `[YOUR_ACTUAL_GEMINI_API_KEY]`
   - ⚠️ **IMPORTANT**: Replace with your real API key

2. **MCP_SERVER_URL** 
   - Value: `https://mcp-proxy.yashmahe2021.workers.dev/mcp`
   - ✅ Already configured

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Your API will be available at: `https://mcp-bridge-[random].onrender.com`

## 🧪 Testing Your Deployed API

Once deployed, test these endpoints:

```bash
# Health check
curl https://your-render-url.onrender.com/health

# List servers
curl https://your-render-url.onrender.com/servers

# List tools
curl https://your-render-url.onrender.com/tools

# Execute math operation
curl -X POST https://your-render-url.onrender.com/tools/add \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'
```

## 📁 Using the Python Client

Update the `access-bridge/client.py` file with your deployed URL:

```python
BASE_URL = "https://your-render-url.onrender.com"
```

Then run:
```bash
cd access-bridge
pip install -r requirements.txt
python client.py
```

## 🔧 Troubleshooting

- **Build fails**: Check Dockerfile and dependencies
- **Health check fails**: Verify environment variables are set
- **MCP connection fails**: Check MCP_SERVER_URL is correct
- **API key issues**: Ensure GEMINI_API_KEY is properly set

## 📊 What You'll Get

- **Public HTTPS API** accessible from anywhere
- **24/7 uptime** (free tier has some limitations)
- **Automatic deployments** on Git push
- **Built-in monitoring** and logs
- **Custom domain** support (paid plans)

Your MCP Bridge will be accessible to any client that can make HTTP requests! 