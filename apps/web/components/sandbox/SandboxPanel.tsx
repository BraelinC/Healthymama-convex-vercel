"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@healthymama/convex";
import { XTerminal } from "./Terminal";

interface SandboxPanelProps {
  defaultRepoUrl?: string;
}

export function SandboxPanel({ defaultRepoUrl }: SandboxPanelProps) {
  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl || "");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex queries and mutations
  const activeSandbox = useQuery(api.sandbox.getActiveSandbox);
  const userSandboxes = useQuery(api.sandbox.getUserSandboxes);
  const createSandbox = useAction(api.sandbox.createSandbox);
  const stopSandbox = useAction(api.sandbox.stopSandbox);
  const updateActivity = useMutation(api.sandbox.updateActivity);

  const handleCreateSandbox = async () => {
    setIsCreating(true);
    setError(null);

    try {
      await createSandbox({
        repoUrl: repoUrl || undefined,
        keepAlive: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sandbox");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStopSandbox = async () => {
    if (!activeSandbox) return;

    try {
      await stopSandbox({ sandboxId: activeSandbox._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop sandbox");
    }
  };

  // Keep sandbox alive while viewing
  const handleTerminalConnect = () => {
    if (activeSandbox) {
      updateActivity({ sandboxId: activeSandbox._id });

      // Set up periodic keep-alive
      const interval = setInterval(() => {
        if (activeSandbox) {
          updateActivity({ sandboxId: activeSandbox._id });
        }
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  };

  return (
    <div className="sandbox-panel">
      {/* Header */}
      <div className="header">
        <h2>OpenCode Agent</h2>
        <p className="subtitle">AI coding assistant running on Daytona</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* No active sandbox - show create form */}
      {!activeSandbox && (
        <div className="create-section">
          <div className="input-group">
            <label htmlFor="repoUrl">Repository URL (optional)</label>
            <input
              id="repoUrl"
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              disabled={isCreating}
            />
          </div>

          <button
            className="btn-primary"
            onClick={handleCreateSandbox}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <span className="spinner" />
                Creating sandbox...
              </>
            ) : (
              "Start OpenCode Agent"
            )}
          </button>

          <p className="hint">
            This will create a cloud sandbox with OpenCode installed.
            You&apos;ll get a terminal where you can interact with the AI agent.
          </p>
        </div>
      )}

      {/* Active sandbox - show terminal */}
      {activeSandbox && activeSandbox.status === "running" && (
        <div className="terminal-section">
          <div className="terminal-toolbar">
            <div className="sandbox-info">
              <span className="status-badge running">Running</span>
              <span className="sandbox-id">ID: {activeSandbox.sandboxId}</span>
            </div>
            <div className="toolbar-actions">
              <a
                href={activeSandbox.terminalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Open in New Tab
              </a>
              <button
                className="btn-danger"
                onClick={handleStopSandbox}
              >
                Stop Sandbox
              </button>
            </div>
          </div>

          <XTerminal
            wsUrl={activeSandbox.terminalWsUrl}
            iframeUrl={activeSandbox.terminalUrl}
            height="600px"
            onConnect={handleTerminalConnect}
          />

          <div className="terminal-help">
            <h4>Quick Start</h4>
            <ol>
              <li>Run: <code>tmux attach -t main</code></li>
              <li>OpenCode is running in window 1</li>
              <li>Switch windows: <code>Ctrl+A</code> then <code>1</code>, <code>2</code>, or <code>3</code></li>
            </ol>
          </div>
        </div>
      )}

      {/* Creating status */}
      {activeSandbox && activeSandbox.status === "creating" && (
        <div className="creating-section">
          <div className="creating-animation">
            <span className="spinner large" />
            <h3>Creating your sandbox...</h3>
            <p>This usually takes 30-60 seconds</p>
          </div>
        </div>
      )}

      {/* Previous sandboxes */}
      {userSandboxes && userSandboxes.length > 0 && (
        <div className="history-section">
          <h3>Previous Sandboxes</h3>
          <ul className="sandbox-list">
            {userSandboxes.slice(0, 5).map((sandbox) => (
              <li key={sandbox._id}>
                <span className={`status-badge ${sandbox.status}`}>
                  {sandbox.status}
                </span>
                <span className="sandbox-id">{sandbox.sandboxId}</span>
                <span className="sandbox-date">
                  {new Date(sandbox.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .sandbox-panel {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        .header {
          margin-bottom: 24px;
        }

        .header h2 {
          font-size: 24px;
          font-weight: 600;
          color: #f0f6fc;
          margin: 0;
        }

        .subtitle {
          color: #8b949e;
          margin: 4px 0 0;
        }

        .error-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(248, 81, 73, 0.1);
          border: 1px solid #f85149;
          border-radius: 8px;
          margin-bottom: 16px;
          color: #f85149;
        }

        .error-banner button {
          background: none;
          border: none;
          color: #f85149;
          font-size: 20px;
          cursor: pointer;
        }

        .create-section {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          padding: 24px;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .input-group label {
          display: block;
          margin-bottom: 8px;
          color: #c9d1d9;
          font-size: 14px;
        }

        .input-group input {
          width: 100%;
          padding: 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          color: #c9d1d9;
          font-size: 14px;
        }

        .input-group input:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #238636;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2ea043;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 8px 16px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 14px;
          cursor: pointer;
          text-decoration: none;
        }

        .btn-secondary:hover {
          background: #30363d;
        }

        .btn-danger {
          padding: 8px 16px;
          background: #da3633;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-danger:hover {
          background: #f85149;
        }

        .hint {
          margin-top: 16px;
          color: #8b949e;
          font-size: 13px;
        }

        .terminal-section {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          overflow: hidden;
        }

        .terminal-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #0d1117;
          border-bottom: 1px solid #30363d;
        }

        .sandbox-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toolbar-actions {
          display: flex;
          gap: 8px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.running {
          background: rgba(86, 211, 100, 0.2);
          color: #56d364;
        }

        .status-badge.creating {
          background: rgba(227, 179, 65, 0.2);
          color: #e3b341;
        }

        .status-badge.stopped {
          background: rgba(110, 118, 129, 0.2);
          color: #8b949e;
        }

        .status-badge.failed {
          background: rgba(248, 81, 73, 0.2);
          color: #f85149;
        }

        .sandbox-id {
          color: #8b949e;
          font-size: 12px;
          font-family: monospace;
        }

        .terminal-help {
          padding: 16px;
          background: #0d1117;
          border-top: 1px solid #30363d;
        }

        .terminal-help h4 {
          margin: 0 0 12px;
          color: #c9d1d9;
          font-size: 14px;
        }

        .terminal-help ol {
          margin: 0;
          padding-left: 20px;
          color: #8b949e;
          font-size: 13px;
        }

        .terminal-help li {
          margin-bottom: 4px;
        }

        .terminal-help code {
          background: #161b22;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #58a6ff;
        }

        .creating-section {
          display: flex;
          justify-content: center;
          padding: 80px 24px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
        }

        .creating-animation {
          text-align: center;
        }

        .creating-animation h3 {
          margin: 24px 0 8px;
          color: #f0f6fc;
        }

        .creating-animation p {
          color: #8b949e;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #30363d;
          border-top-color: #58a6ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spinner.large {
          width: 48px;
          height: 48px;
          border-width: 3px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .history-section {
          margin-top: 24px;
          padding: 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
        }

        .history-section h3 {
          margin: 0 0 12px;
          color: #c9d1d9;
          font-size: 16px;
        }

        .sandbox-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .sandbox-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #21262d;
        }

        .sandbox-list li:last-child {
          border-bottom: none;
        }

        .sandbox-date {
          margin-left: auto;
          color: #6e7681;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}

export default SandboxPanel;
