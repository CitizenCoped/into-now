import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  MANAGEMENT_COOKIE,
  MANAGEMENT_MAX_AGE_SEC,
  createManagementToken,
  createPendingLoginToken,
  verifyManagementToken,
  verifyPendingLoginToken,
  type ManagementJwt,
} from "@/lib/managementJwt";
import { adminInvites, adminUsers, type AdminUser } from "@/lib/schema";

export {
  MANAGEMENT_COOKIE,
  MANAGEMENT_MAX_AGE_SEC,
  createManagementToken,
  createPendingLoginToken,
  verifyManagementToken,
  verifyPendingLoginToken,
};
export type { ManagementJwt };

const scrypt = promisify(scryptCb);

export const TOTP_ISSUER = "thebestdrug.com";
export const INVITE_TTL_MS = 60 * 60 * 1000;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type ManagementAdmin = {
  id: string;
  username: string;
};

function getCryptoKey() {
  const secret = process.env.MANAGEMENT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function toBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(input: string): Buffer {
  const cleaned = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return toBase32(randomBytes(20));
}

export function totpUri(username: string, secret: string): string {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${username}`);
  const issuer = encodeURIComponent(TOTP_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
}

function totpCode(secret: string, counter: number): string {
  const key = fromBase32(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Math.floor(Date.now() / 1000 / 30);
  const provided = Buffer.from(normalized);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(totpCode(secret, now + i));
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      return true;
    }
  }
  return false;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCryptoKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !encB64) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", getCryptoKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function setManagementCookie(response: NextResponse, token: string) {
  response.cookies.set(MANAGEMENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MANAGEMENT_MAX_AGE_SEC,
    path: "/",
  });
}

export function clearManagementCookie(response: NextResponse) {
  response.cookies.set(MANAGEMENT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function readManagementCookie(request: NextRequest): string | undefined {
  return request.cookies.get(MANAGEMENT_COOKIE)?.value;
}

export async function requireManagementAdmin(request: NextRequest) {
  const admin = await getManagementAdminFromRequest(request);
  if (!admin) {
    return {
      admin: null as ManagementAdmin | null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { admin, response: null as NextResponse | null };
}

export async function getManagementAdminFromRequest(
  request: NextRequest
): Promise<ManagementAdmin | null> {
  const token = readManagementCookie(request);
  if (!token) return null;
  const payload = await verifyManagementToken(token);
  if (!payload) return null;
  return loadConfirmedAdmin(payload.adminId);
}

export async function getManagementAdminFromCookies(): Promise<ManagementAdmin | null> {
  const token = cookies().get(MANAGEMENT_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyManagementToken(token);
  if (!payload) return null;
  return loadConfirmedAdmin(payload.adminId);
}

async function loadConfirmedAdmin(adminId: string): Promise<ManagementAdmin | null> {
  const [row] = await getDb()
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);
  if (!row || !row.totpConfirmedAt) return null;
  return { id: row.id, username: row.username };
}

export function normalizeUsername(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(trimmed)) return null;
  return trimmed;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function recordLoginFailure(username: string): boolean {
  const key = username.toLowerCase();
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= 5;
}

export function isLoginRateLimited(username: string): boolean {
  const current = loginAttempts.get(username.toLowerCase());
  if (!current) return false;
  if (current.resetAt < Date.now()) {
    loginAttempts.delete(username.toLowerCase());
    return false;
  }
  return current.count >= 5;
}

export function clearLoginFailures(username: string) {
  loginAttempts.delete(username.toLowerCase());
}

export async function findInviteByRawToken(raw: string) {
  const tokenHash = hashToken(raw);
  const [invite] = await getDb()
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.tokenHash, tokenHash))
    .limit(1);
  return invite ?? null;
}

export function inviteIsUsable(invite: { expiresAt: Date; usedAt: Date | null }) {
  return !invite.usedAt && invite.expiresAt.getTime() > Date.now();
}

export type { AdminUser };
