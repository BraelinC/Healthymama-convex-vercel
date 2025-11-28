import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Helper: Sort user IDs alphabetically for consistent friendship records
 */
function sortUserIds(userId1: string, userId2: string): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

/**
 * Send a friend request
 */
export const sendFriendRequest = mutation({
  args: {
    fromUserId: v.string(),
    toUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Can't friend yourself
    if (args.fromUserId === args.toUserId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if friendship already exists
    const [userId1, userId2] = sortUserIds(args.fromUserId, args.toUserId);

    const existing = await ctx.db
      .query("friendships")
      .withIndex("by_user1", (q) => q.eq("userId1", userId1))
      .filter((q) => q.eq(q.field("userId2"), userId2))
      .first();

    if (existing) {
      if (existing.status === "accepted") {
        throw new Error("Already friends");
      } else if (existing.status === "pending") {
        throw new Error("Friend request already sent");
      } else if (existing.status === "declined") {
        // Allow re-sending after decline
        await ctx.db.patch(existing._id, {
          status: "pending",
          requestedBy: args.fromUserId,
          updatedAt: Date.now(),
        });
        return existing._id;
      }
    }

    // Create new friend request
    const friendshipId = await ctx.db.insert("friendships", {
      userId1,
      userId2,
      status: "pending",
      requestedBy: args.fromUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return friendshipId;
  },
});

/**
 * Accept a friend request
 */
export const acceptFriendRequest = mutation({
  args: {
    userId: v.string(),
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
    const friendship = await ctx.db.get(args.friendshipId);

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Verify the user is the recipient (not the requester)
    if (friendship.requestedBy === args.userId) {
      throw new Error("Cannot accept your own friend request");
    }

    // Verify the user is part of this friendship
    if (friendship.userId1 !== args.userId && friendship.userId2 !== args.userId) {
      throw new Error("Unauthorized");
    }

    if (friendship.status !== "pending") {
      throw new Error("Friend request is not pending");
    }

    await ctx.db.patch(args.friendshipId, {
      status: "accepted",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Decline a friend request
 */
export const declineFriendRequest = mutation({
  args: {
    userId: v.string(),
    friendshipId: v.id("friendships"),
  },
  handler: async (ctx, args) => {
    const friendship = await ctx.db.get(args.friendshipId);

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Verify the user is the recipient
    if (friendship.requestedBy === args.userId) {
      throw new Error("Cannot decline your own friend request");
    }

    if (friendship.userId1 !== args.userId && friendship.userId2 !== args.userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.friendshipId, {
      status: "declined",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get all friends (accepted friendships)
 */
export const getFriends = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get friendships where user is userId1
    const friendships1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_status", (q) =>
        q.eq("userId1", args.userId).eq("status", "accepted")
      )
      .collect();

    // Get friendships where user is userId2
    const friendships2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_status", (q) =>
        q.eq("userId2", args.userId).eq("status", "accepted")
      )
      .collect();

    // Combine and extract friend IDs
    const friendIds: string[] = [
      ...friendships1.map((f) => f.userId2),
      ...friendships2.map((f) => f.userId1),
    ];

    // Get friend user details with profile images
    const friends = await Promise.all(
      friendIds.map(async (friendId) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", friendId))
          .first();

        // Get profile image
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", friendId))
          .first();

        let profileImageUrl: string | null = null;
        if (profile?.profileImageStorageId) {
          profileImageUrl = await ctx.storage.getUrl(profile.profileImageStorageId);
        }

        return {
          userId: friendId,
          name: user?.prefs?.profileName || user?.email || "Unknown",
          email: user?.email || "",
          profileImageUrl,
        };
      })
    );

    return friends;
  },
});

/**
 * Get pending friend requests (received by this user)
 */
export const getPendingFriendRequests = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get friendships where user is userId1 and status is pending
    const requests1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_status", (q) =>
        q.eq("userId1", args.userId).eq("status", "pending")
      )
      .filter((q) => q.neq(q.field("requestedBy"), args.userId))
      .collect();

    // Get friendships where user is userId2 and status is pending
    const requests2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_status", (q) =>
        q.eq("userId2", args.userId).eq("status", "pending")
      )
      .filter((q) => q.neq(q.field("requestedBy"), args.userId))
      .collect();

    const allRequests = [...requests1, ...requests2];

    // Get requester details with profile images
    const enriched = await Promise.all(
      allRequests.map(async (request) => {
        const requester = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", request.requestedBy))
          .first();

        // Get profile image
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", request.requestedBy))
          .first();

        let profileImageUrl: string | null = null;
        if (profile?.profileImageStorageId) {
          profileImageUrl = await ctx.storage.getUrl(profile.profileImageStorageId);
        }

        return {
          friendshipId: request._id,
          requesterId: request.requestedBy,
          requesterName: requester?.prefs?.profileName || requester?.email || "Unknown",
          requesterEmail: requester?.email || "",
          profileImageUrl,
          createdAt: request.createdAt,
        };
      })
    );

    return enriched;
  },
});

/**
 * Search users by email (for adding friends)
 */
export const searchUserByEmail = query({
  args: {
    email: v.string(),
    currentUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user || user.userId === args.currentUserId) {
      return null;
    }

    // Get profile image
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .first();

    let profileImageUrl: string | null = null;
    if (profile?.profileImageStorageId) {
      profileImageUrl = await ctx.storage.getUrl(profile.profileImageStorageId);
    }

    return {
      userId: user.userId,
      name: user.prefs?.profileName || user.email,
      email: user.email,
      profileImageUrl,
    };
  },
});
