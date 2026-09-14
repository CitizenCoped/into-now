import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import {
  clearLoginFailures,
  createManagementToken,
  createPendingLoginToken,
  decryptSecret,
  isLoginRateLimited,
  normalizeUsername,
  recordLoginFailure,
  setManagementCookie,
  verifyPassword,
  verifyPendingLoginToken,
  verifyTotp,
} from "@/lib/managementAuth";
import { adminUsers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const startSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const finishSchema = z.object({
  pendingToken: z.string(),
  totp: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (body && typeof body === "object" && "pendingToken" in body) {
    const parsed = finishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const pending = await verifyPendingLoginToken(parsed.data.pendingToken);
    if (!pending) {
      return NextResponse.json({ error: "Login expired, try again" }, { status: 401 });
    }
    if (isLoginRateLimited(pending.username)) {
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const [admin] = await getDb()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, pending.adminId))
      .limit(1);
    if (!admin?.totpConfirmedAt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let secret: string;
    try {
      secret = decryptSecret(admin.totpSecretEncrypted);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyTotp(secret, parsed.data.totp)) {
      recordLoginFailure(pending.username);
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    }

    clearLoginFailures(pending.username);
    await getDb()
      .update(adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsers.id, admin.id));

    const token = await createManagementToken({
      adminId: admin.id,
      username: admin.username,
    });
    const res = NextResponse.json({ ok: true, admin: { id: admin.id, username: admin.username } });
    setManagementCookie(res, token);
    logActivity("admin.login", { metadata: { adminId: admin.id, username: admin.username } });
    return res;
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  if (!username) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (isLoginRateLimited(username)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  let admin;
  try {
    [admin] = await getDb()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("admin_users") || message.includes("does not exist")) {
      console.error("management login: admin_users table missing — run db:migrate on this database");
      return NextResponse.json(
        { error: "Admin database is not initialized. Run the latest migration, then use a setup invite." },
        { status: 503 }
      );
    }
    throw error;
  }

  if (!admin?.totpConfirmedAt || !(await verifyPassword(parsed.data.password, admin.passwordHash))) {
    recordLoginFailure(username);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const pendingToken = await createPendingLoginToken(admin.id, admin.username);
  return NextResponse.json({ challenge: "totp", pendingToken });
}
