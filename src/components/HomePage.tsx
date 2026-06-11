"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLivePresence } from "@/hooks/useLivePresence";
import { useMessages } from "@/hooks/useMessages";
import type { Post } from "@/lib/schema";
import MessagePanel from "./MessagePanel";
import PostPanel from "./PostPanel";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const PANEL_STORAGE_KEY = "intonow_panel_expanded";
const MESSAGES_PANEL_STORAGE_KEY = "intonow_messages_panel_expanded";

type PostPanelView = "list" | "create";
type MessagePanelView = "inbox" | "thread";

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [panelView, setPanelView] = useState<PostPanelView>("list");
  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const [messagesView, setMessagesView] = useState<MessagePanelView>("inbox");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);

  const { user, loading: authLoading, sendCode, verifyCode, logout } = useAuth();
  const { liveUsers, myLocation, connected, sharing } = useLivePresence();
  const {
    conversations,
    messages,
    loadingInbox,
    loadingThread,
    openConversationWith,
    sendMessage,
  } = useMessages(user?.id ?? null, activeConversationId);

  useEffect(() => {
    const stored = sessionStorage.getItem(PANEL_STORAGE_KEY);
    if (stored !== null) {
      setPanelExpanded(stored === "true");
    }
    const messagesStored = sessionStorage.getItem(MESSAGES_PANEL_STORAGE_KEY);
    if (messagesStored !== null) {
      setMessagesExpanded(messagesStored === "true");
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(PANEL_STORAGE_KEY, String(panelExpanded));
    document.body.classList.toggle("intonow-panel-open", panelExpanded);
    return () => document.body.classList.remove("intonow-panel-open");
  }, [panelExpanded]);

  useEffect(() => {
    sessionStorage.setItem(MESSAGES_PANEL_STORAGE_KEY, String(messagesExpanded));
    document.body.classList.toggle("intonow-messages-panel-open", messagesExpanded);
    return () => document.body.classList.remove("intonow-messages-panel-open");
  }, [messagesExpanded]);

  const fetchPosts = useCallback(async (term?: string) => {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    const res = await fetch(`/api/posts?${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPosts(search), 250);
    return () => clearTimeout(timer);
  }, [search, fetchPosts]);

  useEffect(() => {
    if (myLocation) {
      setCenter(myLocation);
    }
  }, [myLocation]);

  function handlePostClick(post: Post) {
    setSelectedId(post.id);
    setCenter({ lat: post.lat, lng: post.lng });
    setZoom(15);
  }

  async function handleCreatePost(data: {
    title: string;
    description: string;
    category: string;
    lat: number;
    lng: number;
  }) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create post");
    await fetchPosts(search);
    setSelectedId((await res.json()).post?.id ?? null);
    setPanelView("list");
  }

  const startConversation = useCallback(
    async (participantId: string) => {
      setMessagesExpanded(true);
      if (!user) {
        setMessagesView("inbox");
        setActiveConversationId(null);
        return;
      }

      try {
        const conversationId = await openConversationWith(participantId);
        setActiveConversationId(conversationId);
        setMessagesView("thread");
      } catch (error) {
        console.error(error);
      }
    },
    [user, openConversationWith]
  );

  async function handleSendMessage(body: string) {
    if (!activeConversationId) return;
    await sendMessage(activeConversationId, body);
  }

  const postLat = myLocation?.lat ?? center.lat;
  const postLng = myLocation?.lng ?? center.lng;

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#06040c]">
      <MapView
        posts={posts}
        liveUsers={liveUsers}
        myLocation={myLocation}
        center={center}
        zoom={zoom}
        selectedId={selectedId}
        onSelect={setSelectedId}
        currentUserId={user?.id ?? null}
        onMessageUser={startConversation}
      />
      <MessagePanel
        expanded={messagesExpanded}
        view={messagesView}
        activeConversationId={activeConversationId}
        onExpandedChange={setMessagesExpanded}
        onViewChange={setMessagesView}
        onConversationSelect={setActiveConversationId}
        onBackToInbox={() => setActiveConversationId(null)}
        user={user}
        authLoading={authLoading}
        onSendCode={sendCode}
        onVerifyCode={async (phone, code) => {
          await verifyCode(phone, code);
        }}
        onLogout={logout}
        conversations={conversations}
        messages={messages}
        loadingInbox={loadingInbox}
        loadingThread={loadingThread}
        onSendMessage={handleSendMessage}
        unreadCount={conversations.length}
      />
      <PostPanel
        expanded={panelExpanded}
        view={panelView}
        onExpandedChange={setPanelExpanded}
        onViewChange={setPanelView}
        posts={posts}
        search={search}
        onSearchChange={setSearch}
        onPostClick={handlePostClick}
        selectedId={selectedId}
        liveCount={liveUsers.length}
        connected={connected}
        sharing={sharing}
        onSubmitPost={handleCreatePost}
        defaultLat={postLat}
        defaultLng={postLng}
        currentUserId={user?.id ?? null}
        onMessageAuthor={startConversation}
      />
    </main>
  );
}