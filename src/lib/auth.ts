import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/schema";

export const AUTH_COOKIE = "intonow_auth";
export const AUTH_MAX_AGE_SEC = 60 * 60 * 24;
export const AUTH_ANON_MAX_AGE_SEC = 60 * 60 * 4;

export type AuthMethod = "phone" | "email" | "anonymous";

export type AuthUser = {
  id: string;
  authMethod: AuthMethod;
  isAnonymous: boolean;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  ageVerifiedAt: Date | null;
  displayName: string | null;
  photoUrl: string | null;
  statement: string | null;
  expiresAt: Date | null;
};

type JwtPayload = {
  userId: string;
  authMethod: AuthMethod;
  isAnonymous: boolean;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `•••-•••-${last4}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••@•••";
  const visible = local.slice(0, 1);
  return `${visible}•••@${domain}`;
}

export { isAdult } from "@/lib/geo";

export function getDisplayLabel(user: {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  isAnonymous?: boolean;
}): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.phone) return maskPhone(user.phone);
  if (user.email) return maskEmail(user.email);
  if (user.isAnonymous) return "Anonymous";
  return "User";
}

export function userToAuthUser(row: User): AuthUser {
  return {
    id: row.id,
    authMethod: row.authMethod as AuthMethod,
    isAnonymous: row.isAnonymous,
    phone: row.phone,
    email: row.email,
    birthDate: row.birthDate,
    ageVerifiedAt: row.ageVerifiedAt,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    statement: row.statement,
    expiresAt: row.expiresAt,
  };
}

export function isProfileComplete(user: AuthUser): boolean {
  return Boolean(
    user.displayName?.trim() && user.photoUrl?.trim() && user.statement?.trim()
  );
}

export async function createAuthToken(
  payload: JwtPayload,
  maxAgeSec: number = AUTH_MAX_AGE_SEC
) {
  const exp = `${maxAgeSec}s`;
  return new SignJWT({
    userId: payload.userId,
    authMethod: payload.authMethod,
    isAnonymous: payload.isAnonymous,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyAuthToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.userId;
    if (typeof userId !== "string") return null;

    const authMethod = payload.authMethod;
    if (authMethod === "phone" || authMethod === "email" || authMethod === "anonymous") {
      return {
        userId,
        authMethod,
        isAnonymous: Boolean(payload.isAnonymous),
      };
    }

    // Legacy Twilio phone tokens: { userId, phone }
    if (typeof payload.phone === "string") {
      return {
        userId,
        authMethod: "phone",
        isAnonymous: false,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function expireAnonymousUsers() {
  const db = getDb();
  const now = new Date();
  await db.delete(users).where(lt(users.expiresAt, now));
}

export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return null;

  if (row.isAnonymous && row.expiresAt && row.expiresAt < new Date()) {
    await db.delete(users).where(eq(users.id, userId));
    return null;
  }

  return userToAuthUser(row);
}

export async function getAuthUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  return loadAuthUser(payload.userId);
}

export async function getAuthUserFromCookies(): Promise<AuthUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  return loadAuthUser(payload.userId);
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  maxAgeSec: number = AUTH_MAX_AGE_SEC
) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSec,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function serializeAuthUser(user: AuthUser) {
  return {
    id: user.id,
    authMethod: user.authMethod,
    isAnonymous: user.isAnonymous,
    phone: user.phone,
    email: user.email,
    birthDate: user.birthDate,
    ageVerifiedAt: user.ageVerifiedAt?.toISOString() ?? null,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    statement: user.statement,
    expiresAt: user.expiresAt?.toISOString() ?? null,
    displayLabel: getDisplayLabel(user),
    maskedPhone: user.phone ? maskPhone(user.phone) : null,
    profileComplete: isProfileComplete(user),
  };
}