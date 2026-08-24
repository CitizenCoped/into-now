/**
 * Server-side photo messaging helpers — reveal model + per-viewer
 * serialization of message photo attachments.
 *
 * Privacy contract: object keys and non-presigned URLs never leave the
 * server. A viewer gets a presigned URL only when authorized (they are the
 * sender, or hold a reveal grant) AND the photo is not hidden by its sender.
 */

import { getDb } from "@/lib/db";
import type { MessagePhotoView } from "@/lib/photoTypes";
import { messagePhotos, photoReveals, userPhotos } from "@/lib/schema";
import { isSpacesConfigured, presignView } from "@/lib/spaces";
import { and, eq, inArray } from "drizzle-orm";

/** Reveal model flag — tap | grant | immediate. v3 ships `tap` (decided);
 *  the flag stays for flexibility. `immediate` skips the grant check when
 *  issuing URLs; `grant` (sender-approves) is reserved and currently
 *  behaves like `tap`. */
export type RevealModel = "tap" | "grant" | "immediate";

export function getRevealModel(): RevealModel {
  const raw = process.env.PHOTO_REVEAL_MODEL;
  return raw === "grant" || raw === "immediate" ? raw : "tap";
}

/**
 * Load photo attachments for a set of messages, serialized for one viewer.
 * Returns a map of messageId → ordered MessagePhotoView[].
 */
export async function loadMessagePhotos(
  messageRows: { id: string; senderId: string }[],
  viewerId: string
): Promise<Map<string, MessagePhotoView[]>> {
  const result = new Map<string, MessagePhotoView[]>();
  if (messageRows.length === 0) return result;

  const db = getDb();
  const messageIds = messageRows.map((m) => m.id);
  const senderByMessage = new Map(messageRows.map((m) => [m.id, m.senderId]));

  const attachments = await db
    .select({
      messageId: messagePhotos.messageId,
      photoId: messagePhotos.photoId,
      position: messagePhotos.position,
      hiddenBySender: messagePhotos.hiddenBySender,
      blurDataUrl: userPhotos.blurDataUrl,
      aspectRatio: userPhotos.aspectRatio,
      isLive: userPhotos.isLive,
      objectKey: userPhotos.objectKey,
    })
    .from(messagePhotos)
    .innerJoin(userPhotos, eq(userPhotos.id, messagePhotos.photoId))
    .where(inArray(messagePhotos.messageId, messageIds));

  if (attachments.length === 0) return result;

  const grants = await db
    .select({
      messageId: photoReveals.messageId,
      photoId: photoReveals.photoId,
    })
    .from(photoReveals)
    .where(
      and(
        inArray(photoReveals.messageId, messageIds),
        eq(photoReveals.viewerId, viewerId)
      )
    );

  const grantSet = new Set(grants.map((g) => `${g.messageId}:${g.photoId}`));
  const immediate = getRevealModel() === "immediate";

  for (const row of attachments) {
    const isSender = senderByMessage.get(row.messageId) === viewerId;
    const revealed =
      isSender || immediate || grantSet.has(`${row.messageId}:${row.photoId}`);

    // Server-authoritative: no presigned URL while hidden — for anyone.
    const authorized = revealed && !row.hiddenBySender;
    const url =
      authorized && isSpacesConfigured() ? await presignView(row.objectKey) : null;

    const view: MessagePhotoView = {
      photoId: row.photoId,
      position: row.position,
      blurDataUrl: row.blurDataUrl,
      aspectRatio: row.aspectRatio,
      isLive: row.isLive,
      hiddenBySender: row.hiddenBySender,
      revealed,
      url,
    };

    const list = result.get(row.messageId) ?? [];
    list.push(view);
    result.set(row.messageId, list);
  }

  result.forEach((list) => {
    list.sort((a, b) => a.position - b.position);
  });

  return result;
}

/** Photo payload for Pusher message events — blur placeholder only, never
 *  object keys or URLs (the channel is shared by both participants). */
export function pusherPhotoPayload(photos: MessagePhotoView[]) {
  return photos.map((p) => ({
    photoId: p.photoId,
    position: p.position,
    blurDataUrl: p.blurDataUrl,
    aspectRatio: p.aspectRatio,
    isLive: p.isLive,
    hiddenBySender: p.hiddenBySender,
    revealed: false,
    url: null,
  }));
}
