"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
};

export default function MapView({
  posts,
  liveUsers,
  myLocation,
  center,
  zoom,
  selectedId,
  onSelect,
}: Props) {
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const selected = useMemo(
    () => posts.find((p) => p.id === selectedId) ?? null,
    [posts, selectedId]
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
          <Marker key={user.id} latitude={user.lat} longitude={user.lng} anchor="center">
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
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
