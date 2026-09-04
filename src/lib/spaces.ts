/**
 * DigitalOcean Spaces storage for the photo messaging feature.
 *
 * Spaces is S3-compatible; we reuse the existing `thebestdrug` Space (sfo3)
 * that already hosts the landing video — `intonow-photos/` is a key prefix
 * inside it, not its own bucket.
 *
 * Privacy model: photo objects are uploaded with the private ACL (the S3
 * default — the presigned PUT must NOT set x-amz-acl: public-read), so the
 * public CDN endpoint returns 403 for them. Photos are served ONLY via
 * short-lived presigned GET URLs minted per authorized viewer. Never store
 * a public URL in the DB; store the object key.
 *
 * Env (Vercel project settings + .env.local):
 *   DO_SPACES_REGION=sfo3
 *   DO_SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com
 *   DO_SPACES_BUCKET=thebestdrug
 *   DO_SPACES_PREFIX=intonow-photos
 *   DO_SPACES_KEY / DO_SPACES_SECRET  (same pair used for video uploads)
 */

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Presigned GET TTL. Short on purpose — this is what enforces the blur
 *  privacy model server-side. */
const VIEW_URL_TTL_SECONDS = 60;

/** Presigned PUT TTL — enough for a slow mobile upload of a normalized
 *  (≤4MB) photo. Rows still `scanning` well past this are swept as
 *  abandoned by POST /api/photos. */
const UPLOAD_URL_TTL_SECONDS = 300;

let client: S3Client | null = null;

export function isSpacesConfigured(): boolean {
  return Boolean(process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET);
}

function getClient(): S3Client {
  if (client) return client;

  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;
  if (!key || !secret) {
    throw new Error("DO_SPACES_KEY / DO_SPACES_SECRET are not set");
  }

  client = new S3Client({
    region: process.env.DO_SPACES_REGION ?? "sfo3",
    // Regional endpoint — no bucket name; the SDK prepends it.
    endpoint: process.env.DO_SPACES_ENDPOINT ?? "https://sfo3.digitaloceanspaces.com",
    credentials: { accessKeyId: key, secretAccessKey: secret },
  });
  return client;
}

function getBucket(): string {
  return process.env.DO_SPACES_BUCKET ?? "thebestdrug";
}

function getPrefix(): string {
  return process.env.DO_SPACES_PREFIX ?? "intonow-photos";
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_PHOTO_CONTENT_TYPES = Object.keys(EXT_BY_CONTENT_TYPE);

/** Key scheme: intonow-photos/photos/{userId}/{photoId}.{ext} */
export function photoObjectKey(userId: string, photoId: string, contentType: string): string {
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? "jpg";
  return `${getPrefix()}/photos/${userId}/${photoId}.${ext}`;
}

/** Presigned PUT the client uploads directly to. Private ACL (S3 default —
 *  no x-amz-acl header is signed, so the object stays unreadable via CDN).
 *
 *  What the signature actually enforces (verified against the SDK):
 *  - `Content-Length` IS signed, as an exact match — not a range. Callers
 *    must pass the byte length of the exact Blob the client will PUT; any
 *    other body gets a 403 from Spaces.
 *  - `Content-Type` is NOT signed (the presigner marks it unsignable). It
 *    only shapes the stored object's metadata via the client's own header.
 *  That's why the client normalizes first and declares `blob.size`. */
export async function presignUpload(
  key: string,
  contentType: string,
  exactBytes: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: exactBytes,
  });
  return getSignedUrl(getClient(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/** Presigned GET, 60s TTL — minted per authorized viewer, per request. */
export async function presignView(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

/** Permanently remove an object (library delete, moderation reject). */
export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
