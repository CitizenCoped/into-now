"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLivePresence } from "@/hooks/useLivePresence";
import { useMessages } from "@/hooks/useMessages";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ageFromBirthDate, haversineMiles } from "@/lib/geo";
import type { MapUser, Post } from "@/lib/schema";
import FilterPanel, { type UserFilters } from "./FilterPanel";
import InstallPrompt from "./InstallPrompt";
import MessagePanel from "./MessagePanel";
import PostPanel from "./PostPanel";
import ProfilePanel from "./ProfilePanel";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const PANEL_STORAGE_KEY = "intonow_panel_expanded";
const MESSAGES_PANEL_STORAGE_KEY = "intonow_messages_panel_expanded";

type PostPanelView = "list" | "create";
type MessagePanelView = "inbox" | "thread";

const DEFAULT_USER_FILTERS: UserFilters = {
  minAge: 18,
  maxAge: 99,
  maxDistanceMiles: 25,
};

function openConversationFromUrl(
  conversationId: string,
  messageId: string | null,
  setMessagesExpanded: (v: boolean) => void,
  setActiveConversationId: (v: string) => void,
  setHighlightMessageId: (v: string | null) => void,
  setMessagesView: (v: MessagePanelView) => void
) {
  setMessagesExpanded(true);
  setActiveConversationId(conversationId);
  setHighlightMessageId(messageId);
  setMessagesView("thread");
  window.history.replaceState({}, "", "/");
}

function parseMessageDeepLink(url: string) {
  const parsed = new URL(url, window.location.origin);
  return {
    conversationId: parsed.searchParams.get("conversation"),
    messageId: parsed.searchParams.get("message"),
  };
}

