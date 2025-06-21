# Lightweight Docker image to run MCP Bridge
# -----------------------------------------
# Build:
#   docker build -t mcp-bridge .
# Run locally:
#   docker run -p 3000:3000 \
#     -e GEMINI_API_KEY=$GEMINI_API_KEY \
#     -e MCP_SERVER_URL=$MCP_SERVER_URL \
#     mcp-bridge
# -----------------------------------------
FROM node:18-alpine AS base

WORKDIR /app

# Install production deps first (package.json + lockfile)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force;

# Copy rest of the code
COPY . .

# Bridge listens on 3000
ENV PORT=3000
EXPOSE 3000

# Default command
CMD ["node", "mcp-bridge.js"] 