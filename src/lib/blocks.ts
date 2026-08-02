import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userBlocks } from "@/lib/schema";

/** True if either user has blocked the other (mutual invisibility). */
export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, userA), eq(userBlocks.blockedId, userB)),
        and(eq(userBlocks.blockerId, userB), eq(userBlocks.blockedId, userA))
      )
    )
    .limit(1);
  return Boolean(row);
}

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
