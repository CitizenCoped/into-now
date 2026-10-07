import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userBlocks } from "@/lib/schema";

/**
 * All user ids hidden from `userId`: people they blocked, plus people who
 * blocked them. Used to filter posts and map content.
 */
export async function getHiddenUserIds(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));

  const hidden = new Set<string>();
  for (const row of rows) {
    hidden.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }
  return Array.from(hidden);
}

export type BlockRefusal = { error: string; code: "BLOCKED_BY_YOU" | "BLOCKED" };

/**
 * Why `senderId` may not message `otherId`, or null when no block exists.
 * The sender's own block is reported as such ("You blocked this user") so
 * they can undo it; a block by the other side stays deliberately vague.
 */
export async function getBlockRefusal(
  senderId: string,
  otherId: string
): Promise<BlockRefusal | null> {
  const rows = await getDb()
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, senderId), eq(userBlocks.blockedId, otherId)),
        and(eq(userBlocks.blockerId, otherId), eq(userBlocks.blockedId, senderId))
      )
    );
  if (rows.length === 0) return null;
  if (rows.some((row) => row.blockerId === senderId)) {
    return {
      error: "You blocked this user. Unblock them to send messages.",
      code: "BLOCKED_BY_YOU",
    };
  }
  return { error: "You can't message this user", code: "BLOCKED" };
}
