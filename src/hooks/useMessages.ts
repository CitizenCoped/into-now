"use client";

import {
  MESSAGE_EVENT,
  conversationChannel,
  userChannel,
} from "@/lib/pusher";
import type { Message } from "@/lib/schema";
import PusherClient from "pusher-js";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConversationSummary = {
  id: string;
  updatedAt: string;
  unreadCount: number;
  otherUser: {
    id: string;
    displayName: string | null;
    photoUrl: string | null;
    statement: string | null;
    displayLabel: string;
    isAnonymous: boolean;
    isExpired: boolean;
    isOnline: boolean;
  } | null;
  lastMessage: {
    id: string;
    body: string;
    preview: string;
    isTruncated: boolean;
    senderId: string;
    createdAt: string;
  } | null;
};

export function useMessages(userId: string | null, activeConversationId: string | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const pusherRef = useRef<PusherClient | null>(null);

  const fetchInbox = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      return;
    }

    setLoadingInbox(true);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) {
        setConversations([]);
        return;
      }
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } finally {
      setLoadingInbox(false);
    }
  }, [userId]);

  const markRead = useCallback(
    async (conversationId: string) => {
      try {
        await fetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
      } catch {
        // best-effort; inbox will just show stale unread count
      }
      fetchInbox();
    },
    [fetchInbox]
  );

  const fetchThread = useCallback(
    async (conversationId: string) => {
      setLoadingThread(true);
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!res.ok) {
          setMessages([]);
          return;
        }
        const data = await res.json();
        setMessages(data.messages ?? []);
        markRead(conversationId);
      } finally {
        setLoadingThread(false);
      }
    },
    [markRead]
  );

  const openConversationWith = useCallback(
    async (participantId: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open conversation");
      await fetchInbox();
      return data.conversationId as string;
    },
    [fetchInbox]
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send message");
      return data.message as Message;
    },
    []
  );

  const applyIncomingMessage = useCallback(
    (payload: { conversationId: string; message: Message }) => {
      if (activeConversationId === payload.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
      }
      fetchInbox();
    },
    [activeConversationId, fetchInbox]
  );

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    if (activeConversationId) {
      fetchThread(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, fetchThread]);

  useEffect(() => {
    if (!userId) return;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us3";
    if (!key) return;

    const pusher = new PusherClient(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });
    pusherRef.current = pusher;

    const userChan = pusher.subscribe(userChannel(userId));
    userChan.bind(MESSAGE_EVENT, applyIncomingMessage);

    let threadChan: ReturnType<PusherClient["subscribe"]> | null = null;
    if (activeConversationId) {
      threadChan = pusher.subscribe(conversationChannel(activeConversationId));
      threadChan.bind(MESSAGE_EVENT, applyIncomingMessage);
    }

    return () => {
      userChan.unbind(MESSAGE_EVENT, applyIncomingMessage);
      pusher.unsubscribe(userChannel(userId));
      if (threadChan) {
        threadChan.unbind(MESSAGE_EVENT, applyIncomingMessage);
        pusher.unsubscribe(conversationChannel(activeConversationId!));
      }
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [userId, activeConversationId, applyIncomingMessage]);

  return {
    conversations,
    messages,
    loadingInbox,
    loadingThread,
    fetchInbox,
    fetchThread,
    openConversationWith,
    sendMessage,
  };
}