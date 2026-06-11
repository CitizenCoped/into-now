"use client";

import { PRESENCE_CHANNEL, PRESENCE_EVENT, PRESENCE_TTL_MS } from "@/lib/pusher";
import { getOrCreateSessionId } from "@/lib/session";
import type { LiveSession } from "@/lib/schema";
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
};

function isActive(session: { lastSeenAt: string | Date }) {
  const seen = new Date(session.lastSeenAt).getTime();
  return Date.now() - seen < PRESENCE_TTL_MS;
}

export function useLivePresence() {
  const [liveUsers, setLiveUsers] = useState<LiveSession[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sessionId = useRef("");
  const latestCoords = useRef<{ lat: number; lng: number } | null>(null);
  const watchId = useRef<number | null>(null);

  const sendPresence = useCallback(async (status: "online" | "offline" = "online") => {
    if (!sessionId.current || !latestCoords.current) return;

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
  }, []);

  const pruneStale = useCallback(() => {
    setLiveUsers((prev) => prev.filter((u) => isActive(u)));
  }, []);

  const applyUpdate = useCallback(
    (update: PresenceUpdate) => {
      const selfId = sessionId.current;

      if (update.status === "offline") {
        setLiveUsers((prev) => prev.filter((u) => u.id !== update.sessionId));
        return;
      }

      if (!isActive(update)) return;

      setLiveUsers((prev) => {
        const others = prev.filter((u) => u.id !== update.sessionId && u.id !== selfId);
        if (update.sessionId === selfId) return others;

        const entry: LiveSession = {
          id: update.sessionId,
          lat: update.lat,
          lng: update.lng,
          userId: update.userId ?? null,
          lastSeenAt: new Date(update.lastSeenAt),
          createdAt: new Date(update.lastSeenAt),
        };
        return [...others, entry];
      });
    },
    []
  );

  useEffect(() => {
    sessionId.current = getOrCreateSessionId();

    fetch("/api/presence")
      .then((r) => r.json())
      .then((data) => {
        const selfId = sessionId.current;
        const sessions: LiveSession[] = (data.sessions ?? []).filter(
          (s: LiveSession) => s.id !== selfId && isActive(s)
        );
        setLiveUsers(sessions);
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
  }, [applyUpdate, pruneStale, sendPresence]);

  useEffect(() => {
    if (myLocation && document.visibilityState === "visible") {
      sendPresence("online");
    }
  }, [myLocation, sendPresence]);

  return { liveUsers, myLocation, connected, sharing, sessionId: sessionId.current };
}