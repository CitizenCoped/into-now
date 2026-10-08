/**
 * Server-side admin controls over media in the public Posts section.
 *
 * Mirrors photoReview.ts: every action returns `{ ok, card }` or
 * `{ ok: false, error, status }`, logs an `admin.*` activity row, and
 * never hands out object keys — only 10-minute presigned URLs.
 *
 * Takedowns live on `user_photos.admin_hidden_*` (not post_photos) so the
 * item can't be re-attached to a new post and the mark survives the 24h
 * post-expiry cascade. Hiding a whole post lives on `posts.hidden_*`.
 */

import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import type { AdminMark, PostMediaCard, PostMediaState, RescanDecision } from "@/lib/managementTypes";
import { ModerationUnavailableError, scanImageUrl, scanVideoUrl } from "@/lib/moderation";
import { surfaceForPurpose } from "@/lib/moderationCatalog";
import { contactFor } from "@/lib/photoReview";
import type { MediaKind, MediaPurpose } from "@/lib/photoTypes";
import { POST_TTL_MS } from "@/lib/postConfig";
import { adminUsers, postPhotos, posts, userPhotos, users } from "@/lib/schema";
import { isSpacesConfigured, presignView } from "@/lib/spaces";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";

const VIEW_URL_TTL_SECONDS = 10 * 60;

export type PostMediaListFilter = {
  state: PostMediaState | "all";
  kind?: MediaKind;
  includeExpired: boolean;
  /** Cursor: only items created before this instant. */
  before?: Date;
  limit: number;
};

type Result =
  | { ok: true; card: PostMediaCard }
  | { ok: false; error: string; status: number };

type PostResult =
  | { ok: true; post: NonNullable<PostMediaCard["post"]> }
  | { ok: false; error: string; status: number };

// ---------------------------------------------------------------------------
// Row → card
// ---------------------------------------------------------------------------

type JoinedRow = {
  media: typeof userPhotos.$inferSelect;
  link: { postId: string; position: number } | null;
  post: typeof posts.$inferSelect | null;
};

function postExpiryCutoff(): Date {
  return new Date(Date.now() - POST_TTL_MS);
}

function stateFor(row: JoinedRow, cutoff: Date): PostMediaState {
  if (row.media.reviewStatus === "pending") return "held";
  if (row.media.adminHiddenAt || row.post?.hiddenAt) return "hidden";
  if (row.post && row.post.createdAt > cutoff && row.media.status === "ready") return "live";
  return "expired";
}

async function usernamesFor(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (unique.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: adminUsers.id, username: adminUsers.username })
    .from(adminUsers)
    .where(inArray(adminUsers.id, unique));
  return new Map(rows.map((r) => [r.id, r.username]));
}

function mark(
  at: Date | null,
  by: string | null,
  reason: string | null,
  usernames: Map<string, string>
): AdminMark | null {
  if (!at) return null;
  return { at: at.toISOString(), byUsername: by ? (usernames.get(by) ?? null) : null, reason };
}

