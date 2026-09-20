import { getDb } from "@/lib/db";
import {
  encryptSecret,
  findInviteByRawToken,
  generateTotpSecret,
  hashPassword,
  inviteIsUsable,
  normalizeUsername,
  totpUri,
} from "@/lib/managementAuth";
import { adminInvites, adminUsers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(8),
  username: z.string(),
  password: z.string().min(10),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Username, password (10+ characters), and invite token are required" },
      { status: 400 }
    );
  }

  const username = normalizeUsername(parsed.data.username);
  if (!username) {
    return NextResponse.json(
      { error: "Username must be 3–32 characters: letters, numbers, underscore" },
      { status: 400 }
    );
  }

  const invite = await findInviteByRawToken(parsed.data.token);
  if (!invite || !inviteIsUsable(invite)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const [taken] = await db
    .select({ id: adminUsers.id, totpConfirmedAt: adminUsers.totpConfirmedAt })
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1);

  if (taken?.totpConfirmedAt) {
    return NextResponse.json({ error: "Username is taken" }, { status: 409 });
  }

  const secret = generateTotpSecret();
  const passwordHash = await hashPassword(parsed.data.password);
  const totpSecretEncrypted = encryptSecret(secret);

  let adminId = taken?.id ?? invite.pendingAdminId ?? null;
  if (adminId) {
    await db
      .update(adminUsers)
      .set({ username, passwordHash, totpSecretEncrypted, totpConfirmedAt: null })
      .where(eq(adminUsers.id, adminId));
  } else {
    const [created] = await db
      .insert(adminUsers)
      .values({ username, passwordHash, totpSecretEncrypted })
      .returning({ id: adminUsers.id });
    adminId = created.id;
  }

  await db
    .update(adminInvites)
    .set({ pendingAdminId: adminId })
    .where(eq(adminInvites.id, invite.id));

  const otpauth = totpUri(username, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, {
    margin: 1,
    width: 240,
    color: { dark: "#07060B", light: "#ffffff" },
  });

  return NextResponse.json({ otpauth, qrDataUrl, username });
}
