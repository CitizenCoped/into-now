"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type PushPreferences = {
  notifyMessages: boolean;
  notifyPresence: boolean;
};

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>({
    notifyMessages: true,
    notifyPresence: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!userId || typeof window === "undefined") {
      setSubscribed(false);
      return;
    }

    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    try {
      const res = await fetch("/api/push/subscribe");
      if (res.ok) {
        const data = await res.json();
        setSubscribed(Boolean(data.subscribed));
        if (data.preferences) {
          setPreferences({
            notifyMessages: data.preferences.notifyMessages ?? true,
            notifyPresence: data.preferences.notifyPresence ?? true,
          });
        }
      }
    } catch {
      setSubscribed(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const registerServiceWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported on this device");
    }
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return navigator.serviceWorker.ready;
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!userId) throw new Error("Sign in to enable notifications");
    setLoading(true);
    setError("");

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        throw new Error("Notification permission denied");
      }

      const vapidRes = await fetch("/api/push/vapid-key");
      const vapidData = await vapidRes.json();
      if (!vapidRes.ok) throw new Error(vapidData.error ?? "Push not configured");

      const registration = await registerServiceWorker();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Could not create push subscription");
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          notifyMessages: preferences.notifyMessages,
          notifyPresence: preferences.notifyPresence,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save subscription");
      }

      setSubscribed(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enable notifications";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, preferences.notifyMessages, preferences.notifyPresence, registerServiceWorker]);

  const disableNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;

      if (subscription) {
        await subscription.unsubscribe();
      }

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      setSubscribed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disable notifications";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (next: Partial<PushPreferences>) => {
      const merged = { ...preferences, ...next };
      setPreferences(merged);

      if (!userId) return;

      await fetch("/api/push/subscribe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
    },
    [preferences, userId]
  );

  return {
    permission,
    subscribed,
    preferences,
    loading,
    error,
    enableNotifications,
    disableNotifications,
    updatePreferences,
    refreshStatus,
  };
}