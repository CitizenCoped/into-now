/**
 * Shared photo messaging types — safe to import from client components
 * (no server-only dependencies).
 */

import type { Message, Post } from "./schema";

/** Library limits (enforced server-side, mirrored in the UI). */
export const MAX_LIBRARY_PHOTOS = 10;
export const MAX_PHOTOS_PER_MESSAGE = 5;
/** Server-side safety net only. Clients always normalize to a ≤4MB JPEG
 *  before upload (src/lib/imageNormalize.ts), so a real upload never gets
 *  near this; it exists to bound what a PUT can accept. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Post media limits (enforced in POST /api/posts, mirrored in the UI).
 *  Videos count against MAX_POST_MEDIA: 4 photos, or 2 photos + 2 videos. */
export const MAX_POST_MEDIA = 4;
export const MAX_POST_VIDEOS = 2;
export const MAX_POST_VIDEO_SECONDS = 10;
/** A 10s phone clip is ~5–25MB; videos are uploaded as-is (no transcode). */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export type MediaKind = "photo" | "video";
/** `library` = DM "My photos" sheet; `post` = attached to a post. */
export type MediaPurpose = "library" | "post";

/** Statuses that occupy a gallery slot. `archived` photos stay in chats
 *  but no longer count toward the 10-photo cap. */
export const LIBRARY_SLOT_STATUSES = ["scanning", "ready"] as const;

/** Client state of a library photo. */
export type LibraryPhoto = {
  id: string;
  blurDataUrl: string;
  aspectRatio: number;
  isLive: boolean;
  status: "scanning" | "ready" | "rejected";
};

/** A photo as seen inside a message, per viewer.
 *  `url` is a short-lived presigned GET URL — present ONLY when this viewer
 *  is authorized (sender, or a granted reveal) and the photo isn't hidden.
 *  Unrevealed viewers get nothing but the blur placeholder. */
export type MessagePhotoView = {
  photoId: string;
  position: number;
  blurDataUrl: string;
  aspectRatio: number;
  isLive: boolean;
  hiddenBySender: boolean;
  revealed: boolean;
  url?: string | null;
};

/** A message plus its (possibly empty) photo attachments. */
export type MessageView = Message & { photos: MessagePhotoView[] };

/** Post media is public to every viewer (no reveal gate), so `url` is
 *  always present when storage is configured — still presigned, so the
 *  object itself stays private. */
export type PostMediaView = {
  id: string;
  kind: MediaKind;
  blurDataUrl: string;
  url: string | null;
  aspectRatio: number;
  durationMs: number | null;
};

/** A post as clients see it — admin hide fields are stripped server-side
 *  (src/lib/postMedia.ts withMedia) so takedown reasons never leak. */
export type PublicPost = Omit<Post, "hiddenAt" | "hiddenBy" | "hiddenReason">;

/** A post plus its ordered media strip. */
export type PostWithMedia = PublicPost & { media: PostMediaView[] };

/** Pusher event payload when a sender toggles the closed-eye state. */
export type PhotoUpdatedPayload = {
  conversationId: string;
  messageId: string;
  photoId: string;
  hiddenBySender: boolean;
};
