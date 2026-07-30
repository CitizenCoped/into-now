"use client";

import type { PushPreferences } from "@/hooks/usePushNotifications";

type Props = {
  permission: NotificationPermission;
  subscribed: boolean;
  preferences: PushPreferences;
  loading: boolean;
  error: string;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  onPreferencesChange: (next: Partial<PushPreferences>) => Promise<void>;
};

export default function PushSettings({
  permission,
  subscribed,
  preferences,
  loading,
  error,
  onEnable,
  onDisable,
  onPreferencesChange,
}: Props) {
  const unsupported = typeof window !== "undefined" && !("Notification" in window);

  if (unsupported) {
    return (
      <p className="text-xs text-white/40">Notifications are not supported on this browser.</p>
    );
  }

  return (
    <div className="mt-4 shrink-0 space-y-3 border-t border-white/5 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Notifications</p>

      {!subscribed ? (
        <button
          type="button"
          onClick={() => onEnable()}
          disabled={loading || permission === "denied"}
          className="w-full rounded-lg border border-[#FF8A1E]/30 bg-[#FF8A1E]/10 py-2 text-sm font-semibold text-[#FF8A1E] transition hover:bg-[#FF8A1E]/20 disabled:opacity-50"
        >
          {loading ? "Enabling..." : "Enable push notifications"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onDisable()}
          disabled={loading}
          className="w-full rounded-lg border border-white/10 py-2 text-sm text-white/60 transition hover:text-white disabled:opacity-50"
        >
          {loading ? "Saving..." : "Disable notifications"}
        </button>
      )}

      {permission === "denied" && (
        <p className="text-xs text-amber-400/80">
          Notifications are blocked. Enable them in your browser or device settings.
        </p>
      )}

      {subscribed && (
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 text-sm text-white/70">
            <span>New messages</span>
            <input
              type="checkbox"
              checked={preferences.notifyMessages}
              onChange={(e) => onPreferencesChange({ notifyMessages: e.target.checked })}
              className="h-4 w-4 accent-[#FF8A1E]"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-white/70">
            <span>New users live nearby</span>
            <input
              type="checkbox"
              checked={preferences.notifyPresence}
              onChange={(e) => onPreferencesChange({ notifyPresence: e.target.checked })}
              className="h-4 w-4 accent-[#FF8A1E]"
            />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-[#FF4D6D]">{error}</p>}
    </div>
  );
}