async function buildCards(rows: JoinedRow[]): Promise<PostMediaCard[]> {
  if (rows.length === 0) return [];
  const cutoff = postExpiryCutoff();
  const canSign = isSpacesConfigured();

  const ownerIds = Array.from(new Set(rows.map((r) => r.media.userId)));
  const owners = await getDb()
    .select({
      id: users.id,
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      isAnonymous: users.isAnonymous,
    })
    .from(users)
    .where(inArray(users.id, ownerIds));
  const contactById = new Map(owners.map((o) => [o.id, contactFor(o)]));

  const usernames = await usernamesFor(
    rows.flatMap((r) => [r.media.adminHiddenBy, r.post?.hiddenBy])
  );

  return Promise.all(
    rows.map(async (row): Promise<PostMediaCard> => {
      const m = row.media;
      let imageUrl: string | null = null;
      if (canSign && m.objectKey && m.status !== "rejected") {
        try {
          imageUrl = await presignView(m.objectKey, VIEW_URL_TTL_SECONDS);
        } catch {
          imageUrl = null;
        }
      }
      return {
        id: m.id,
        userId: m.userId,
        userContact: contactById.get(m.userId) ?? "unknown",
        status: m.status,
        reviewStatus: (m.reviewStatus as PostMediaCard["reviewStatus"]) ?? null,
        scores: m.moderationScores,
        raw: m.moderationRaw,
        isLive: m.isLive,
        aspectRatio: m.aspectRatio,
        blurDataUrl: m.blurDataUrl,
        createdAt: m.createdAt.toISOString(),
        objectPurgeAt: m.objectPurgeAt?.toISOString() ?? null,
        reviewedAt: m.reviewedAt?.toISOString() ?? null,
        imageUrl,
        kind: m.kind as MediaKind,
        purpose: m.purpose as MediaPurpose,
        surface: surfaceForPurpose(m.purpose),
        durationMs: m.durationMs,
        postId: row.link?.postId ?? null,
        adminHiddenAt: m.adminHiddenAt?.toISOString() ?? null,
        rescannedAt: m.rescannedAt?.toISOString() ?? null,
        state: stateFor(row, cutoff),
        adminHidden: mark(m.adminHiddenAt, m.adminHiddenBy, m.adminHiddenReason, usernames),
        post:
          row.post && row.link
            ? {
                id: row.post.id,
                title: row.post.title,
                code: row.post.category,
                createdAt: row.post.createdAt.toISOString(),
                expiresAt: new Date(row.post.createdAt.getTime() + POST_TTL_MS).toISOString(),
                expired: row.post.createdAt <= cutoff,
                position: row.link.position,
                authorId: row.post.authorId,
                hidden: mark(row.post.hiddenAt, row.post.hiddenBy, row.post.hiddenReason, usernames),
              }
            : null,
      };
    })
  );
}

function baseQuery() {
  return getDb()
    .select({
      media: userPhotos,
      link: { postId: postPhotos.postId, position: postPhotos.position },
      post: posts,
    })
    .from(userPhotos)
    .leftJoin(postPhotos, eq(postPhotos.photoId, userPhotos.id))
    .leftJoin(posts, eq(posts.id, postPhotos.postId));
}

