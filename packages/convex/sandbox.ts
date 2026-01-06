// @ts-nocheck
/**
 * Daytona Sandbox Management
 *
 * Manages OpenCode agent sandboxes running on Daytona infrastructure.
 * Provides real-time sync of sandbox state via Convex subscriptions.
 */

import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ==================== QUERIES ====================

/**
 * Get the user's active sandbox (if any)
 */
export const getActiveSandbox = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;

    return ctx.db
      .query("sandboxes")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .first();
  },
});

/**
 * Get all sandboxes for the current user
 */
export const getUserSandboxes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;

    return ctx.db
      .query("sandboxes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});

/**
 * Get sandbox by ID
 */
export const getSandbox = query({
  args: { sandboxId: v.id("sandboxes") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.sandboxId);
  },
});

/**
 * Get command history for a sandbox
 */
export const getCommandHistory = query({
  args: { sandboxId: v.id("sandboxes") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sandboxCommands")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .order("desc")
      .take(50);
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new sandbox record (called before Daytona API)
 */
export const createSandboxRecord = mutation({
  args: {
    repoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const now = Date.now();

    // Check if user already has a running sandbox
    const existingSandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .first();

    if (existingSandbox) {
      throw new Error("You already have a running sandbox. Stop it first.");
    }

    // Create placeholder record
    const sandboxId = await ctx.db.insert("sandboxes", {
      userId,
      sandboxId: "pending", // Will be updated by action
      status: "creating",
      terminalUrl: "",
      workdir: "/home/daytona",
      repoUrl: args.repoUrl,
      openCodeRunning: false,
      createdAt: now,
      lastActivityAt: now,
    });

    return sandboxId;
  },
});

/**
 * Update sandbox with Daytona info (called after Daytona API succeeds)
 */
export const updateSandboxInfo = internalMutation({
  args: {
    convexSandboxId: v.id("sandboxes"),
    daytonaSandboxId: v.string(),
    terminalUrl: v.string(),
    terminalWsUrl: v.optional(v.string()),
    workdir: v.string(),
    tmuxSessionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.convexSandboxId, {
      sandboxId: args.daytonaSandboxId,
      status: "running",
      terminalUrl: args.terminalUrl,
      terminalWsUrl: args.terminalWsUrl,
      workdir: args.workdir,
      tmuxSessionName: args.tmuxSessionName,
      openCodeRunning: true,
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Mark sandbox as failed
 */
export const markSandboxFailed = internalMutation({
  args: {
    convexSandboxId: v.id("sandboxes"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.convexSandboxId, {
      status: "failed",
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Update sandbox activity (keep-alive)
 */
export const updateActivity = mutation({
  args: { sandboxId: v.id("sandboxes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sandbox = await ctx.db.get(args.sandboxId);
    if (!sandbox || sandbox.userId !== identity.subject) {
      throw new Error("Sandbox not found or not owned by user");
    }

    await ctx.db.patch(args.sandboxId, {
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Mark sandbox as stopped
 */
export const markSandboxStopped = internalMutation({
  args: { convexSandboxId: v.id("sandboxes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.convexSandboxId, {
      status: "stopped",
      openCodeRunning: false,
      stoppedAt: Date.now(),
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Log a command execution
 */
export const logCommand = internalMutation({
  args: {
    sandboxId: v.id("sandboxes"),
    userId: v.string(),
    command: v.string(),
    output: v.optional(v.string()),
    exitCode: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sandboxCommands", {
      sandboxId: args.sandboxId,
      userId: args.userId,
      command: args.command,
      output: args.output,
      exitCode: args.exitCode,
      executedAt: Date.now(),
    });
  },
});

// ==================== ACTIONS (Daytona API Calls) ====================

/**
 * Create and start a new Daytona sandbox with OpenCode
 */
export const createSandbox = action({
  args: {
    repoUrl: v.optional(v.string()),
    keepAlive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ sandboxId: string; terminalUrl: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    // Create Convex record first
    const convexSandboxId = await ctx.runMutation(
      internal.sandbox.createSandboxRecordInternal,
      {
        userId,
        repoUrl: args.repoUrl,
      }
    );

    try {
      // Call Daytona API
      const apiKey = process.env.DAYTONA_API_KEY;
      if (!apiKey) {
        throw new Error("DAYTONA_API_KEY not configured");
      }

      // Create sandbox via Daytona SDK/API
      // Note: This is a simplified version - actual implementation depends on Daytona SDK
      const daytonaResponse = await createDaytonaSandbox({
        apiKey,
        repoUrl: args.repoUrl,
        keepAlive: args.keepAlive ?? false,
      });

      // Update Convex record with Daytona info
      await ctx.runMutation(internal.sandbox.updateSandboxInfo, {
        convexSandboxId,
        daytonaSandboxId: daytonaResponse.sandboxId,
        terminalUrl: daytonaResponse.terminalUrl,
        terminalWsUrl: daytonaResponse.terminalWsUrl,
        workdir: daytonaResponse.workdir,
        tmuxSessionName: "main",
      });

      // Log the creation
      await ctx.runMutation(internal.sandbox.logCommand, {
        sandboxId: convexSandboxId,
        userId,
        command: "sandbox:create",
        output: `Created sandbox ${daytonaResponse.sandboxId}`,
        exitCode: 0,
      });

      return {
        sandboxId: convexSandboxId,
        terminalUrl: daytonaResponse.terminalUrl,
      };
    } catch (error) {
      // Mark as failed
      await ctx.runMutation(internal.sandbox.markSandboxFailed, {
        convexSandboxId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

/**
 * Stop and delete a sandbox
 */
export const stopSandbox = action({
  args: { sandboxId: v.id("sandboxes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get sandbox record
    const sandbox = await ctx.runQuery(internal.sandbox.getSandboxInternal, {
      sandboxId: args.sandboxId,
    });

    if (!sandbox || sandbox.userId !== identity.subject) {
      throw new Error("Sandbox not found or not owned by user");
    }

    if (sandbox.status !== "running") {
      throw new Error("Sandbox is not running");
    }

    try {
      const apiKey = process.env.DAYTONA_API_KEY;
      if (!apiKey) throw new Error("DAYTONA_API_KEY not configured");

      // Delete from Daytona
      await deleteDaytonaSandbox({
        apiKey,
        sandboxId: sandbox.sandboxId,
      });

      // Mark as stopped in Convex
      await ctx.runMutation(internal.sandbox.markSandboxStopped, {
        convexSandboxId: args.sandboxId,
      });

      return { success: true };
    } catch (error) {
      throw error;
    }
  },
});

// ==================== INTERNAL MUTATIONS ====================

export const createSandboxRecordInternal = internalMutation({
  args: {
    userId: v.string(),
    repoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return ctx.db.insert("sandboxes", {
      userId: args.userId,
      sandboxId: "pending",
      status: "creating",
      terminalUrl: "",
      workdir: "/home/daytona",
      repoUrl: args.repoUrl,
      openCodeRunning: false,
      createdAt: now,
      lastActivityAt: now,
    });
  },
});

export const getSandboxInternal = query({
  args: { sandboxId: v.id("sandboxes") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.sandboxId);
  },
});

// ==================== DAYTONA API HELPERS ====================

interface DaytonaSandboxResult {
  sandboxId: string;
  terminalUrl: string;
  terminalWsUrl?: string;
  workdir: string;
}

async function createDaytonaSandbox(options: {
  apiKey: string;
  repoUrl?: string;
  keepAlive: boolean;
}): Promise<DaytonaSandboxResult> {
  // This is a placeholder - implement with actual Daytona SDK
  // The real implementation would use the daytona-sdk package

  const baseUrl = process.env.DAYTONA_API_URL || "https://api.daytona.io";

  // Create sandbox
  const createResponse = await fetch(`${baseUrl}/v1/sandboxes`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      auto_stop_interval: options.keepAlive ? 0 : 60,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Daytona API error: ${error}`);
  }

  const sandbox = await createResponse.json();
  const sandboxId = sandbox.id;

  // Install tmux and OpenCode
  await execInSandbox(baseUrl, options.apiKey, sandboxId,
    "apt-get update && apt-get install -y tmux"
  );

  await execInSandbox(baseUrl, options.apiKey, sandboxId,
    "curl -fsSL https://opencode.ai/install | bash"
  );

  await execInSandbox(baseUrl, options.apiKey, sandboxId,
    "echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc"
  );

  // Clone repo if provided
  let workdir = "/home/daytona";
  if (options.repoUrl) {
    await execInSandbox(baseUrl, options.apiKey, sandboxId,
      `cd /home/daytona && git clone ${options.repoUrl} project`
    );
    workdir = "/home/daytona/project";
  }

  // Start tmux with OpenCode
  await execInSandbox(baseUrl, options.apiKey, sandboxId,
    `tmux new-session -d -s main -n opencode "cd ${workdir} && ~/.local/bin/opencode"`
  );

  // Get preview URLs
  const terminalUrl = `https://${sandboxId}-22222.daytona.app`;
  const terminalWsUrl = `wss://${sandboxId}-22222.daytona.app/ws`;

  return {
    sandboxId,
    terminalUrl,
    terminalWsUrl,
    workdir,
  };
}

async function execInSandbox(
  baseUrl: string,
  apiKey: string,
  sandboxId: string,
  command: string
): Promise<{ output: string; exitCode: number }> {
  const response = await fetch(`${baseUrl}/v1/sandboxes/${sandboxId}/exec`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command, timeout: 300 }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Command failed: ${error}`);
  }

  return response.json();
}

async function deleteDaytonaSandbox(options: {
  apiKey: string;
  sandboxId: string;
}): Promise<void> {
  const baseUrl = process.env.DAYTONA_API_URL || "https://api.daytona.io";

  const response = await fetch(`${baseUrl}/v1/sandboxes/${options.sandboxId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${options.apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete sandbox: ${error}`);
  }
}
