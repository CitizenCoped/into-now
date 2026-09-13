import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import {
  createManagementToken,
  decryptSecret,
  findInviteByRawToken,
  inviteIsUsable,
  setManagementCookie,
  verifyTotp,
} from "@/lib/managementAuth";
import { adminInvites, adminUsers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(8),
  totp: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const invite = await findInviteByRawToken(parsed.data.token);
  if (!invite || !inviteIsUsable(invite) || !invite.pendingAdminId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, invite.pendingAdminId))
    .limit(1);
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let secret: string;
  try {
    secret = decryptSecret(admin.totpSecretEncrypted);
  } catch {
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }

  if (!verifyTotp(secret, parsed.data.totp)) {
    return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
  }

  const now = new Date();
  await db
    .update(adminUsers)
    .set({ totpConfirmedAt: now, lastLoginAt: now })
    .where(eq(adminUsers.id, admin.id));
  await db
    .update(adminInvites)
    .set({ usedAt: now })
    .where(eq(adminInvites.id, invite.id));

  const session = await createManagementToken({
    adminId: admin.id,
    username: admin.username,
  });
  const res = NextResponse.json({ ok: true, admin: { id: admin.id, username: admin.username } });
  setManagementCookie(res, session);
  logActivity("admin.signup", { metadata: { adminId: admin.id, username: admin.username } });
  return res;
}
