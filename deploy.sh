#!/usr/bin/env bash
set -e

# ---- 0. EDIT THESE THREE LINES ------------------------------------
GITHUB_USER="yashmaheshwari-aisera"
GITHUB_EMAIL="yash.maheshwari@aisera.com"
RENDER_SERVICE_NAME="mcp-bridge"
# -------------------------------------------------------------------

# 1. Install Docker Desktop if missing (macOS)
if ! command -v docker &>/dev/null; then
  echo "Installing Docker Desktop..."
  brew install --cask docker
  open -a Docker
  echo "⏳  Waiting for Docker to start…" 
  while ! docker system info &>/dev/null; do sleep 2; done
fi

# 2. Build and test image locally
docker build -t mcp-bridge .
docker run -d --name bridge-test -p 3000:3000 \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  -e MCP_SERVER_URL="$MCP_SERVER_URL" \
  mcp-bridge
sleep 4
curl -f http://localhost:3000/health && echo "✅ Local container healthy"
docker stop bridge-test && docker rm bridge-test

# 3. Initialise Git repo if needed
if [ ! -d .git ]; then
  git init
  git config user.name "$GITHUB_USER"
  git config user.email "$GITHUB_EMAIL"
  git add .
  git commit -m "Initial commit"
  git branch -M main
  gh repo create "$GITHUB_USER/mcp-bridge-api-main" --public --source=. --remote=origin --push
else
  echo "Git repo already exists – skipping init."
fi

# 4. Log in to Render CLI (opens browser once)
if ! command -v render &>/dev/null; then
  npm install -g render-cli
fi
render login   # opens browser for OAuth

# 5. Create / update Render web service
render services list | grep -q "$RENDER_SERVICE_NAME" || \
render services create web \
  --name "$RENDER_SERVICE_NAME" \
  --branch main \
  --env docker \
  --plan free \
  --root .

render env:set GEMINI_API_KEY "$GEMINI_API_KEY" --service "$RENDER_SERVICE_NAME"
render env:set MCP_SERVER_URL "$MCP_SERVER_URL" --service "$RENDER_SERVICE_NAME"

echo "🎉  Render deployment triggered. Watch logs at:"
echo "    https://dashboard.render.com/web/srv-*/logs"