function filterMapUsers(
  users: MapUser[],
  filters: UserFilters,
  origin: { lat: number; lng: number } | null
) {
  return users.filter((user) => {
    if (user.birthDate) {
      const age = ageFromBirthDate(user.birthDate);
      if (age < filters.minAge || age > filters.maxAge) return false;
    }
    if (origin) {
      const miles = haversineMiles(origin.lat, origin.lng, user.lat, user.lng);
      if (miles > filters.maxDistanceMiles) return false;
    }
    return true;
  });
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [panelView, setPanelView] = useState<PostPanelView>("list");
  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const [messagesView, setMessagesView] = useState<MessagePanelView>("inbox");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [userFilters, setUserFilters] = useState<UserFilters>(DEFAULT_USER_FILTERS);

  const {
    user,
    loading: authLoading,
    sendPhoneCode,
    sendEmailCode,
    sendCode,
    verifyPhoneCode,
    verifyEmailCode,
    verifyCode,
    updateProfile,
    logout,
  } = useAuth();

  // Presence is on for every signed-in user — anonymous and verified alike —
  // with identical location verbosity.
  const presenceReady = Boolean(user);
  const { litUsers, unlitUsers, myLocation, connected, sharing, locationDenied } =
    useLivePresence(presenceReady, user?.id ?? null);

  const {
    conversations,
    messages,
    loadingInbox,
    loadingThread,
    openConversationWith,
    sendMessage,
  } = useMessages(user?.id ?? null, activeConversationId);
  const {
    permission: pushPermission,
    subscribed: pushSubscribed,
    preferences: pushPreferences,
    loading: pushLoading,
    error: pushError,
    enableNotifications,
    disableNotifications,
    updatePreferences,
  } = usePushNotifications(user?.id ?? null);

  const isRegistered = user && !user.isAnonymous;

  const filteredPosts = useMemo(() => {
    if (!isRegistered || categoryFilters.length === 0) return posts;
    return posts.filter((post) => categoryFilters.includes(post.category));
  }, [posts, categoryFilters, isRegistered]);

  const filteredLitUsers = useMemo(() => {
    if (!isRegistered) return litUsers;
    return filterMapUsers(litUsers, userFilters, myLocation);
  }, [litUsers, userFilters, myLocation, isRegistered]);

  const filteredUnlitUsers = useMemo(() => {
    if (!isRegistered) return unlitUsers;
    return filterMapUsers(unlitUsers, userFilters, myLocation);
  }, [unlitUsers, userFilters, myLocation, isRegistered]);

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

  useEffect(() => {
    if (!user) return;
    const { conversationId, messageId } = parseMessageDeepLink(window.location.href);
    if (conversationId) {
      openConversationFromUrl(
        conversationId,
        messageId,
        setMessagesExpanded,
        setActiveConversationId,
        setHighlightMessageId,
        setMessagesView
      );
    }
  }, [user]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "OPEN_URL" || !event.data.url) return;
      if (!user) return;
      const { conversationId, messageId } = parseMessageDeepLink(event.data.url);
      if (conversationId) {
        openConversationFromUrl(
          conversationId,
          messageId,
          setMessagesExpanded,
          setActiveConversationId,
          setHighlightMessageId,
          setMessagesView
        );
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [user]);

  const fetchPosts = useCallback(async (term?: string, category?: string) => {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    if (category) params.set("category", category);
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
      <InstallPrompt />
      {presenceReady && locationDenied && (
        <div className="absolute left-1/2 top-4 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-[#FF4D6D]/40 bg-[#170a12]/90 px-4 py-2.5 text-center text-xs text-white/80 shadow-lg backdrop-blur">
          <span className="font-semibold text-[#FF4D6D]">Your light is off.</span>{" "}
          Allow location access in your browser settings to appear live on the map.
        </div>
      )}
      <MapView
        posts={filteredPosts}
        litUsers={filteredLitUsers}
        unlitUsers={filteredUnlitUsers}
        myLocation={myLocation}
        center={center}
        zoom={zoom}
        selectedId={selectedId}
        onSelect={setSelectedId}
        currentUserId={user?.id ?? null}
        onMessageUser={startConversation}
      />
      <FilterPanel
        expanded={filterExpanded}
        onExpandedChange={setFilterExpanded}
        user={user}
        categories={categoryFilters}
        onCategoriesChange={setCategoryFilters}
        userFilters={userFilters}
        onUserFiltersChange={setUserFilters}
        onUpgradeClick={() => {
          setProfileExpanded(true);
          setShowSignup(true);
        }}
      />
      <ProfilePanel
        expanded={profileExpanded}
        onExpandedChange={setProfileExpanded}
        user={user}
        authLoading={authLoading}
        birthDate={user?.birthDate ?? "2000-01-01"}
        onSendPhoneCode={sendPhoneCode}
        onSendEmailCode={sendEmailCode}
        onVerifyPhoneCode={verifyPhoneCode}
        onVerifyEmailCode={verifyEmailCode}
        onSaveProfile={updateProfile}
        onLogout={logout}
        pushPermission={pushPermission}
        pushSubscribed={pushSubscribed}
        pushPreferences={pushPreferences}
        pushLoading={pushLoading}
        pushError={pushError}
        onEnablePush={enableNotifications}
        onDisablePush={disableNotifications}
        onPushPreferencesChange={updatePreferences}
        showSignup={showSignup}
        onSignupClose={() => setShowSignup(false)}
      />
      <MessagePanel
        expanded={messagesExpanded}
        view={messagesView}
        activeConversationId={activeConversationId}
        highlightMessageId={highlightMessageId}
        onHighlightComplete={() => setHighlightMessageId(null)}
        onExpandedChange={setMessagesExpanded}
        onViewChange={setMessagesView}
        onConversationSelect={(id) => {
          setActiveConversationId(id);
          setHighlightMessageId(null);
        }}
        onBackToInbox={() => {
          setActiveConversationId(null);
          setHighlightMessageId(null);
        }}
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
        pushPermission={pushPermission}
        pushSubscribed={pushSubscribed}
        pushPreferences={pushPreferences}
        pushLoading={pushLoading}
        pushError={pushError}
        onEnablePush={enableNotifications}
        onDisablePush={disableNotifications}
        onPushPreferencesChange={updatePreferences}
      />
      <PostPanel
        expanded={panelExpanded}
        view={panelView}
        onExpandedChange={setPanelExpanded}
        onViewChange={setPanelView}
        posts={filteredPosts}
        search={search}
        onSearchChange={setSearch}
        onPostClick={handlePostClick}
        selectedId={selectedId}
        liveCount={filteredLitUsers.length}
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