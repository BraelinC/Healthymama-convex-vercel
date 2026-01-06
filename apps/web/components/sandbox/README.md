# Sandbox Terminal Component

This component provides a terminal interface to Daytona sandboxes running OpenCode.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SandboxPanel                                            │   │
│  │  - Create/Stop sandbox buttons                          │   │
│  │  - Sandbox status display                               │   │
│  │  - XTerminal component                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│    CONVEX       │ │  DAYTONA API    │ │  DAYTONA WEB TERMINAL   │
│  (State Sync)   │ │  (Actions)      │ │  (iframe / WebSocket)   │
│                 │ │                 │ │                         │
│ - Sandbox list  │ │ - Create        │ │ - port 22222            │
│ - Status        │ │ - Stop          │ │ - xterm.js in browser   │
│ - Activity      │ │ - Exec          │ │                         │
└─────────────────┘ └─────────────────┘ └─────────────────────────┘
```

## Components

### XTerminal

The terminal component that renders in the browser. It attempts to connect via WebSocket first, then falls back to iframe.

```tsx
<XTerminal
  wsUrl="wss://sandbox-22222.daytona.app/ws"  // WebSocket (if available)
  iframeUrl="https://sandbox-22222.daytona.app"  // Fallback
  height="500px"
  onConnect={() => console.log("Connected")}
  onDisconnect={() => console.log("Disconnected")}
/>
```

### SandboxPanel

Full-featured panel with sandbox creation, status display, and terminal.

```tsx
<SandboxPanel defaultRepoUrl="https://github.com/user/repo.git" />
```

## Terminal Connection Methods

### Method 1: iframe (Default, Works Immediately)

The iframe approach embeds Daytona's web terminal directly. This works out of the box but has some limitations:
- Less styling control
- Can't intercept keystrokes
- Separate scrolling context

### Method 2: WebSocket (Full Control)

For full xterm.js integration, you need a WebSocket connection. However, Vercel serverless functions don't support long-lived WebSocket connections.

**Options for WebSocket:**

1. **Direct Connection** (if Daytona allows CORS):
   ```tsx
   <XTerminal wsUrl="wss://sandbox-22222.daytona.app/ws" />
   ```

2. **Proxy Server** (recommended):
   Deploy a small WebSocket proxy on:
   - Railway
   - Fly.io
   - Render
   - Your own server

   See `proxy-server/` for a ready-to-deploy proxy.

## Environment Variables

Add to your `.env.local`:

```bash
# Daytona API
DAYTONA_API_KEY=your_daytona_api_key

# Optional: Custom Daytona API URL
DAYTONA_API_URL=https://api.daytona.io

# Optional: WebSocket proxy URL (if using proxy)
NEXT_PUBLIC_WS_PROXY_URL=wss://your-proxy.fly.dev
```

## Usage

1. Navigate to `/sandbox` in your app
2. Click "Start OpenCode Agent"
3. Wait for sandbox to be created (~30-60 seconds)
4. Terminal opens automatically
5. Run `tmux attach -t main` to see OpenCode

## TMUX Shortcuts

Once connected to tmux:

| Shortcut | Action |
|----------|--------|
| `Ctrl+A 1` | Go to OpenCode window |
| `Ctrl+A 2` | Go to shell window |
| `Ctrl+A 3` | Go to git window |
| `Ctrl+A \|` | Split pane vertically |
| `Ctrl+A -` | Split pane horizontally |
| `Ctrl+A d` | Detach (session keeps running) |

## Dependencies

Install these in your web app:

```bash
npm install xterm xterm-addon-fit xterm-addon-web-links
```

## Styling

The terminal uses a GitHub Dark theme by default. Customize in `Terminal.tsx`:

```tsx
theme: {
  background: "#0d1117",
  foreground: "#c9d1d9",
  cursor: "#58a6ff",
  // ... more colors
}
```
