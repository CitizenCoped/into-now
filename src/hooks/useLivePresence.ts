"use client";

import { distanceKm } from "@/lib/geo";
import {
  ACCURACY_GATE_M,
  HEARTBEAT_MS,
  HIDDEN_GRACE_MS,
  MIN_SEND_INTERVAL_MS,
  MOVE_THRESHOLD_M,
  PRESENCE_CHANNEL,
  PRESENCE_EVENT,
  PRESENCE_TTL_MS,
  RESYNC_INTERVAL_MS,
} from "@/lib/presenceConfig";
import { getOrCreateSessionId } from "@/lib/session";
import type { MapUser } from "@/lib/schema";
import PusherClient from "pusher-js";
import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];

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
    id: update.userId,
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
  const [locationDenied, setLocationDenied] = useState(false);

  const sessionId = useRef("");
  const latestCoords = useRef<{ lat: number; lng: number } | null>(null);
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const deniedRef = useRef(false);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDenied = useCallback((denied: boolean) => {
    deniedRef.current = denied;
    setLocationDenied(denied);
  }, []);

  const sendPresence = useCallback(
    async (status: "online" | "offline" = "online") => {
      if (!enabled || !sessionId.current || !latestCoords.current) return;

      const coords = latestCoords.current;
      const payload = {
        sessionId: sessionId.current,
        lat: coords.lat,
        lng: coords.lng,
        status,
      };

      const body = JSON.stringify(payload);

      if (status === "offline") {
        lastSent.current = null;
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/presence", new Blob([body], { type: "application/json" }));
          return;
        }
      } else {
        lastSent.current = { lat: coords.lat, lng: coords.lng, at: Date.now() };
      }

      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: status === "offline",
      }).catch(() => {});
    },
    [enabled]
  );

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

  const resync = useCallback(async () => {
    try {
      const res = await fetch("/api/presence");
      const data = await res.json();
      const lit: MapUser[] = (data.lit ?? data.sessions ?? [])
        .filter((s: MapUser) => s.userId !== currentUserId)
        .map((s: MapUser) => ({ ...s, id: s.userId, isLit: true }));
      const unlit: MapUser[] = (data.unlit ?? [])
        .filter((s: MapUser) => s.userId !== currentUserId)
        .map((s: MapUser) => ({ ...s, isLit: false }));
      setLitUsers(lit);
      setUnlitUsers(unlit);
    } catch {
      // keep current state; next resync will heal
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!enabled) return;

    sessionId.current = getOrCreateSessionId();

    resync();

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us3";

    let pusher: PusherClient | null = null;
    if (key) {
      pusher = new PusherClient(key, {
        cluster,
        authEndpoint: "/api/pusher/auth",
      });
      const channel = pusher.subscribe(PRESENCE_CHANNEL);
      channel.bind(PRESENCE_EVENT, applyUpdate);
      pusher.connection.bind("connected", () => {
        setConnected(true);
        resync();
      });
      pusher.connection.bind("disconnected", () => setConnected(false));
    }

    if (!navigator.geolocation) return;

    const onFix = (pos: GeolocationPosition) => {
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      latestCoords.current = coords;
      setMyLocation(coords);
      setSharing(true);
      markDenied(false);
      retryCount.current = 0;

      if (document.visibilityState !== "visible") return;

      const last = lastSent.current;
      if (!last) {
        sendPresence("online");
        return;
      }

      if (pos.coords.accuracy != null && pos.coords.accuracy > ACCURACY_GATE_M) return;

      const movedMeters = distanceKm(last.lat, last.lng, coords.lat, coords.lng) * 1000;
      const elapsed = Date.now() - last.at;
      if (movedMeters >= MOVE_THRESHOLD_M && elapsed >= MIN_SEND_INTERVAL_MS) {
        sendPresence("online");
      }
    };

    const onWatchError = (err: GeolocationPositionError) => {
      setSharing(false);
      if (err.code === err.PERMISSION_DENIED) {
        markDenied(true);
        return;
      }
      // Transient error (timeout, position unavailable): re-establish with backoff.
      const delay = RETRY_DELAYS_MS[Math.min(retryCount.current, RETRY_DELAYS_MS.length - 1)];
      retryCount.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(startWatch, delay);
    };

    const startWatch = () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(onFix, onWatchError, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      });
    };

    startWatch();

    // Restart the watch the moment permission flips to granted — no reload needed.
    let permStatus: PermissionStatus | null = null;
    const onPermissionChange = () => {
      if (!permStatus) return;
      if (permStatus.state === "granted") {
        markDenied(false);
        retryCount.current = 0;
        startWatch();
      } else if (permStatus.state === "denied") {
        markDenied(true);
        setSharing(false);
      }
    };
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          permStatus = status;
          if (status.state === "denied") markDenied(true);
          status.addEventListener("change", onPermissionChange);
        })
        .catch(() => {});
    }

    const heartbeat = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        latestCoords.current &&
        !deniedRef.current &&
        Date.now() - (lastSent.current?.at ?? 0) >= HEARTBEAT_MS
      ) {
        sendPresence("online");
      }
    }, 5_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (hiddenTimer.current) {
          clearTimeout(hiddenTimer.current);
          hiddenTimer.current = null;
        }
        if (latestCoords.current && !deniedRef.current) sendPresence("online");
      } else {
        // Grace period: brief app-switches shouldn't flicker the green light.
        if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
        hiddenTimer.current = setTimeout(() => sendPresence("offline"), HIDDEN_GRACE_MS);
      }
    };

    const onUnload = () => sendPresence("offline");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);

    const pruneTimer = setInterval(pruneStale, 10_000);
    const resyncTimer = setInterval(resync, RESYNC_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      clearInterval(pruneTimer);
      clearInterval(resyncTimer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
      permStatus?.removeEventListener("change", onPermissionChange);
      sendPresence("offline");
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (pusher) {
        pusher.unsubscribe(PRESENCE_CHANNEL);
        pusher.disconnect();
      }
    };
  }, [applyUpdate, enabled, markDenied, pruneStale, resync, sendPresence]);

  return {
    litUsers,
    unlitUsers,
    liveUsers: litUsers,
    myLocation,
    connected,
    sharing,
    locationDenied,
    sessionId: sessionId.current,
  };
}
