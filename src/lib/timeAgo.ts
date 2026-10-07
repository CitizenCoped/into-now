/** Compact relative time for post/thread metadata: "just now", "26 min
 *  ago", "3 hr ago". Posts live 24h so days never show. */
export function timeAgo(iso: string | Date, now: number = Date.now()): string {
  const then = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

/** "expires in 23h" / "expires in 40m" for a post's remaining TTL. */
export function expiresIn(createdAt: string | Date, ttlMs: number, now: number = Date.now()): string {
  const created = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  const remaining = Math.max(0, created + ttlMs - now);
  const minutes = Math.round(remaining / 60_000);
  if (minutes < 60) return `expires in ${Math.max(1, minutes)}m`;
  return `expires in ${Math.round(minutes / 60)}h`;
}
