"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLivePresence } from "@/hooks/useLivePresence";
import { useMessages } from "@/hooks/useMessages";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ageFromBirthDate, haversineMiles } from "@/lib/geo";
import { CORNER_BUFFER, CORNER_BUTTON_SIZE, CORNER_MARGIN } from "@/lib/mapChrome";
import { isIdentityToken, type IdentityToken, type LookingForToken } from "@/lib/codes";
import type { MapUser, Post } from "@/lib/schema";
import FilterPanel, { type UserFilters } from "./FilterPanel";
import InstallPrompt from "./InstallPrompt";
import MessagePanel from "./MessagePanel";
import PostPanel from "./PostPanel";
import ProfilePanel from "./ProfilePanel";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

/** How far a gesture-guard band extends beyond the margin/safe-area edge. */
const GESTURE_BAND_EXTENT = CORNER_BUTTON_SIZE + CORNER_BUFFER;

type PostPanelView = "list" | "create";
type MessagePanelView = "inbox" | "thread";

/**
 * Exactly one corner feature may be open at a time; the four corner FABs stay
 * visible above whichever panel is open (open ↔ close on the same corner,
 * swap on a different one). `null` on cold load keeps the user on the map,
 * focused on their location.
 */
type OpenPanel = "filters" | "profile" | "messages" | "posts" | null;

const DEFAULT_USER_FILTERS: UserFilters = {
  minAge: 18,
  maxAge: 99,
  maxDistanceMiles: 25,
};

