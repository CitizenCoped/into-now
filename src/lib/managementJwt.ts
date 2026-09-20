import { SignJWT, jwtVerify } from "jose";

export const MANAGEMENT_COOKIE = "tbd_management";
export const MANAGEMENT_MAX_AGE_SEC = 60 * 60 * 24;
export const PENDING_LOGIN_TTL_SEC = 5 * 60;

export type ManagementJwt = {
  adminId: string;
  username: string;
};

function getAuthSecretBytes() {
  const secret = process.env.MANAGEMENT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createManagementToken(
  payload: ManagementJwt,
  maxAgeSec: number = MANAGEMENT_MAX_AGE_SEC
) {
  return new SignJWT({ adminId: payload.adminId, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("management")
    .setExpirationTime(`${maxAgeSec}s`)
    .setIssuedAt()
    .sign(getAuthSecretBytes());
}

export async function createPendingLoginToken(adminId: string, username: string) {
  return new SignJWT({ adminId, username, stage: "totp" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("management-pending")
    .setExpirationTime(`${PENDING_LOGIN_TTL_SEC}s`)
    .setIssuedAt()
    .sign(getAuthSecretBytes());
}

export async function verifyManagementToken(token: string): Promise<ManagementJwt | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretBytes());
    if (payload.sub !== "management") return null;
    if (typeof payload.adminId !== "string" || typeof payload.username !== "string") {
      return null;
    }
    return { adminId: payload.adminId, username: payload.username };
  } catch {
    return null;
  }
}

export async function verifyPendingLoginToken(
  token: string
): Promise<(ManagementJwt & { stage: "totp" }) | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretBytes());
    if (payload.sub !== "management-pending" || payload.stage !== "totp") return null;
    if (typeof payload.adminId !== "string" || typeof payload.username !== "string") {
      return null;
    }
    return { adminId: payload.adminId, username: payload.username, stage: "totp" };
  } catch {
    return null;
  }
}
