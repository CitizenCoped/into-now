"use client";

import { PRESENCE_CHANNEL, PRESENCE_EVENT, PRESENCE_TTL_MS } from "@/lib/pusher";
import { getOrCreateSessionId } from "@/lib/session";
import type { MapUser } from "@/lib/schema";
import PusherClient from "pusher-js";
import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_MS = 20_000;

type PresenceUpdate = {
  sessionId: string;
  userId?: string | null;
  lat: number;
  lng: number;
  status: "online" | "offline";
  lastSeenAt: string;
  displayName?: string | null;
  photoUrl?: string | null;
  statement?: string | null;
  isAnonymous?: boolean;
  birthDate?: string | null;
};

function isActive(lastSeenAt: string | Date) {
  const seen = new Date(lastSeenAt).getTime();
  return Date.now() - seen < PRESENCE_TTL_MS;
}

function toMapUser(update: PresenceUpdate, isLit: boolean): MapUser | null {
  if (!update.userId) return null;
  return {
    id: isLit ? update.sessionId : update.userId,
    userId: update.userId,
    lat: update.lat,
    lng: update.lng,
    isLit,
    displayName: update.displayName ?? null,
    photoUrl: update.photoUrl ?? null,
    statement: update.statement ?? null,
    isAnonymous: Boolean(update.isAnonymous),
    birthDate: update.birthDate ?? null,
    lastSeenAt: update.lastSeenAt,
  };
}

export function useLivePresence(enabled: boolean, currentUserId: string | null) {
  const [litUsers, setLitUsers] = useState<MapUser[]>([]);
  const [unlitUsers, setUnlitUsers] = useState<MapUser[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sessionId = useRef("");
  const latestCoords = useRef<{ lat: number; lng: number } | null>(null);
  const watchId = useRef<number | null>(null);

  const sendPresence = useCallback(async (status: "online" | "offline" = "online") => {
    if (!enabled || !sessionId.current || !latestCoords.current) return;

    const payload = {
      sessionId: sessionId.current,
      lat: latestCoords.current.lat,
      lng: latestCoords.current.lng,
      status,
    };

    const body = JSON.stringify(payload);

    if (status === "offline" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/presence", new Blob([body], { type: "application/json" }));
      return;
    }

    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: status === "offline",
    });
  }, [enabled]);

  const applyUpdate = useCallback(
    (update: PresenceUpdate) => {
      if (!update.userId || update.userId === currentUserId) return;

      if (update.status === "offline") {
        const unlit = toMapUser(update, false);
        if (!unlit) return;
        setLitUsers((prev) => prev.filter((u) => u.userId !== update.userId));
        setUnlitUsers((prev) => {
          const others = prev.filter((u) => u.userId !== update.userId);
          return [...others, unlit];
        });
        return;
      }

      if (!isActive(update.lastSeenAt)) return;

      const lit = toMapUser(update, true);
      if (!lit) return;

      setUnlitUsers((prev) => prev.filter((u) => u.userId !== update.userId));
      setLitUsers((prev) => {
        const others = prev.filter((u) => u.userId !== update.userId);
        return [...others, lit];
      });
    },
    [currentUserId]
  );

  const pruneStale = useCallback(() => {
    setLitUsers((prev) => {
      const stale = prev.filter((u) => u.lastSeenAt && !isActive(u.lastSeenAt));
      if (stale.length > 0) {
        setUnlitUsers((unlitPrev) => {
          const merged = [...unlitPrev];
          for (const user of stale) {
            if (!merged.some((u) => u.userId === user.userId)) {
              merged.push({ ...user, isLit: false, id: user.userId });
            }
          }
          return merged;
        });
      }
      return prev.filter((u) => !u.lastSeenAt || isActive(u.lastSeenAt));
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    sessionId.current = getOrCreateSessionId();

    fetch("/api/presence")
      .then((r) => r.json())
      .then((data) => {
        const lit: MapUser[] = (data.lit ?? data.sessions ?? [])
          .filter((s: MapUser) => s.userId !== currentUserId)
          .map((s: MapUser) => ({ ...s, isLit: true }));
        const unlit: MapUser[] = (data.unlit ?? [])
          .filter((s: MapUser) => s.userId !== currentUserId)
          .map((s: MapUser) => ({ ...s, isLit: false }));
        setLitUsers(lit);
        setUnlitUsers(unlit);
      })
      .catch(() => {});

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us3";

    let pusher: PusherClient | null = null;
    if (key) {
      pusher = new PusherClient(key, { cluster });
      const channel = pusher.subscribe(PRESENCE_CHANNEL);
      channel.bind(PRESENCE_EVENT, applyUpdate);
      pusher.connection.bind("connected", () => setConnected(true));
      pusher.connection.bind("disconnected", () => setConnected(false));
    }

    if (!navigator.geolocation) return;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        latestCoords.current = coords;
        setMyLocation(coords);
        setSharing(true);
      },
      () => setSharing(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible" && latestCoords.current) {
        sendPresence("online");
      }
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && latestCoords.current) {
        sendPresence("online");
      } else {
        sendPresence("offline");
      }
    };

    const onUnload = () => sendPresence("offline");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    const pruneTimer = setInterval(pruneStale, 10_000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(pruneTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      sendPresence("offline");
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (pusher) {
        pusher.unsubscribe(PRESENCE_CHANNEL);
        pusher.disconnect();
      }
    };
  }, [applyUpdate, currentUserId, enabled, pruneStale, sendPresence]);

  useEffect(() => {
    if (enabled && myLocation && document.visibilityState === "visible") {
      sendPresence("online");
    }
  }, [enabled, myLocation, sendPresence]);

  return {
    litUsers,
    unlitUsers,
    liveUsers: litUsers,
    myLocation,
    connected,
    sharing,
    sessionId: sessionId.current,
  };
}