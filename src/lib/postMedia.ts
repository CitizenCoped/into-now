/**
 * Server-side post media helpers — ordered media strips for posts, and the
 * "author's latest live post" lookup the thread reference row uses.
 *
 * Post media is public to every viewer (no reveal gate), unlike DM photos.
 * Objects are still private in Spaces; viewers get presigned URLs with a
 * longer TTL than DM reveals because the posts list is cached client-side
 * between refetches.
 */

import { getDb } from "@/lib/db";
import { POST_TTL_MS } from "@/lib/postConfig";
import type { MediaKind, PostMediaView, PostWithMedia } from "@/lib/photoTypes";
import { type Post, postPhotos, posts, userPhotos } from "@/lib/schema";
import { isSpacesConfigured, presignView } from "@/lib/spaces";
import { and, desc, eq, gt, inArray } from "drizzle-orm";

/** Presigned GET TTL for post media. */
const POST_MEDIA_URL_TTL_SECONDS = 60 * 60;

/** Media for a set of posts, keyed by post id and ordered by position. */
export async function loadPostMedia(postIds: string[]): Promise<Map<string, PostMediaView[]>> {
  const result = new Map<string, PostMediaView[]>();
  if (postIds.length === 0) return result;

  const rows = await getDb()
    .select({
      postId: postPhotos.postId,
      position: postPhotos.position,
      id: userPhotos.id,
      kind: userPhotos.kind,
      blurDataUrl: userPhotos.blurDataUrl,
      aspectRatio: userPhotos.aspectRatio,
      durationMs: userPhotos.durationMs,
      objectKey: userPhotos.objectKey,
      status: userPhotos.status,
    })
    .from(postPhotos)
    .innerJoin(userPhotos, eq(userPhotos.id, postPhotos.photoId))
    .where(inArray(postPhotos.postId, postIds));

  rows.sort((a, b) => a.position - b.position);

  const canSign = isSpacesConfigured();
  for (const row of rows) {
    // A rejected-after-the-fact (admin overturn) item just drops out.
    if (row.status !== "ready" && row.status !== "archived") continue;
    const view: PostMediaView = {
      id: row.id,
      kind: row.kind as MediaKind,
      blurDataUrl: row.blurDataUrl,
      url: canSign ? await presignView(row.objectKey, POST_MEDIA_URL_TTL_SECONDS) : null,
      aspectRatio: row.aspectRatio,
      durationMs: row.durationMs,
    };
    const list = result.get(row.postId) ?? [];
    list.push(view);
    result.set(row.postId, list);
  }

  return result;
}

/** Attach media strips to post rows. */
export async function withMedia(rows: Post[]): Promise<PostWithMedia[]> {
  const mediaByPost = await loadPostMedia(rows.map((p) => p.id));
  return rows.map((post) => ({ ...post, media: mediaByPost.get(post.id) ?? [] }));
}

/** Each author's most recent non-expired post, with media. Authors with no
 *  live post are absent from the map. */
export async function latestPostsByAuthor(
  authorIds: string[]
): Promise<Map<string, PostWithMedia>> {
  const result = new Map<string, PostWithMedia>();
  if (authorIds.length === 0) return result;

  const rows = await getDb()
    .select()
    .from(posts)
    .where(
      and(
        inArray(posts.authorId, authorIds),
        gt(posts.createdAt, new Date(Date.now() - POST_TTL_MS))
      )
    )
    .orderBy(desc(posts.createdAt));

  const latest: Post[] = [];
  for (const row of rows) {
    if (row.authorId && !result.has(row.authorId)) {
      result.set(row.authorId, { ...row, media: [] });
      latest.push(row);
    }
  }

  const mediaByPost = await loadPostMedia(latest.map((p) => p.id));
  result.forEach((post, authorId) => {
    result.set(authorId, { ...post, media: mediaByPost.get(post.id) ?? [] });
  });

  return result;
}
