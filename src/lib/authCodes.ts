import { createHash, randomInt } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authCodes } from "@/lib/schema";

const CODE_TTL_MS = 10 * 60 * 1000;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function storeAuthCode(channel: "email", destination: string, code: string) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.delete(authCodes).where(
    and(eq(authCodes.channel, channel), eq(authCodes.destination, destination))
  );

  await db.insert(authCodes).values({
    channel,
    destination,
    codeHash: hashCode(code),
    expiresAt,
  });
}

export async function verifyAuthCode(
  channel: "email",
  destination: string,
  code: string
): Promise<boolean> {
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .select()
    .from(authCodes)
    .where(
      and(
        eq(authCodes.channel, channel),
        eq(authCodes.destination, destination),
        gt(authCodes.expiresAt, now)
      )
    )
    .limit(1);

  if (!row) return false;
  if (row.codeHash !== hashCode(code)) return false;

  await db.delete(authCodes).where(eq(authCodes.id, row.id));
  return true;
}