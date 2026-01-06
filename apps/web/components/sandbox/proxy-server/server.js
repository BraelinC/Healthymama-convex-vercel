/**
 * WebSocket Proxy Server for Daytona Terminals
 *
 * This server proxies WebSocket connections from your frontend to Daytona's
 * terminal WebSocket endpoint. Deploy this on Railway, Fly.io, Render, or similar.
 *
 * Usage:
 *   npm install
 *   node server.js
 *
 * Environment variables:
 *   PORT - Server port (default: 3001)
 *   ALLOWED_ORIGINS - Comma-separated list of allowed origins for CORS
 */

const http = require("http");
const WebSocket = require("ws");
const url = require("url");

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Daytona Terminal Proxy Server\n\nConnect via WebSocket to /terminal/:sandboxId");
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", (clientWs, req) => {
  // Check origin
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin) && !ALLOWED_ORIGINS.includes("*")) {
    console.log(`Rejected connection from origin: ${origin}`);
    clientWs.close(1008, "Origin not allowed");
    return;
  }

  // Parse sandbox ID from URL: /terminal/:sandboxId
  const pathname = url.parse(req.url).pathname;
  const match = pathname.match(/^\/terminal\/([a-zA-Z0-9_-]+)$/);

  if (!match) {
    console.log(`Invalid URL: ${pathname}`);
    clientWs.close(1008, "Invalid URL. Use /terminal/:sandboxId");
    return;
  }

  const sandboxId = match[1];
  console.log(`New connection for sandbox: ${sandboxId}`);

  // Connect to Daytona terminal WebSocket
  // Note: The exact URL format may vary - check Daytona docs
  const daytonaWsUrl = `wss://${sandboxId}-22222.daytona.app/ws`;

  let daytonaWs;
  try {
    daytonaWs = new WebSocket(daytonaWsUrl);
  } catch (err) {
    console.error(`Failed to connect to Daytona: ${err.message}`);
    clientWs.close(1011, "Failed to connect to terminal");
    return;
  }

  // Track connection state
  let isOpen = false;
  const messageQueue = [];

  daytonaWs.on("open", () => {
    console.log(`Connected to Daytona terminal: ${sandboxId}`);
    isOpen = true;

    // Send any queued messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      daytonaWs.send(msg);
    }
  });

  daytonaWs.on("message", (data) => {
    // Forward data from Daytona to client
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  daytonaWs.on("error", (err) => {
    console.error(`Daytona WebSocket error: ${err.message}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, "Terminal connection error");
    }
  });

  daytonaWs.on("close", (code, reason) => {
    console.log(`Daytona connection closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason);
    }
  });

  // Handle client messages
  clientWs.on("message", (data) => {
    // Forward data from client to Daytona
    if (isOpen && daytonaWs.readyState === WebSocket.OPEN) {
      daytonaWs.send(data);
    } else {
      // Queue messages until connection is open
      messageQueue.push(data);
    }
  });

  clientWs.on("close", () => {
    console.log(`Client disconnected: ${sandboxId}`);
    if (daytonaWs.readyState === WebSocket.OPEN) {
      daytonaWs.close();
    }
  });

  clientWs.on("error", (err) => {
    console.error(`Client WebSocket error: ${err.message}`);
    if (daytonaWs.readyState === WebSocket.OPEN) {
      daytonaWs.close();
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Terminal proxy server running on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`\nConnect via: ws://localhost:${PORT}/terminal/:sandboxId`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
