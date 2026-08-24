"use client";

import {
  MESSAGE_EVENT,
  PHOTO_UPDATED_EVENT,
  conversationChannel,
  userChannel,
} from "@/lib/pusher";
import type {
  MessagePhotoView,
  MessageView,
  PhotoUpdatedPayload,
} from "@/lib/photoTypes";
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
  const [messages, setMessages] = useState<MessageView[]>([]);
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

  /** Patch one photo of one message in place. */
  const patchMessagePhoto = useCallback(
    (messageId: string, photoId: string, patch: Partial<MessagePhotoView>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== messageId
            ? m
            : {
                ...m,
                photos: (m.photos ?? []).map((p) =>
                  p.photoId !== photoId ? p : { ...p, ...patch }
                ),
              }
        )
      );
    },
    []
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string, photoIds: string[] = []) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, photoIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to send message";
        throw new Error(message);
      }

      // Upsert the sender view (photos revealed, presigned URLs). The
      // Pusher echo carries the blur-only variant and may land first —
      // replacing by id keeps the sender's own photos visible.
      const sent = data.message as MessageView;
      if (conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.some((m) => m.id === sent.id)
            ? prev.map((m) => (m.id === sent.id ? sent : m))
            : [...prev, sent]
        );
      }
      return sent;
    },
    [activeConversationId]
  );

  const applyIncomingMessage = useCallback(
    (payload: { conversationId: string; message: MessageView }) => {
      if (activeConversationId === payload.conversationId) {
        setMessages((prev) => {
          // Never overwrite an existing copy — the sender's own POST
          // response (with reveal URLs) beats the blur-only Pusher echo.
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
      }
      fetchInbox();
    },
    [activeConversationId, fetchInbox]
  );

  /** Sender toggled the closed-eye state. Hidden: blur immediately and
   *  drop the URL. Unhidden: refetch the thread so authorized viewers get
   *  fresh presigned URLs (they're 60s-lived and minted server-side). */
  const applyPhotoUpdated = useCallback(
    (payload: PhotoUpdatedPayload) => {
      if (activeConversationId !== payload.conversationId) return;
      if (payload.hiddenBySender) {
        patchMessagePhoto(payload.messageId, payload.photoId, {
          hiddenBySender: true,
          url: null,
        });
      } else {
        patchMessagePhoto(payload.messageId, payload.photoId, {
          hiddenBySender: false,
        });
        fetchThread(payload.conversationId);
      }
    },
    [activeConversationId, patchMessagePhoto, fetchThread]
  );

  /** Tap-to-reveal: self-grant, then crossfade in the presigned image. */
  const revealPhoto = useCallback(
    async (messageId: string, photoId: string) => {
      const res = await fetch(`/api/messages/${messageId}/photos/${photoId}/reveal`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Sender hid it since we rendered; reflect that instead.
          patchMessagePhoto(messageId, photoId, { hiddenBySender: true, url: null });
        }
        return;
      }
      patchMessagePhoto(messageId, photoId, {
        revealed: true,
        url: data.url ?? null,
      });
    },
    [patchMessagePhoto]
  );

  /** Closed-eye toggle (sender only) — optimistic; server echoes the
   *  photo-updated event to both sides. Reverts on failure. */
  const toggleHidePhoto = useCallback(
    async (messageId: string, photoId: string, current: boolean) => {
      patchMessagePhoto(messageId, photoId, { hiddenBySender: !current });
      try {
        const res = await fetch(`/api/messages/${messageId}/photos/${photoId}/hide`, {
          method: "POST",
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        patchMessagePhoto(messageId, photoId, { hiddenBySender: data.hiddenBySender });
      } catch {
        patchMessagePhoto(messageId, photoId, { hiddenBySender: current });
      }
    },
    [patchMessagePhoto]
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
      threadChan.bind(PHOTO_UPDATED_EVENT, applyPhotoUpdated);
    }

    return () => {
      userChan.unbind(MESSAGE_EVENT, applyIncomingMessage);
      pusher.unsubscribe(userChannel(userId));
      if (threadChan) {
        threadChan.unbind(MESSAGE_EVENT, applyIncomingMessage);
        threadChan.unbind(PHOTO_UPDATED_EVENT, applyPhotoUpdated);
        pusher.unsubscribe(conversationChannel(activeConversationId!));
      }
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [userId, activeConversationId, applyIncomingMessage, applyPhotoUpdated]);

  return {
    conversations,
    messages,
    loadingInbox,
    loadingThread,
    fetchInbox,
    fetchThread,
    openConversationWith,
    sendMessage,
    revealPhoto,
    toggleHidePhoto,
  };
}