function asJoined(row: { media: JoinedRow["media"]; link: { postId: string | null; position: number | null } | null; post: JoinedRow["post"] }): JoinedRow {
  return {
    media: row.media,
    link: row.link?.postId != null && row.link.position != null
      ? { postId: row.link.postId, position: row.link.position }
      : null,
    post: row.post,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listPostMedia(
  filter: PostMediaListFilter
): Promise<{ items: PostMediaCard[]; nextCursor: string | null }> {
  const cutoff = postExpiryCutoff();
  const conditions: SQL[] = [eq(userPhotos.purpose, "post")];

  if (filter.kind) conditions.push(eq(userPhotos.kind, filter.kind));
  if (filter.before) conditions.push(lt(userPhotos.createdAt, filter.before));

  const attachedAndFresh = and(isNotNull(posts.id), gt(posts.createdAt, cutoff));

  switch (filter.state) {
    case "live":
      conditions.push(
        eq(userPhotos.status, "ready"),
        isNull(userPhotos.adminHiddenAt),
        isNull(posts.hiddenAt),
        attachedAndFresh!
      );
      break;
    case "hidden":
      conditions.push(or(isNotNull(userPhotos.adminHiddenAt), isNotNull(posts.hiddenAt))!);
      if (!filter.includeExpired) conditions.push(or(isNull(posts.id), gt(posts.createdAt, cutoff))!);
      break;
    case "held":
      conditions.push(eq(userPhotos.reviewStatus, "pending"));
      break;
    case "all":
      if (!filter.includeExpired) conditions.push(or(isNull(posts.id), gt(posts.createdAt, cutoff))!);
      break;
    case "expired":
      conditions.push(or(isNull(posts.id), lt(posts.createdAt, cutoff))!);
      break;
  }

  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(desc(userPhotos.createdAt))
    .limit(filter.limit + 1);

  const page = rows.slice(0, filter.limit).map(asJoined);
  const nextCursor =
    rows.length > filter.limit ? page[page.length - 1].media.createdAt.toISOString() : null;

  return { items: await buildCards(page), nextCursor };
}

async function loadJoined(photoId: string): Promise<JoinedRow | null> {
  const [row] = await baseQuery().where(eq(userPhotos.id, photoId)).limit(1);
  if (!row || row.media.purpose !== "post") return null;
  return asJoined(row);
}

export async function getPostMediaCard(photoId: string): Promise<PostMediaCard | null> {
  const row = await loadJoined(photoId);
  if (!row) return null;
  const [card] = await buildCards([row]);
  return card ?? null;
}

export async function postMediaCounts(): Promise<{
  liveMedia: number;
  hiddenMedia: number;
  hiddenPosts: number;
}> {
  const db = getDb();
  const cutoff = postExpiryCutoff();
  const [live] = await db
    .select({ n: count() })
    .from(postPhotos)
    .innerJoin(userPhotos, eq(userPhotos.id, postPhotos.photoId))
    .innerJoin(posts, eq(posts.id, postPhotos.postId))
    .where(
      and(
        eq(userPhotos.status, "ready"),
        isNull(userPhotos.adminHiddenAt),
        isNull(posts.hiddenAt),
        gt(posts.createdAt, cutoff)
      )
    );
  const [hidden] = await db
    .select({ n: count() })
    .from(userPhotos)
    .where(and(eq(userPhotos.purpose, "post"), isNotNull(userPhotos.adminHiddenAt)));
  const [hiddenPosts] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(isNotNull(posts.hiddenAt), gt(posts.createdAt, cutoff)));
  return {
    liveMedia: Number(live?.n ?? 0),
    hiddenMedia: Number(hidden?.n ?? 0),
    hiddenPosts: Number(hiddenPosts?.n ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function adminUsername(adminId: string): Promise<string | null> {
  const [admin] = await getDb()
    .select({ username: adminUsers.username })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);
  return admin?.username ?? null;
}

async function cardResult(photoId: string): Promise<Result> {
  const card = await getPostMediaCard(photoId);
  return card ? { ok: true, card } : { ok: false, error: "Not found", status: 404 };
}

export async function takeDownPostMedia(
  photoId: string,
  adminId: string,
  reason: string | null
): Promise<Result> {
  const row = await loadJoined(photoId);
  if (!row) return { ok: false, error: "Not found", status: 404 };
  if (row.media.adminHiddenAt) {
    return { ok: false, error: "Already taken down", status: 409 };
  }

  await getDb()
    .update(userPhotos)
    .set({ adminHiddenAt: new Date(), adminHiddenBy: adminId, adminHiddenReason: reason })
    .where(eq(userPhotos.id, photoId));

  logActivity("admin.post_media_taken_down", {
    metadata: {
      photoId,
      postId: row.link?.postId ?? null,
      userId: row.media.userId,
      kind: row.media.kind,
      reason,
      adminId,
      adminUsername: await adminUsername(adminId),
    },
  });

  return cardResult(photoId);
}

export async function restorePostMedia(photoId: string, adminId: string): Promise<Result> {
  const row = await loadJoined(photoId);
  if (!row) return { ok: false, error: "Not found", status: 404 };
  if (!row.media.adminHiddenAt) {
    return { ok: false, error: "Not taken down", status: 409 };
  }

  await getDb()
    .update(userPhotos)
    .set({ adminHiddenAt: null, adminHiddenBy: null, adminHiddenReason: null })
    .where(eq(userPhotos.id, photoId));

  logActivity("admin.post_media_restored", {
    metadata: {
      photoId,
      postId: row.link?.postId ?? null,
      userId: row.media.userId,
      kind: row.media.kind,
      adminId,
      adminUsername: await adminUsername(adminId),
    },
  });

  return cardResult(photoId);
}

/** Re-run Sightengine against the current Posts profile. Overwrites the
 *  stored scores and stamps `rescannedAt`; never changes visibility — the
 *  admin decides from the returned decision. */
export async function rescanPostMedia(
  photoId: string,
  adminId: string
): Promise<Result & { decision?: RescanDecision }> {
  const row = await loadJoined(photoId);
  if (!row) return { ok: false, error: "Not found", status: 404 };
  if (!row.media.objectKey || (row.media.status === "rejected" && row.media.reviewStatus === "upheld")) {
    return { ok: false, error: "Media is no longer stored", status: 409 };
  }
  if (!isSpacesConfigured()) {
    return { ok: false, error: "Photo storage is not configured", status: 503 };
  }

  let result;
  try {
    const url = await presignView(row.media.objectKey, VIEW_URL_TTL_SECONDS);
    result =
      row.media.kind === "video"
        ? await scanVideoUrl(url, { surface: "posts" })
        : await scanImageUrl(url, { surface: "posts" });
  } catch (error) {
    if (error instanceof ModerationUnavailableError) {
      return {
        ok: false,
        error:
          row.media.kind === "video"
            ? "Video screening isn't available on the current moderation plan."
            : "Photo screening isn't available right now.",
        status: 503,
      };
    }
    console.error("post media rescan failed:", error);
    return { ok: false, error: "Sightengine scan failed", status: 502 };
  }

  await getDb()
    .update(userPhotos)
    .set({
      moderationScores: result.scores,
      moderationRaw: result.raw,
      rescannedAt: new Date(),
    })
    .where(eq(userPhotos.id, photoId));

  const decision: RescanDecision = {
    wouldReject: !result.ok,
    skipped: result.skipped,
    topClass: result.topClass,
    topScore: result.topScore,
    triggered: result.triggered,
  };

  logActivity("admin.post_media_rescanned", {
    metadata: {
      photoId,
      postId: row.link?.postId ?? null,
      kind: row.media.kind,
      wouldReject: decision.wouldReject,
      topClass: decision.topClass,
      topScore: decision.topScore,
      adminId,
      adminUsername: await adminUsername(adminId),
    },
  });

  const card = await cardResult(photoId);
  return card.ok ? { ...card, decision } : card;
}

async function postSummary(postId: string): Promise<NonNullable<PostMediaCard["post"]> | null> {
  const [post] = await getDb().select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return null;
  const usernames = await usernamesFor([post.hiddenBy]);
  const cutoff = postExpiryCutoff();
  return {
    id: post.id,
    title: post.title,
    code: post.category,
    createdAt: post.createdAt.toISOString(),
    expiresAt: new Date(post.createdAt.getTime() + POST_TTL_MS).toISOString(),
    expired: post.createdAt <= cutoff,
    position: 0,
    authorId: post.authorId,
    hidden: mark(post.hiddenAt, post.hiddenBy, post.hiddenReason, usernames),
  };
}

export async function hidePost(
  postId: string,
  adminId: string,
  reason: string | null
): Promise<PostResult> {
  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { ok: false, error: "Not found", status: 404 };
  if (post.hiddenAt) return { ok: false, error: "Already hidden", status: 409 };

  await db
    .update(posts)
    .set({ hiddenAt: new Date(), hiddenBy: adminId, hiddenReason: reason })
    .where(eq(posts.id, postId));

  logActivity("admin.post_hidden", {
    metadata: {
      postId,
      authorId: post.authorId,
      title: post.title,
      code: post.category,
      reason,
      adminId,
      adminUsername: await adminUsername(adminId),
    },
  });

  const summary = await postSummary(postId);
  return summary ? { ok: true, post: summary } : { ok: false, error: "Not found", status: 404 };
}

export async function unhidePost(postId: string, adminId: string): Promise<PostResult> {
  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { ok: false, error: "Not found", status: 404 };
  if (!post.hiddenAt) return { ok: false, error: "Not hidden", status: 409 };

  await db
    .update(posts)
    .set({ hiddenAt: null, hiddenBy: null, hiddenReason: null })
    .where(eq(posts.id, postId));

  logActivity("admin.post_unhidden", {
    metadata: {
      postId,
      authorId: post.authorId,
      title: post.title,
      code: post.category,
      adminId,
      adminUsername: await adminUsername(adminId),
    },
  });

  const summary = await postSummary(postId);
  return summary ? { ok: true, post: summary } : { ok: false, error: "Not found", status: 404 };
}
