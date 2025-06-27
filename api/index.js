// Vercel serverless function entry point
// Import our main Express app
const app = require('../mcp-bridge.js');

// Export the handler for Vercel
module.exports = app; 