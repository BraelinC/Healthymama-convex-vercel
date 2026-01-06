"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

interface TerminalProps {
  /** WebSocket URL for terminal connection */
  wsUrl?: string;
  /** Fallback: iframe URL if WebSocket doesn't work */
  iframeUrl?: string;
  /** Terminal height */
  height?: string;
  /** Called when terminal connects */
  onConnect?: () => void;
  /** Called when terminal disconnects */
  onDisconnect?: () => void;
  /** Called on connection error */
  onError?: (error: string) => void;
}

export function XTerminal({
  wsUrl,
  iframeUrl,
  height = "500px",
  onConnect,
  onDisconnect,
  onError,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [useIframe, setUseIframe] = useState(false);

  // Handle terminal resize
  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      fitAddonRef.current.fit();

      // Send resize to server if connected
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const dims = {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows,
        };
        socketRef.current.send(JSON.stringify({ type: "resize", ...dims }));
      }
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || !wsUrl) {
      // Fall back to iframe if no wsUrl
      if (iframeUrl) {
        setUseIframe(true);
      }
      return;
    }

    // Create terminal instance
    const terminal = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        cursorAccent: "#0d1117",
        selectionBackground: "#3b5070",
        black: "#0d1117",
        red: "#f85149",
        green: "#56d364",
        yellow: "#e3b341",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#76e3ea",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#7ee787",
        brightYellow: "#ffd33d",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#a5d6ff",
        brightWhite: "#f0f6fc",
      },
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, Monaco, monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
      tabStopWidth: 4,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    setConnectionStatus("connecting");
    terminal.writeln("\x1b[33mConnecting to terminal...\x1b[0m");

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");
      terminal.writeln("\x1b[32mConnected!\x1b[0m\r\n");
      onConnect?.();

      // Send initial resize
      handleResize();
    };

    socket.onmessage = (event) => {
      // Handle binary or text data from terminal
      if (typeof event.data === "string") {
        terminal.write(event.data);
      } else if (event.data instanceof Blob) {
        event.data.text().then((text) => terminal.write(text));
      }
    };

    socket.onerror = (event) => {
      console.error("WebSocket error:", event);
      setConnectionStatus("error");
      terminal.writeln("\r\n\x1b[31mConnection error. Falling back to iframe...\x1b[0m");
      onError?.("WebSocket connection failed");

      // Fall back to iframe
      if (iframeUrl) {
        setTimeout(() => setUseIframe(true), 1500);
      }
    };

    socket.onclose = () => {
      setConnectionStatus("disconnected");
      terminal.writeln("\r\n\x1b[33mDisconnected from terminal.\x1b[0m");
      onDisconnect?.();
    };

    // Send user input to server
    terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    // Handle window resize
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.close();
      terminal.dispose();
    };
  }, [wsUrl, iframeUrl, onConnect, onDisconnect, onError, handleResize]);

  // Iframe fallback
  if (useIframe && iframeUrl) {
    return (
      <div className="terminal-container" style={{ height }}>
        <div className="terminal-header">
          <span className="status-indicator iframe" />
          <span>Terminal (iframe mode)</span>
        </div>
        <iframe
          src={iframeUrl}
          style={{
            width: "100%",
            height: "calc(100% - 32px)",
            border: "none",
            borderRadius: "0 0 8px 8px",
            backgroundColor: "#0d1117",
          }}
          allow="clipboard-read; clipboard-write"
        />
        <style jsx>{`
          .terminal-container {
            border: 1px solid #30363d;
            border-radius: 8px;
            overflow: hidden;
            background: #0d1117;
          }
          .terminal-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #161b22;
            border-bottom: 1px solid #30363d;
            font-size: 12px;
            color: #8b949e;
          }
          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
          .status-indicator.iframe {
            background: #e3b341;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="terminal-container" style={{ height }}>
      <div className="terminal-header">
        <span className={`status-indicator ${connectionStatus}`} />
        <span>
          {connectionStatus === "connecting" && "Connecting..."}
          {connectionStatus === "connected" && "Connected"}
          {connectionStatus === "disconnected" && "Disconnected"}
          {connectionStatus === "error" && "Connection Error"}
        </span>
      </div>
      <div
        ref={terminalRef}
        className="terminal-body"
        style={{ height: "calc(100% - 32px)" }}
      />
      <style jsx>{`
        .terminal-container {
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
          background: #0d1117;
        }
        .terminal-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
          font-size: 12px;
          color: #8b949e;
        }
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-indicator.connecting {
          background: #e3b341;
          animation: pulse 1s infinite;
        }
        .status-indicator.connected {
          background: #56d364;
        }
        .status-indicator.disconnected {
          background: #6e7681;
        }
        .status-indicator.error {
          background: #f85149;
        }
        .terminal-body {
          padding: 4px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default XTerminal;
