"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/maplibre";
import type { MapUser, Post } from "@/lib/schema";
import { getCodeColor } from "@/lib/codes";
import { getMapChromePadding } from "@/lib/mapChrome";
import AnimatedMarker from "./AnimatedMarker";
import LiveUserMarker from "./LiveUserMarker";
import ProfileAvatar from "./ProfileAvatar";
import { BASE_MAP_STYLE, applyIntoNowMapStyle } from "@/lib/mapStyle";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  posts: Post[];
  litUsers: MapUser[];
  unlitUsers: MapUser[];
  myLocation: { lat: number; lng: number } | null;
  center: { lat: number; lng: number };
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  currentUserId: string | null;
  currentUserPhotoUrl?: string | null;
  currentUserDisplayName?: string | null;
  onMessageUser: (userId: string) => void;
};

export default function MapView({
  posts,
  litUsers,
  unlitUsers,
  myLocation,
  center,
  zoom,
  selectedId,
  onSelect,
  currentUserId,
  currentUserPhotoUrl,
  currentUserDisplayName,
  onMessageUser,
}: Props) {
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const selected = useMemo(
    () => posts.find((p) => p.id === selectedId) ?? null,
    [posts, selectedId]
  );

  const allUsers = useMemo(() => [...litUsers, ...unlitUsers], [litUsers, unlitUsers]);

  const selectedUser = useMemo(
    () => allUsers.find((u) => u.userId === selectedUserId) ?? null,
    [allUsers, selectedUserId]
  );

  // --- Map chrome padding (confine map) -------------------------------
  // Keeps pan/zoom/center inside the rectangle bounded by the four corner
  // controls + centered logo, so the camera never settles somewhere hidden
  // under a FAB. Applied on load and on resize only; does not touch marker
  // rendering or props (owned by Agent 1).
  const applyChromePadding = useCallback(() => {
    mapRef.current?.setPadding(getMapChromePadding());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("resize", applyChromePadding);
    return () => window.removeEventListener("resize", applyChromePadding);
  }, [applyChromePadding]);
  // ----------------------------------------------------------------------

  const onLoad = useCallback(
    (evt: { target: import("maplibre-gl").Map }) => {
      mapRef.current = evt.target;
      applyIntoNowMapStyle(evt.target);
      applyChromePadding();
    },
    [applyChromePadding]
  );

  useEffect(() => {
    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom,
      duration: 800,
    });
  }, [center.lat, center.lng, zoom]);

  return (
    <div className="absolute inset-0">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,77,109,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(255,138,30,0.06),transparent_40%)]" />
      <Map
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom }}
        mapStyle={BASE_MAP_STYLE}
        onLoad={onLoad}
        onClick={() => {
          setSelectedUserId(null);
        }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {myLocation && (
          <AnimatedMarker latitude={myLocation.lat} longitude={myLocation.lng} anchor="center">
            <LiveUserMarker
              isSelf
              isLit
              photoUrl={currentUserPhotoUrl}
              displayName={currentUserDisplayName}
              userId={currentUserId}
            />
          </AnimatedMarker>
        )}
        {unlitUsers.map((user) => (
          <Marker
            key={`unlit-${user.userId}`}
            latitude={user.lat}
            longitude={user.lng}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedUserId(user.userId);
              onSelect(null);
            }}
          >
            <LiveUserMarker
              isLit={false}
              photoUrl={user.photoUrl}
              displayName={user.displayName}
              userId={user.userId}
            />
          </Marker>
        ))}
        {litUsers.map((user) => (
          <AnimatedMarker
            key={`lit-${user.userId}`}
            latitude={user.lat}
            longitude={user.lng}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedUserId(user.userId);
              onSelect(null);
            }}
          >
            <LiveUserMarker
              isLit
              photoUrl={user.photoUrl}
              displayName={user.displayName}
              userId={user.userId}
            />
          </AnimatedMarker>
        ))}
        {posts.map((post) => {
          const color = getCodeColor(post.category);
          const isSelected = post.id === selectedId;
          return (
            <Marker
              key={post.id}
              latitude={post.lat}
              longitude={post.lng}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedUserId(null);
                onSelect(post.id);
              }}
            >
              <div
                className="cursor-pointer transition-transform duration-200"
                style={{ transform: isSelected ? "scale(1.35)" : "scale(1)" }}
              >
                <div
                  className="h-5 w-5 rounded-full border-2 border-white/90"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 ${isSelected ? 18 : 10}px ${color}`,
                  }}
                />
              </div>
            </Marker>
          );
        })}
        {selected && (
          <Popup
            latitude={selected.lat}
            longitude={selected.lng}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={14}
            className="intonow-popup"
          >
            <div className="min-w-[180px]">
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: getCodeColor(selected.category) }}
              >
                {selected.category}
              </p>
              <p className="mt-1 font-semibold text-white">{selected.title}</p>
              <p className="mt-1 text-sm text-white/70 line-clamp-3">{selected.description}</p>
              {selected.authorId && selected.authorId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => onMessageUser(selected.authorId!)}
                  className="mt-3 w-full rounded-lg border border-[#FF8A1E]/30 bg-[#FF8A1E]/10 px-3 py-1.5 text-xs font-semibold text-[#FF8A1E] transition hover:bg-[#FF8A1E]/20"
                >
                  Message author
                </button>
              )}
            </div>
          </Popup>
        )}
        {selectedUser && (
          <Popup
            latitude={selectedUser.lat}
            longitude={selectedUser.lng}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={14}
            className="intonow-popup"
          >
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2">
                <ProfileAvatar
                  photoUrl={selectedUser.photoUrl}
                  displayName={selectedUser.displayName}
                  userId={selectedUser.userId}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedUser.displayName ?? "Nearby user"}
                  </p>
                  <p className="text-[10px] text-white/50">
                    {selectedUser.isLit ? "Live on the map" : "Was here recently"}
                  </p>
                </div>
              </div>
              {selectedUser.statement && (
                <p className="mt-2 text-xs text-white/60 line-clamp-3">{selectedUser.statement}</p>
              )}
              {selectedUser.userId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => onMessageUser(selectedUser.userId)}
                  className="mt-3 w-full rounded-lg border border-[#FF8A1E]/30 bg-[#FF8A1E]/10 px-3 py-1.5 text-xs font-semibold text-[#FF8A1E] transition hover:bg-[#FF8A1E]/20"
                >
                  Message
                </button>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}