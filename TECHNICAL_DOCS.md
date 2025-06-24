# MCP Bridge API - Technical Documentation

## Table of Contents
1. [Comprehensive Codebase Analysis](#comprehensive-codebase-analysis)
2. [Detailed Setup Instructions](#detailed-setup-instructions)
3. [Security Implementation](#security-implementation)
4. [Deployment Guide](#deployment-guide)
5. [Configuration Details](#configuration-details)
6. [API Reference](#api-reference)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Comprehensive Codebase Analysis

### Project Architecture

The **MCP Bridge API** follows a sophisticated multi-tier architecture:

```
┌─────────────────────────────────────────────────────┐
│                 CLIENT LAYER                        │
├─────────────────┬─────────────────┬─────────────────┤
│ React Native    │ Python Clients  │ Any HTTP Client │
│ Mobile App      │ Testing Suite   │ Third-party     │
└─────────────────┴─────────────────┴─────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│                 BRIDGE LAYER                        │
├─────────────────┬─────────────────┬─────────────────┤
│ Express REST    │ Risk-Based      │ Docker          │
│ API Server      │ Security        │ Isolation       │
└─────────────────┴─────────────────┴─────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│                  MCP LAYER                          │
├─────────────────┬─────────────────┬─────────────────┤
│ STDIO MCP       │ HTTP MCP        │ SSE MCP         │
│ Servers         │ Servers         │ Servers         │
└─────────────────┴─────────────────┴─────────────────┘
```

### Core Components

#### 1. MCP Bridge Server (`mcp-bridge.js`)

**Lines of Code**: 1,440  
**Purpose**: RESTful proxy for MCP servers  

**Key Functions:**
- `startServer(serverId, config)` - Initializes MCP servers
- `sendMCPRequest(serverId, method, params)` - Proxies requests to MCP servers
- `loadServerConfig()` - Loads and validates server configurations
- `startHTTPServer()` - Handles HTTP MCP connections
- `shutdownServer()` - Graceful server shutdown

**Risk-Based Security Implementation:**
```javascript
const RISK_LEVEL = {
  LOW: 1,      // Standard execution
  MEDIUM: 2,   // Requires user confirmation  
  HIGH: 3      // Docker isolation required
};
```

#### 2. React Native Mobile App

**Location**: `/reactnative-gamini-mcp-agent/`  
**Architecture**:

```
app/
├── (tabs)/
│   ├── index.tsx          # Main chat interface (875 lines)
│   └── explore.tsx        # Settings and configuration
├── _layout.tsx            # Root navigation
└── modal.tsx              # Modal dialogs

components/
├── ChatComponent.tsx      # Main chat UI (2,126 lines)
├── Settings.tsx           # Configuration UI (760 lines)
├── ConversationHistory.tsx # Chat history management
└── ui/                    # Reusable UI components

services/
├── api.ts                 # MCP Bridge API client
├── gemini.ts              # Google Gemini integration
├── systemInstruction.ts   # AI tool orchestration
├── conversationStorage.ts # Chat persistence
└── autoConfig.ts          # Auto-configuration logic
```

**Key Technical Features:**
- **Intelligent Tool Selection**: Gemini AI automatically selects appropriate MCP tools
- **Multi-Step Reasoning**: Chains multiple tool calls for complex operations
- **Offline Storage**: AsyncStorage for conversation and configuration persistence
- **Modern UI**: Material Design 3 with dark theme support
- **Real-time Updates**: Live configuration status and health checks

#### 3. Python Client Suite

**Location**: `/access-bridge/`

```python
# Core client library
client.py              # Simple API wrapper class (200 lines)
MCPBridgeClient       # Full-featured client with error handling

# Usage examples
simple_api_example.py  # Basic integration patterns (150 lines)
advanced_example.py    # Complex mathematical operations (300 lines)
async_example.py       # Asynchronous operations (250 lines)

# API documentation
http_examples.md       # HTTP request/response examples
MCP_Bridge_API.postman_collection.json  # Postman collection
```

**Advanced Client Features:**
```python
class MCPBridgeClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def execute_tool_with_retry(self, server_id, tool_name, parameters, max_retries=3):
        """Execute tool with automatic retry logic"""
        for attempt in range(max_retries):
            try:
                return self.execute_tool(server_id, tool_name, parameters)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff
    
    def batch_execute(self, operations):
        """Execute multiple operations in sequence"""
        results = []
        for op in operations:
            result = self.execute_tool(op['server'], op['tool'], op['params'])
            results.append(result)
        return results
```

---

## Detailed Setup Instructions

### Environment Setup

#### 1. System Requirements

**Minimum Requirements:**
- Node.js 18.0+ 
- Python 3.8+
- 4GB RAM
- 10GB disk space

**Recommended for Development:**
- Node.js 20.0+
- Python 3.11+
- 8GB RAM
- 20GB disk space
- Docker (for risk-level 3 operations)

#### 2. Environment Variables Configuration

**Root Directory `.env`:**
```bash
# Required
GEMINI_API_KEY=your_actual_gemini_api_key_here
MCP_SERVER_URL=https://mcp-proxy.yashmahe2021.workers.dev/mcp

# Optional
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
MAX_SERVERS=10
REQUEST_TIMEOUT=30000
ENABLE_CORS=true
```

**React Native `.env.local`:**
```bash
# Required
EXPO_PUBLIC_GEMINI_API_KEY=your_actual_gemini_api_key_here
EXPO_PUBLIC_MCP_BRIDGE_URL=http://localhost:3000

# Optional
EXPO_PUBLIC_GEMINI_MODEL=gemini-1.5-flash
EXPO_PUBLIC_MAX_TOKENS=2048
EXPO_PUBLIC_TEMPERATURE=0.7
EXPO_PUBLIC_ENABLE_DEBUG=false
```

#### 3. Step-by-Step Installation

**Step 1: Clone and Setup**
```bash
git clone https://github.com/yashmaheshwari-aisera/mcp-bridge-api-main.git
cd mcp-bridge-api-main

# Install Node.js dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your actual values
```

**Step 2: Configure MCP Servers**
```bash
# Edit mcp_config.json
{
  "mcpServers": {
    "math-server": {
      "type": "http",
      "url": "${MCP_SERVER_URL}",
      "description": "Cloudflare-hosted math MCP server",
      "timeout": 30000,
      "retries": 3
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/safe/directory"],
      "riskLevel": 2,
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Step 3: Start Services**
```bash
# Terminal 1: Start MCP Bridge
node mcp-bridge.js

# Terminal 2: Setup React Native
cd reactnative-gamini-mcp-agent
npm install
cp .env.local.example .env.local
# Edit .env.local with your values
npx expo start

# Terminal 3: Test Python clients
cd access-bridge
pip install -r requirements.txt
python client.py
```

### Advanced Configuration Options

#### MCP Server Types and Configuration

**STDIO Servers:**
```json
{
  "server-name": {
    "command": "node",
    "args": ["server.js"],
    "cwd": "/path/to/server",
    "env": {
      "API_KEY": "${API_KEY}"
    },
    "riskLevel": 1,
    "timeout": 30000
  }
}
```

**HTTP Servers:**
```json
{
  "server-name": {
    "type": "http",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}"
    },
    "timeout": 15000,
    "retries": 3
  }
}
```

**SSE Servers:**
```json
{
  "server-name": {
    "type": "sse",
    "url": "https://api.example.com/mcp/events",
    "reconnectInterval": 5000,
    "maxReconnects": 10
  }
}
```

**Docker-Isolated Servers:**
```json
{
  "server-name": {
    "command": "python",
    "args": ["server.py"],
    "riskLevel": 3,
    "docker": {
      "image": "python:3.11-slim",
      "volumes": ["/tmp:/tmp:rw"],
      "network": "bridge",
      "memory": "512m",
      "cpus": "0.5"
    }
  }
}
```

---

## Security Implementation

### Risk-Based Security System

The MCP Bridge implements a three-tier security model:

#### Risk Level 1 (Low Risk)
- **Behavior**: Direct execution without confirmation
- **Use Cases**: Read-only operations, simple calculations
- **Implementation**: Standard MCP protocol execution

#### Risk Level 2 (Medium Risk)
- **Behavior**: Requires user confirmation before execution
- **Use Cases**: File system operations, API calls
- **Implementation**: 
  1. Client makes tool execution request
  2. Server responds with confirmation request + confirmationId
  3. Client prompts user for approval
  4. Client sends confirmation to `/confirmations/{confirmationId}`
  5. Server executes operation after confirmation

**Example Confirmation Flow:**
```javascript
// Server response for medium risk operation
{
  "requiresConfirmation": true,
  "confirmationId": "uuid-123-456",
  "operation": "write_file",
  "parameters": {"path": "/important/file.txt", "content": "data"},
  "riskReason": "File system write operation"
}

// Client confirmation request
POST /confirmations/uuid-123-456
{
  "confirmed": true,
  "userApproval": "User approved file write operation"
}
```

#### Risk Level 3 (High Risk)
- **Behavior**: Automatic execution in Docker container
- **Use Cases**: Code execution, system operations
- **Implementation**: Server automatically spawns Docker container for isolation

**Docker Configuration Example:**
```json
{
  "docker": {
    "image": "node:18-alpine",
    "volumes": ["/tmp:/workspace:rw"],
    "network": "none",
    "memory": "256m",
    "cpus": "0.25",
    "timeout": 30,
    "removeAfter": true
  }
}
```

### Security Best Practices

#### 1. Environment Variable Security
```bash
# Use secure environment variable management
export GEMINI_API_KEY="$(cat /secure/path/to/api-key)"

# Never commit .env files
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

#### 2. Network Security
```javascript
// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

#### 3. Input Validation
```javascript
// Parameter validation
function validateToolParameters(toolSchema, parameters) {
  const errors = [];
  for (const [param, schema] of Object.entries(toolSchema.inputSchema?.properties || {})) {
    if (schema.required && !(param in parameters)) {
      errors.push(`Missing required parameter: ${param}`);
    }
    if (param in parameters && !validateType(parameters[param], schema.type)) {
      errors.push(`Invalid type for parameter ${param}: expected ${schema.type}`);
    }
  }
  return errors;
}
```

#### 4. Rate Limiting
```javascript
// Rate limiting implementation
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/servers', limiter);
```

---

## Deployment Guide

### Local Development Deployment

#### Quick Start
```bash
# Development environment
npm run dev          # Starts MCP Bridge with nodemon
npm run test         # Runs test suite
npm run lint         # Code linting

# React Native development
cd reactnative-gamini-mcp-agent
npx expo start --dev-client
```

### Production Deployment Options

#### 1. Render.com Deployment (Current)

**Automated Deployment:**
- Repository: https://github.com/yashmaheshwari-aisera/mcp-bridge-api-main
- Live URL: https://mcp-bridge-api-main.onrender.com
- Auto-deployment on git push

**Manual Deployment Steps:**
1. Connect GitHub repository to Render
2. Configure environment variables:
   ```
   GEMINI_API_KEY=your_actual_key
   MCP_SERVER_URL=https://mcp-proxy.yashmahe2021.workers.dev/mcp
   NODE_ENV=production
   PORT=3000
   ```
3. Deploy using provided `Dockerfile`

#### 2. Docker Deployment

**Build and Run:**
```bash
# Build Docker image
docker build -t mcp-bridge-api .

# Run container
docker run -d \
  --name mcp-bridge \
  -p 3000:3000 \
  -e GEMINI_API_KEY=your_key \
  -e MCP_SERVER_URL=your_server_url \
  mcp-bridge-api
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  mcp-bridge:
    build: .
    ports:
      - "3000:3000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - MCP_SERVER_URL=${MCP_SERVER_URL}
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### 3. Cloud Platform Deployment

**AWS ECS:**
```json
{
  "family": "mcp-bridge",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "mcp-bridge",
      "image": "your-account.dkr.ecr.region.amazonaws.com/mcp-bridge:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "GEMINI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:gemini-api-key"
        }
      ]
    }
  ]
}
```

**Google Cloud Run:**
```bash
# Deploy to Cloud Run
gcloud run deploy mcp-bridge \
  --image gcr.io/PROJECT-ID/mcp-bridge \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key
```

### React Native App Deployment

#### iOS Deployment
```bash
# Build for iOS
cd reactnative-gamini-mcp-agent
eas build --platform ios

# Submit to App Store
eas submit --platform ios
```

#### Android Deployment
```bash
# Build for Android
eas build --platform android

# Submit to Google Play
eas submit --platform android
```

#### Web Deployment
```bash
# Build for web
npx expo export --platform web

# Deploy to Netlify/Vercel
npm run deploy:web
```

---

## Configuration Details

### Advanced MCP Server Configuration

#### Server Health Monitoring
```json
{
  "mcpServers": {
    "monitored-server": {
      "command": "node",
      "args": ["server.js"],
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 5000,
        "retries": 3,
        "failureThreshold": 3
      },
      "autoRestart": {
        "enabled": true,
        "maxRestarts": 5,
        "restartDelay": 5000
      }
    }
  }
}
```

#### Load Balancing Configuration
```json
{
  "mcpServers": {
    "load-balanced-server": {
      "type": "pool",
      "instances": [
        {
          "id": "instance-1",
          "command": "node",
          "args": ["server.js"],
          "weight": 1
        },
        {
          "id": "instance-2", 
          "command": "node",
          "args": ["server.js"],
          "weight": 2
        }
      ],
      "strategy": "round-robin" // or "least-connections", "weighted"
    }
  }
}
```

#### Resource Limits
```json
{
  "mcpServers": {
    "resource-limited-server": {
      "command": "python",
      "args": ["memory-intensive-server.py"],
      "resources": {
        "maxMemory": "512MB",
        "maxCpu": "50%",
        "timeout": 30000,
        "maxConcurrentRequests": 10
      }
    }
  }
}
```

### Gemini AI Configuration

#### Model Selection and Parameters
```typescript
// services/gemini.ts configuration
const GEMINI_MODELS = {
  'gemini-1.5-pro': {
    maxTokens: 8192,
    temperature: 0.7,
    topP: 0.9,
    topK: 40
  },
  'gemini-1.5-flash': {
    maxTokens: 4096,
    temperature: 0.5,
    topP: 0.8,
    topK: 30
  },
  'gemini-2.5-flash-preview': {
    maxTokens: 8192,
    temperature: 0.3,
    topP: 0.9,
    topK: 50
  }
};
```

#### System Instructions
```typescript
// services/systemInstruction.ts
export const SYSTEM_INSTRUCTION = `
You are an intelligent MCP tool orchestrator. You have access to the following capabilities:

1. Mathematical operations via Cloudflare Math Server
2. File system operations (with appropriate permissions)
3. Multi-step reasoning for complex tasks

When a user makes a request:
1. Analyze the request to determine required tools
2. Plan the sequence of operations
3. Execute tools in the optimal order
4. Provide clear explanations of your actions
5. Handle errors gracefully and suggest alternatives

Security considerations:
- Always confirm before file system modifications
- Validate inputs before tool execution
- Provide clear explanations for security-sensitive operations
`;
```

---

## API Reference

### Complete Endpoint Documentation

#### Health and Status Endpoints

**GET /health**
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "servers": {
    "math-server": "connected",
    "filesystem": "connected"
  },
  "memory": {
    "used": "45MB",
    "free": "178MB",
    "total": "223MB"
  }
}
```

**GET /servers**
```bash
curl http://localhost:3000/servers
```

Response:
```json
{
  "servers": [
    {
      "id": "math-server",
      "type": "http",
      "status": "connected",
      "url": "https://mcp-proxy.yashmahe2021.workers.dev/mcp",
      "lastPing": "2024-01-15T10:29:55Z",
      "responseTime": 45,
      "riskLevel": 1
    },
    {
      "id": "filesystem", 
      "type": "stdio",
      "status": "connected",
      "pid": 12345,
      "uptime": 3540,
      "riskLevel": 2
    }
  ]
}
```

#### Tool Execution Endpoints

**GET /servers/{serverId}/tools**
```bash
curl http://localhost:3000/servers/math-server/tools
```

Response:
```json
{
  "tools": [
    {
      "name": "add",
      "description": "Add two numbers",
      "inputSchema": {
        "type": "object",
        "properties": {
          "a": {"type": "number", "description": "First number"},
          "b": {"type": "number", "description": "Second number"}
        },
        "required": ["a", "b"]
      }
    },
    {
      "name": "quadratic",
      "description": "Solve quadratic equation ax²+bx+c=0",
      "inputSchema": {
        "type": "object",
        "properties": {
          "a": {"type": "number"},
          "b": {"type": "number"},
          "c": {"type": "number"}
        },
        "required": ["a", "b", "c"]
      }
    }
  ]
}
```

**POST /servers/{serverId}/tools/{toolName}**
```bash
curl -X POST http://localhost:3000/servers/math-server/tools/add \
  -H "Content-Type: application/json" \
  -d '{"a": 15, "b": 27}'
```

Response:
```json
{
  "toolResult": {
    "content": [
      {
        "type": "text",
        "text": "{\"result\": 42, \"operation\": \"15 + 27\"}"
      }
    ]
  },
  "executionTime": 123,
  "server": "math-server",
  "tool": "add"
}
```

#### Risk-Level Confirmation Endpoints

**Medium Risk Tool Response:**
```json
{
  "requiresConfirmation": true,
  "confirmationId": "conf_abc123def456",
  "operation": {
    "server": "filesystem",
    "tool": "write_file",
    "parameters": {
      "path": "/tmp/test.txt",
      "content": "Hello World"
    }
  },
  "riskLevel": 2,
  "riskReason": "File system write operation",
  "timeout": 300
}
```

**POST /confirmations/{confirmationId}**
```bash
curl -X POST http://localhost:3000/confirmations/conf_abc123def456 \
  -H "Content-Type: application/json" \
  -d '{"confirmed": true, "userNote": "Approved by user"}'
```

#### Server Management Endpoints

**POST /servers** (Dynamic Server Addition)
```bash
curl -X POST http://localhost:3000/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "new-server",
    "command": "node",
    "args": ["new-server.js"],
    "riskLevel": 1,
    "env": {
      "API_KEY": "secret"
    }
  }'
```

**DELETE /servers/{serverId}**
```bash
curl -X DELETE http://localhost:3000/servers/filesystem
```

### Error Handling

#### Standard Error Response Format
```json
{
  "error": {
    "code": "TOOL_EXECUTION_FAILED",
    "message": "Tool execution failed: Division by zero",
    "details": {
      "server": "math-server",
      "tool": "divide",
      "parameters": {"a": 10, "b": 0}
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

#### Common Error Codes
- `SERVER_NOT_FOUND` - MCP server not available
- `TOOL_NOT_FOUND` - Requested tool not available
- `INVALID_PARAMETERS` - Tool parameters validation failed
- `CONFIRMATION_REQUIRED` - Medium risk operation needs confirmation
- `CONFIRMATION_TIMEOUT` - User confirmation timed out
- `DOCKER_EXECUTION_FAILED` - High risk Docker execution failed
- `SERVER_TIMEOUT` - MCP server response timeout
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Development Workflow

### Development Environment Setup

#### IDE Configuration

**VSCode Settings (`.vscode/settings.json`):**
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.env": true
  }
}
```

**Recommended Extensions:**
- ES7+ React/Redux/React-Native snippets
- TypeScript Hero
- Docker
- Thunder Client (API testing)
- GitLens

#### Git Workflow

**Branch Strategy:**
```bash
main                 # Production branch
├── develop         # Development branch  
├── feature/*       # Feature branches
├── hotfix/*        # Hotfix branches
└── release/*       # Release branches
```

**Commit Message Format:**
```
type(scope): description

feat(api): add support for SSE MCP servers
fix(mobile): resolve chat history persistence issue
docs(readme): update installation instructions
refactor(bridge): improve error handling
test(client): add unit tests for retry logic
```

#### Testing Strategy

**Unit Tests:**
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

**Integration Tests:**
```bash
# Test MCP Bridge API
npm run test:integration

# Test React Native components
cd reactnative-gamini-mcp-agent
npm run test:integration
```

**End-to-End Tests:**
```bash
# Full system test
npm run test:e2e

# Mobile app E2E
cd reactnative-gamini-mcp-agent
npm run test:e2e
```

### Code Quality Tools

#### ESLint Configuration (`.eslintrc.js`)
```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-const': 'error'
  }
};
```

#### Prettier Configuration (`.prettierrc`)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Build and Release Process

#### Build Scripts
```json
{
  "scripts": {
    "build": "tsc && npm run build:client",
    "build:client": "cd reactnative-gamini-mcp-agent && expo export",
    "build:docker": "docker build -t mcp-bridge-api .",
    "build:production": "NODE_ENV=production npm run build"
  }
}
```

#### Release Process
1. Update version in `package.json`
2. Update changelog
3. Create release branch
4. Run full test suite
5. Build and test Docker image
6. Merge to main
7. Tag release
8. Deploy to production

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. MCP Bridge Won't Start

**Symptoms:**
- Server fails to start
- Port already in use error
- Environment variable errors

**Solutions:**
```bash
# Check if port is in use
lsof -i :3000

# Kill process using port
kill -9 $(lsof -t -i:3000)

# Check environment variables
node -e "require('dotenv').config(); console.log(process.env.GEMINI_API_KEY ? 'API key loaded' : 'API key missing');"

# Verify dependencies
npm ls --depth=0
```

#### 2. React Native Build Failures

**Symptoms:**
- Metro bundler errors
- Expo build failures
- Native module issues

**Solutions:**
```bash
# Clear Metro cache
npx expo start --clear

# Reset Expo cache
rm -rf node_modules
npm install
npx expo install --fix

# Clear iOS build cache (macOS)
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clear Android build cache
cd android && ./gradlew clean && cd ..
```

#### 3. MCP Server Connection Issues

**Symptoms:**
- Server shows as disconnected
- Tool execution failures
- Timeout errors

**Solutions:**
```bash
# Test MCP server directly
curl http://localhost:3000/servers/math-server/tools

# Check server logs
node mcp-bridge.js --verbose

# Verify server configuration
cat mcp_config.json | jq '.mcpServers'

# Test network connectivity
curl -I https://mcp-proxy.yashmahe2021.workers.dev/mcp
```

#### 4. Python Client Issues

**Symptoms:**
- Import errors
- API connection failures
- Authentication errors

**Solutions:**
```bash
# Verify Python environment
python --version
pip list | grep requests

# Test API connectivity
python -c "import requests; print(requests.get('http://localhost:3000/health').json())"

# Check environment variables
python -c "import os; print('GEMINI_API_KEY' in os.environ)"

# Reinstall dependencies
pip install --upgrade -r access-bridge/requirements.txt
```

#### 5. Docker Deployment Issues

**Symptoms:**
- Container build failures
- Runtime errors
- Port binding issues

**Solutions:**
```bash
# Check Docker version
docker --version

# Build with verbose output
docker build --no-cache -t mcp-bridge-api .

# Check container logs
docker logs mcp-bridge-api

# Test container networking
docker run --rm -p 3000:3000 mcp-bridge-api

# Check port availability
netstat -tulpn | grep :3000
```

### Performance Optimization

#### 1. MCP Bridge Performance

**Memory Optimization:**
```javascript
// Implement connection pooling
const connectionPool = new Map();
const MAX_CONNECTIONS = 10;

function getConnection(serverId) {
  if (!connectionPool.has(serverId)) {
    if (connectionPool.size >= MAX_CONNECTIONS) {
      // Remove oldest connection
      const oldest = connectionPool.keys().next().value;
      connectionPool.delete(oldest);
    }
    connectionPool.set(serverId, createConnection(serverId));
  }
  return connectionPool.get(serverId);
}
```

**Request Caching:**
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

app.get('/servers/:serverId/tools', (req, res) => {
  const cacheKey = `tools_${req.params.serverId}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }
  
  // Fetch tools and cache result
  fetchTools(req.params.serverId).then(tools => {
    cache.set(cacheKey, tools);
    res.json(tools);
  });
});
```

#### 2. React Native Performance

**Optimize Re-renders:**
```typescript
// Use React.memo for expensive components
const ChatMessage = React.memo(({ message, onAction }) => {
  return (
    <View>
      <Text>{message.content}</Text>
      {message.actions && (
        <ActionButtons actions={message.actions} onAction={onAction} />
      )}
    </View>
  );
});

// Use useCallback for stable function references
const handleToolExecution = useCallback(async (toolName, params) => {
  setLoading(true);
  try {
    const result = await api.executeTool(toolName, params);
    updateConversation(result);
  } finally {
    setLoading(false);
  }
}, [api, updateConversation]);
```

**Optimize Bundle Size:**
```typescript
// Lazy load components
const Settings = lazy(() => import('./components/Settings'));
const ConversationHistory = lazy(() => import('./components/ConversationHistory'));

// Use dynamic imports for large libraries
const loadMathLibrary = async () => {
  const mathLib = await import('heavy-math-library');
  return mathLib.default;
};
```

### Monitoring and Logging

#### 1. Application Monitoring

**Health Check Implementation:**
```javascript
const healthCheck = {
  async checkMCPServers() {
    const results = {};
    for (const serverId of Object.keys(mcpServers)) {
      try {
        const start = Date.now();
        await sendMCPRequest(serverId, 'ping', {});
        results[serverId] = {
          status: 'healthy',
          responseTime: Date.now() - start
        };
      } catch (error) {
        results[serverId] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    return results;
  },
  
  async getSystemMetrics() {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      activeConnections: Object.keys(mcpServers).length
    };
  }
};
```

#### 2. Structured Logging

**Logger Configuration:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage throughout application
logger.info('MCP server started', {
  serverId: 'math-server',
  pid: process.pid,
  timestamp: new Date().toISOString()
});

logger.error('Tool execution failed', {
  serverId: 'filesystem',
  toolName: 'write_file',
  error: error.message,
  stack: error.stack
});
```

---

This comprehensive technical documentation provides all the detailed information needed for development, deployment, and maintenance of the MCP Bridge API system. 