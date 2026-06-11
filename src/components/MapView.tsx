"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/maplibre";
import type { LiveSession, Post } from "@/lib/schema";
import { getCategoryColor } from "@/lib/categories";
import LiveUserMarker from "./LiveUserMarker";
import { BASE_MAP_STYLE, applyIntoNowMapStyle } from "@/lib/mapStyle";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  posts: Post[];
  liveUsers: LiveSession[];
  myLocation: { lat: number; lng: number } | null;
  center: { lat: number; lng: number };
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  currentUserId: string | null;
  onMessageUser: (userId: string) => void;
};

export default function MapView({
  posts,
  liveUsers,
  myLocation,
  center,
  zoom,
  selectedId,
  onSelect,
  currentUserId,
  onMessageUser,
}: Props) {
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [selectedLiveUserId, setSelectedLiveUserId] = useState<string | null>(null);

  const selected = useMemo(
    () => posts.find((p) => p.id === selectedId) ?? null,
    [posts, selectedId]
  );

  const selectedLiveUser = useMemo(
    () => liveUsers.find((u) => u.userId === selectedLiveUserId) ?? null,
    [liveUsers, selectedLiveUserId]
  );

  const onLoad = useCallback((evt: { target: import("maplibre-gl").Map }) => {
    mapRef.current = evt.target;
    applyIntoNowMapStyle(evt.target);
  }, []);

  useEffect(() => {
    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom,
      duration: 800,
    });
  }, [center.lat, center.lng, zoom]);

  return (
    <div className="absolute inset-0">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,77,109,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.06),transparent_40%)]" />
      <Map
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom }}
        mapStyle={BASE_MAP_STYLE}
        onLoad={onLoad}
        onClick={() => {
          setSelectedLiveUserId(null);
        }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {myLocation && (
          <Marker latitude={myLocation.lat} longitude={myLocation.lng} anchor="center">
            <LiveUserMarker isSelf />
          </Marker>
        )}
        {liveUsers.map((user) => (
          <Marker
            key={user.id}
            latitude={user.lat}
            longitude={user.lng}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              if (user.userId) {
                setSelectedLiveUserId(user.userId);
                onSelect(null);
              }
            }}
          >
            <LiveUserMarker />
          </Marker>
        ))}
        {posts.map((post) => {
          const color = getCategoryColor(post.category);
          const isSelected = post.id === selectedId;
          return (
            <Marker
              key={post.id}
              latitude={post.lat}
              longitude={post.lng}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedLiveUserId(null);
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
              <p className="text-xs font-medium uppercase tracking-wide text-[#FF4D6D]">
                {selected.category}
              </p>
              <p className="mt-1 font-semibold text-white">{selected.title}</p>
              <p className="mt-1 text-sm text-white/70 line-clamp-3">{selected.description}</p>
              {selected.authorId && selected.authorId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => onMessageUser(selected.authorId!)}
                  className="mt-3 w-full rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 py-1.5 text-xs font-semibold text-[#22D3EE] transition hover:bg-[#22D3EE]/20"
                >
                  Message author
                </button>
              )}
            </div>
          </Popup>
        )}
        {selectedLiveUser && selectedLiveUser.userId && (
          <Popup
            latitude={selectedLiveUser.lat}
            longitude={selectedLiveUser.lng}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={14}
            className="intonow-popup"
          >
            <div className="min-w-[140px]">
              <p className="text-sm font-semibold text-white">Nearby user</p>
              <p className="mt-1 text-xs text-white/50">Live on the map now</p>
              {selectedLiveUser.userId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => onMessageUser(selectedLiveUser.userId!)}
                  className="mt-3 w-full rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 py-1.5 text-xs font-semibold text-[#22D3EE] transition hover:bg-[#22D3EE]/20"
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