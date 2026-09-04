/**
 * Shared photo messaging types — safe to import from client components
 * (no server-only dependencies).
 */

import type { Message } from "./schema";

/** Library limits (enforced server-side, mirrored in the UI). */
export const MAX_LIBRARY_PHOTOS = 10;
export const MAX_PHOTOS_PER_MESSAGE = 5;
/** Server-side safety net only. Clients always normalize to a ≤4MB JPEG
 *  before upload (src/lib/imageNormalize.ts), so a real upload never gets
 *  near this; it exists to bound what a presigned PUT can accept. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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

/** Pusher event payload when a sender toggles the closed-eye state. */
export type PhotoUpdatedPayload = {
  conversationId: string;
  messageId: string;
  photoId: string;
  hiddenBySender: boolean;
};
