"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Loader2, User, ArrowLeft, Instagram } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import MuxPlayer from "@mux/mux-player-react";

interface InstagramDMProps {
  userId: string;
}

/**
 * Message item component that handles different attachment types
 */
function MessageItem({ message }: { message: Doc<"userInstagramMessages"> }) {
  const router = useRouter();

  // Load recipe data if message has a recipeId
  const recipe = useQuery(
    api.recipes.userRecipes.getRecipeById,
    message.recipeId ? { recipeId: message.recipeId } : "skip"
  );

  const isUserSent = message.direction === "outbound"; // User sent this message
  const isRecipeMessage = message.attachmentType === "recipe" && message.recipeId;
  const isReelMessage = message.attachmentType === "reel";

  const handleRecipeClick = () => {
    if (message.recipeId) {
      router.push(`/recipes/${message.recipeId}`);
    }
  };

  return (
    <div
      className={`flex ${isUserSent ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
    >
      <div className="flex flex-col max-w-[75%]">
        <div
          className={`px-4 py-2.5 ${
            isUserSent
              ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-3xl rounded-br-md shadow-md"
              : "bg-gray-100 text-gray-900 border border-gray-200 rounded-3xl rounded-bl-md"
          }`}
        >
          {/* USER SENT: Outbound message */}
          {isUserSent && (
            <>
              {isReelMessage ? (
                <p className="text-sm">You sent a reel message</p>
              ) : isRecipeMessage && recipe ? (
                <p className="text-sm">You sent: {recipe.title}</p>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {message.messageText}
                </p>
              )}
            </>
          )}

          {/* BOT SENT: Inbound message (recipe response) */}
          {!isUserSent && isRecipeMessage && recipe && (
            <div className="space-y-2">
              {/* Mux Video Player */}
              {message.muxPlaybackId && (
                <div className="rounded-lg overflow-hidden -mx-1 -my-1 mb-2">
                  <MuxPlayer
                    playbackId={message.muxPlaybackId}
                    streamType="on-demand"
                    muted={false}
                    autoPlay={false}
                    className="w-full aspect-video"
                    style={{ width: "100%", aspectRatio: "16/9" }}
                  />
                </div>
              )}

              {/* Recipe Link */}
              <button
                onClick={handleRecipeClick}
                className="text-white hover:underline font-medium text-sm flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors"
              >
                View full recipe →
              </button>

              {/* Bot reply text (if any) */}
              {message.messageText && (
                <p className="text-sm mt-2 whitespace-pre-wrap break-words leading-relaxed">
                  {message.messageText}
                </p>
              )}
            </div>
          )}

          {/* BOT SENT: Regular text message */}
          {!isUserSent && !isRecipeMessage && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.messageText}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <span
          className={`text-xs text-gray-400 mt-1 px-2 ${
            isUserSent ? "text-right" : "text-left"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export function InstagramDM({ userId }: InstagramDMProps) {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"userInstagramConversations"> | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reactive queries - auto-update when data changes!
  const conversations = useQuery(api.userInstagram.getUserConversations, { userId });
  const selectedMessages = useQuery(
    api.userInstagram.getConversationMessages,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );

  // Actions and mutations
  const sendMessage = useAction(api.userInstagram.sendUserMessage);
  const markAsRead = useMutation(api.userInstagram.markConversationAsRead);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedMessages]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (selectedConversationId) {
      markAsRead({ conversationId: selectedConversationId }).catch(console.error);
    }
  }, [selectedConversationId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversationId || isSending) return;

    const messageToSend = messageText.trim();
    setMessageText("");
    setIsSending(true);

    try {
      await sendMessage({
        userId,
        conversationId: selectedConversationId,
        messageText: messageToSend,
      });

      toast({
        title: "Message sent!",
        description: "Your DM was sent successfully.",
      });
    } catch (error: any) {
      console.error("Error sending DM:", error);

      // Restore message text on error
      setMessageText(messageToSend);

      toast({
        title: "Failed to send",
        description: error.message || "Could not send message. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedConversation = conversations?.find(c => c._id === selectedConversationId);

  // Loading state
  if (conversations === undefined) {
    return (
      <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-purple-600">
            <Instagram className="h-5 w-5 text-purple-500" />
            Instagram Direct Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-500" />
            <p>Loading conversations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No conversations yet
  if (!conversations || conversations.length === 0) {
    return (
      <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-purple-600">
            <Instagram className="h-5 w-5 text-purple-500" />
            Instagram Direct Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="mb-2 font-medium">No conversations yet</p>
            <p className="text-sm text-gray-400">
              Once people message your Instagram account, conversations will appear here automatically
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show conversation list if none selected
  if (!selectedConversationId || !selectedConversation) {
    return (
      <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-purple-600">
            <Instagram className="h-5 w-5 text-purple-500" />
            Instagram Direct Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] overflow-y-auto">
            <div className="space-y-1">
              {conversations.map((conversation) => {
                const hasUnread = conversation.unreadCount > 0;
                return (
                  <button
                    key={conversation._id}
                    onClick={() => setSelectedConversationId(conversation._id)}
                    className="w-full text-left p-3 hover:bg-purple-50/50 transition-colors border-b border-gray-100 last:border-0 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center ring-2 ring-white shadow-md">
                          <User className="h-7 w-7 text-white" />
                        </div>
                        {hasUnread && (
                          <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
                            {conversation.unreadCount}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm truncate ${hasUnread ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                            {conversation.instagramUsername.startsWith('@')
                              ? conversation.instagramUsername
                              : `@${conversation.instagramUsername}`}
                          </p>
                          <span className="text-xs text-gray-400">
                            {new Date(conversation.lastMessageAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${hasUnread ? "font-medium text-gray-700" : "text-gray-500"}`}>
                          {conversation.lastMessageText || "No messages"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show conversation thread
  return (
    <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
      <CardHeader className="pb-2 border-b border-purple-100">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversationId(null)}
            className="hover:bg-purple-100/50"
          >
            <ArrowLeft className="h-5 w-5 text-purple-600" />
          </Button>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center ring-2 ring-white shadow-md">
            <User className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="flex items-center gap-2 text-purple-600 flex-1">
            @{selectedConversation.instagramUsername}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {/* Messages - Instagram style */}
        <div className="h-[450px] overflow-y-auto pr-2 flex flex-col -mx-2">
          <div className="flex-1 space-y-3 py-4 px-2">
            {selectedMessages === undefined ? (
              <div className="text-center text-gray-500 py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-500" />
                <p className="text-sm">Loading messages...</p>
              </div>
            ) : selectedMessages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <MessageCircle className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              selectedMessages.map((message) => (
                <MessageItem key={message._id} message={message} />
              ))
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message input - Instagram style */}
        <div className="border-t border-purple-100 pt-4">
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              placeholder="Message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
              className="flex-1 rounded-full border-gray-300 px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || isSending}
              size="icon"
              className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-10 w-10 shadow-lg"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
