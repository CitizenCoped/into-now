"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  authMethod: "phone" | "email" | "anonymous";
  isAnonymous: boolean;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  ageVerifiedAt: string | null;
  displayName: string | null;
  photoUrl: string | null;
  statement: string | null;
  expiresAt: string | null;
  displayLabel: string;
  maskedPhone: string | null;
  profileComplete: boolean;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      setUser(data.user ?? null);
      return data.user as AuthUser | null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendPhoneCode = useCallback(async (phone: string) => {
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "phone", phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to send code");
    return data.phone as string;
  }, []);

  /** Legacy Twilio Verify flow — phone-only body, no channel or birthDate. */
  const sendCode = useCallback(async (phone: string) => {
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to send code");
    return data.phone as string;
  }, []);

  const sendEmailCode = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "email", email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to send code");
    return data.email as string;
  }, []);

  const verifyPhoneCode = useCallback(
    async (phone: string, code: string, birthDate: string) => {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", phone, code, birthDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setUser(data.user ?? null);
      await refresh();
      return data.user as AuthUser;
    },
    [refresh]
  );

  /** Legacy Twilio Verify flow — phone + code only, no age gate at sign-in. */
  const verifyCode = useCallback(
    async (phone: string, code: string) => {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setUser(data.user ?? null);
      await refresh();
      return data.user as AuthUser;
    },
    [refresh]
  );

  const verifyEmailCode = useCallback(
    async (email: string, code: string, birthDate: string) => {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email", email, code, birthDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setUser(data.user ?? null);
      await refresh();
      return data.user as AuthUser;
    },
    [refresh]
  );

  const createAnonymous = useCallback(
    async (birthDate: string) => {
      const res = await fetch("/api/auth/anonymous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start anonymous session");
      setUser(data.user ?? null);
      await refresh();
      return data.user as AuthUser;
    },
    [refresh]
  );

  const updateProfile = useCallback(
    async (updates: { displayName?: string; statement?: string; photoUrl?: string }) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update profile");
      setUser(data.user ?? null);
      return data.user as AuthUser;
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return {
    user,
    loading,
    refresh,
    sendPhoneCode,
    sendEmailCode,
    sendCode,
    verifyPhoneCode,
    verifyEmailCode,
    verifyCode,
    createAnonymous,
    updateProfile,
    logout,
  };
}