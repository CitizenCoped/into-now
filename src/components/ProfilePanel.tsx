"use client";

import { useState } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import type { PushPreferences } from "@/hooks/usePushNotifications";
import AuthForm from "./AuthForm";
import ProfileAvatar from "./ProfileAvatar";
import ProfileEditor from "./ProfileEditor";
import PushSettings from "./PushSettings";

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  user: AuthUser | null;
  authLoading: boolean;
  birthDate: string;
  onSendPhoneCode: (phone: string) => Promise<string>;
  onSendEmailCode: (email: string) => Promise<string>;
  onVerifyPhoneCode: (phone: string, code: string, birthDate: string) => Promise<unknown>;
  onVerifyEmailCode: (email: string, code: string, birthDate: string) => Promise<unknown>;
  onSaveProfile: (updates: { displayName: string; statement: string; photoUrl: string }) => Promise<unknown>;
  onLogout: () => Promise<void>;
  pushPermission: NotificationPermission;
  pushSubscribed: boolean;
  pushPreferences: PushPreferences;
  pushLoading: boolean;
  pushError: string;
  onEnablePush: () => Promise<void>;
  onDisablePush: () => Promise<void>;
  onPushPreferencesChange: (next: Partial<PushPreferences>) => Promise<void>;
  showSignup?: boolean;
  onSignupClose?: () => void;
};

export default function ProfilePanel({
  expanded,
  onExpandedChange,
  user,
  authLoading,
  birthDate,
  onSendPhoneCode,
  onSendEmailCode,
  onVerifyPhoneCode,
  onVerifyEmailCode,
  onSaveProfile,
  onLogout,
  pushPermission,
  pushSubscribed,
  pushPreferences,
  pushLoading,
  pushError,
  onEnablePush,
  onDisablePush,
  onPushPreferencesChange,
  showSignup,
  onSignupClose,
}: Props) {
  const [editing, setEditing] = useState(false);

  const panelPosition =
    "intonow-profile-panel fixed z-20 top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => onExpandedChange(true)}
        className={`${panelPosition} flex items-center gap-2 rounded-full border border-white/10 bg-[#0f0d18]/90 px-3 py-2 shadow-2xl backdrop-blur-xl transition hover:border-[#22D3EE]/40`}
        aria-label="Open profile"
      >
        {user ? (
          <ProfileAvatar photoUrl={user.photoUrl} displayName={user.displayName} size="sm" />
        ) : (
          <span className="text-sm font-semibold text-[#22D3EE]">Profile</span>
        )}
        <span className="text-white/50" aria-hidden>
          ▼
        </span>
      </button>
    );
  }

  return (
    <aside
      className={`${panelPosition} flex max-h-[min(70vh,560px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0d18]/90 shadow-2xl backdrop-blur-xl`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <p className="text-sm font-semibold text-[#22D3EE]">Profile</p>
        <button
          type="button"
          onClick={() => {
            onSignupClose?.();
            onExpandedChange(false);
          }}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/60 transition hover:text-white"
          aria-label="Minimize profile"
        >
          ▲
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {authLoading ? (
          <p className="py-6 text-center text-sm text-white/30">Checking session...</p>
        ) : showSignup || !user ? (
          <AuthForm
            birthDate={birthDate}
            onSendPhoneCode={onSendPhoneCode}
            onSendEmailCode={onSendEmailCode}
            onVerifyPhoneCode={(phone, code) => onVerifyPhoneCode(phone, code, birthDate)}
            onVerifyEmailCode={(email, code) => onVerifyEmailCode(email, code, birthDate)}
          />
        ) : editing ? (
          <ProfileEditor
            user={user}
            onSave={async (updates) => {
              await onSaveProfile(updates);
              setEditing(false);
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar photoUrl={user.photoUrl} displayName={user.displayName} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{user.displayName ?? user.displayLabel}</p>
                <p className="text-xs text-white/40">
                  {user.isAnonymous ? "Anonymous · 4h session" : "Registered account"}
                </p>
              </div>
            </div>

            {user.statement && (
              <p className="text-sm text-white/70">{user.statement}</p>
            )}

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:text-white"
            >
              Edit profile
            </button>

            <PushSettings
              permission={pushPermission}
              subscribed={pushSubscribed}
              preferences={pushPreferences}
              loading={pushLoading}
              error={pushError}
              onEnable={onEnablePush}
              onDisable={onDisablePush}
              onPreferencesChange={onPushPreferencesChange}
            />

            <button
              type="button"
              onClick={() => onLogout()}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white/50 transition hover:text-[#FF4D6D]"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}