function openConversationFromUrl(
  conversationId: string,
  messageId: string | null,
  openMessagesPanel: () => void,
  setActiveConversationId: (v: string) => void,
  setHighlightMessageId: (v: string | null) => void,
  setMessagesView: (v: MessagePanelView) => void
) {
  openMessagesPanel();
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
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [panelView, setPanelView] = useState<PostPanelView>("list");
  const [messagesView, setMessagesView] = useState<MessagePanelView>("inbox");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const [showSignup, setShowSignup] = useState(false);
  const [posterFilters, setPosterFilters] = useState<string[]>([]);
  const [forMe, setForMe] = useState(false);
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
    revealPhoto,
    toggleHidePhoto,
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

  const myIdentity = user?.identity && isIdentityToken(user.identity) ? user.identity : null;

  const filteredPosts = useMemo(() => {
    if (!isRegistered) return posts;
    // "For me" wins while on: posts seeking my identity, or anyone.
    if (forMe && myIdentity) {
      return posts.filter(
        (post) => post.lookingFor === myIdentity || post.lookingFor === "ANY"
      );
    }
    if (posterFilters.length === 0) return posts;
    return posts.filter((post) => posterFilters.includes(post.posterIs));
  }, [posts, posterFilters, forMe, myIdentity, isRegistered]);

  const filteredLitUsers = useMemo(() => {
    if (!isRegistered) return litUsers;
    return filterMapUsers(litUsers, userFilters, myLocation);
  }, [litUsers, userFilters, myLocation, isRegistered]);

  const filteredUnlitUsers = useMemo(() => {
    if (!isRegistered) return unlitUsers;
    return filterMapUsers(unlitUsers, userFilters, myLocation);
  }, [unlitUsers, userFilters, myLocation, isRegistered]);

  useEffect(() => {
    document.body.classList.toggle("intonow-panel-open", openPanel === "posts");
    document.body.classList.toggle("intonow-messages-panel-open", openPanel === "messages");
    return () => {
      document.body.classList.remove("intonow-panel-open");
      document.body.classList.remove("intonow-messages-panel-open");
    };
  }, [openPanel]);

  useEffect(() => {
    if (!user) return;
    const { conversationId, messageId } = parseMessageDeepLink(window.location.href);
    if (conversationId) {
      openConversationFromUrl(
        conversationId,
        messageId,
        () => setOpenPanel("messages"),
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
          () => setOpenPanel("messages"),
          setActiveConversationId,
          setHighlightMessageId,
          setMessagesView
        );
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [user]);

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

  // Center on the user's GPS position once, when the first fix arrives.
  // Later fixes must NOT re-center: the camera belongs to MapLibre so free
  // pan/zoom never snaps back (recenter is explicit — the crosshair button,
  // or returning to the app, both handled in MapView).
  const centeredOnFirstFix = useRef(false);
  useEffect(() => {
    if (myLocation && !centeredOnFirstFix.current) {
      centeredOnFirstFix.current = true;
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
    posterIs: IdentityToken;
    lookingFor: LookingForToken;
    lat: number;
    lng: number;
  }) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const message =
        typeof detail?.error === "string"
          ? detail.error
          : `Couldn't post (server said ${res.status}). Try again in a moment.`;
      throw new Error(message);
    }
    await fetchPosts(search);
    setSelectedId((await res.json()).post?.id ?? null);
    setPanelView("list");
  }

  const startConversation = useCallback(
    async (participantId: string) => {
      setOpenPanel("messages");
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

  async function handleSendMessage(body: string, photoIds: string[]) {
    if (!activeConversationId) return;
    await sendMessage(activeConversationId, body, photoIds);
  }

  const postLat = myLocation?.lat ?? center.lat;
  const postLng = myLocation?.lng ?? center.lng;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#06040c]">
      {/*
        Fixed top-center wordmark. The wrapper below establishes a new
        containing block (via `transform`) for InstallPrompt's own
        `position: fixed` banners, with `paddingTop` pushing them down so
        they stack under the logo instead of covering it.
      */}
      <div className="pointer-events-none fixed inset-0 z-20 flex justify-center">
        <img
          src="/logo.svg"
          alt="into.now"
          className="mt-[max(0.75rem,env(safe-area-inset-top))] h-7 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:h-8"
        />
      </div>
      <div
        className="intonow-install-anchor pointer-events-none fixed inset-x-0 top-0 z-30"
        style={{
          transform: "translateZ(0)",
          paddingTop: "calc(max(0.75rem, env(safe-area-inset-top)) + 2.5rem)",
        }}
      >
        <InstallPrompt />
      </div>
      {presenceReady && locationDenied && (
        <div className="absolute left-1/2 top-[calc(max(1rem,env(safe-area-inset-top))+3rem)] z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-[#FF4D6D]/40 bg-[#170a12]/90 px-4 py-2.5 text-center text-xs text-white/80 shadow-lg backdrop-blur">
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
        currentUserPhotoUrl={user?.photoUrl ?? null}
        currentUserDisplayName={user?.displayName ?? null}
        onMessageUser={startConversation}
      />
      {/*
        Gesture-guard bands: the map may only be manipulated in the frame
        between the corner-control strips. These invisible fixed layers catch
        touches over the top (logo + FAB) and bottom (FAB) bands so a drag
        starting there never pans the map. Heights mirror the "safe
        rectangle" from mapChrome.ts; z-12 sits above the map (z-10 overlay)
        and below the recenter button (z-15), logo (z-20), panels (z-30),
        and FABs (z-40) — all of which stay tappable.
      */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[12] touch-none"
        style={{
          height: `calc(max(${CORNER_MARGIN}px, env(safe-area-inset-top)) + ${GESTURE_BAND_EXTENT}px)`,
        }}
      />
      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-[12] touch-none"
        style={{
          height: `calc(max(${CORNER_MARGIN}px, env(safe-area-inset-bottom)) + ${GESTURE_BAND_EXTENT}px)`,
        }}
      />
      <FilterPanel
        expanded={openPanel === "filters"}
        onExpandedChange={(v) => setOpenPanel(v ? "filters" : null)}
        user={user}
        forMe={forMe}
        onForMeChange={setForMe}
        posterFilters={posterFilters}
        onPosterFiltersChange={setPosterFilters}
        onSaveIdentity={(identity) => updateProfile({ identity })}
        userFilters={userFilters}
        onUserFiltersChange={setUserFilters}
        onUpgradeClick={() => {
          setOpenPanel("profile");
          setShowSignup(true);
        }}
      />
      <ProfilePanel
        expanded={openPanel === "profile"}
        onExpandedChange={(v) => setOpenPanel(v ? "profile" : null)}
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
        expanded={openPanel === "messages"}
        view={messagesView}
        activeConversationId={activeConversationId}
        highlightMessageId={highlightMessageId}
        onHighlightComplete={() => setHighlightMessageId(null)}
        onExpandedChange={(v) => setOpenPanel(v ? "messages" : null)}
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
        onRevealPhoto={revealPhoto}
        onToggleHidePhoto={toggleHidePhoto}
        unreadCount={conversations.reduce((sum, convo) => sum + convo.unreadCount, 0)}
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
        expanded={openPanel === "posts"}
        view={panelView}
        onExpandedChange={(v) => setOpenPanel(v ? "posts" : null)}
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
        defaultPosterIs={myIdentity}
        currentUserId={user?.id ?? null}
        onMessageAuthor={startConversation}
      />
    </main>
  );
}