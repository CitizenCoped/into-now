import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import type { ReviewCard, ReviewStatus } from "@/lib/managementTypes";
import { decide, type ModerationSettingsMap } from "@/lib/moderationCatalog";
import { MAX_LIBRARY_PHOTOS } from "@/lib/photoTypes";
import { adminUsers, userPhotos, users } from "@/lib/schema";
import { deleteObject, isSpacesConfigured, presignView } from "@/lib/spaces";
import { and, count, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

export type { ReviewCard, ReviewStatus };

function contactFor(user: {
  phone: string | null;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}): string {
  if (user.phone) return user.phone;
  if (user.email) return user.email;
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.isAnonymous) return "Anonymous";
  return user.phone ?? user.email ?? "unknown";
}

export async function serializeReviewCard(photo: typeof userPhotos.$inferSelect): Promise<ReviewCard> {
  const [owner] = await getDb()
    .select({
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      isAnonymous: users.isAnonymous,
    })
    .from(users)
    .where(eq(users.id, photo.userId))
    .limit(1);

  let imageUrl: string | null = null;
  const canView =
    photo.reviewStatus === "pending" ||
    photo.reviewStatus === "overturned" ||
    photo.status === "ready";
  if (canView && isSpacesConfigured() && photo.objectKey) {
    try {
      imageUrl = await presignView(photo.objectKey, 10 * 60);
    } catch {
      imageUrl = null;
    }
  }

  return {
    id: photo.id,
    userId: photo.userId,
    userContact: owner ? contactFor(owner) : "unknown",
    status: photo.status,
    reviewStatus: (photo.reviewStatus as ReviewStatus | null) ?? null,
    scores: photo.moderationScores,
    raw: photo.moderationRaw,
    isLive: photo.isLive,
    aspectRatio: photo.aspectRatio,
    blurDataUrl: photo.blurDataUrl,
    createdAt: photo.createdAt.toISOString(),
    objectPurgeAt: photo.objectPurgeAt?.toISOString() ?? null,
    reviewedAt: photo.reviewedAt?.toISOString() ?? null,
    imageUrl,
  };
}

export async function readyPhotoCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(userPhotos)
    .where(and(eq(userPhotos.userId, userId), eq(userPhotos.status, "ready")));
  return Number(row?.n ?? 0);
}

export async function allowRejectedPhoto(
  photoId: string,
  adminId: string
): Promise<{ ok: true; card: ReviewCard } | { ok: false; error: string; status: number }> {
  const db = getDb();
  const [photo] = await db.select().from(userPhotos).where(eq(userPhotos.id, photoId)).limit(1);
  if (!photo) return { ok: false, error: "Not found", status: 404 };
  if (photo.reviewStatus !== "pending") {
    return { ok: false, error: "Photo is not pending review", status: 409 };
  }
  if (!photo.objectKey) {
    return { ok: false, error: "Image is no longer available", status: 409 };
  }

  const ready = await readyPhotoCount(photo.userId);
  if (ready >= MAX_LIBRARY_PHOTOS) {
    return {
      ok: false,
      error: `User already has ${MAX_LIBRARY_PHOTOS} ready photos`,
      status: 409,
    };
  }

  const [updated] = await db
    .update(userPhotos)
    .set({
      status: "ready",
      reviewStatus: "overturned",
      reviewedAt: new Date(),
      reviewedBy: adminId,
      objectPurgeAt: null,
    })
    .where(eq(userPhotos.id, photoId))
    .returning();

  const [admin] = await db
    .select({ username: adminUsers.username })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);

  logActivity("admin.photo_allowed", {
    metadata: { photoId, userId: photo.userId, adminId, adminUsername: admin?.username ?? null },
  });

  return { ok: true, card: await serializeReviewCard(updated) };
}

export async function upholdRejectedPhoto(
  photoId: string,
  adminId: string
): Promise<{ ok: true; card: ReviewCard } | { ok: false; error: string; status: number }> {
  const db = getDb();
  const [photo] = await db.select().from(userPhotos).where(eq(userPhotos.id, photoId)).limit(1);
  if (!photo) return { ok: false, error: "Not found", status: 404 };
  if (photo.reviewStatus !== "pending") {
    return { ok: false, error: "Photo is not pending review", status: 409 };
  }

  if (isSpacesConfigured()) {
    try {
      await deleteObject(photo.objectKey);
    } catch (error) {
      console.error("failed to delete upheld photo object:", error);
    }
  }

  const [updated] = await db
    .update(userPhotos)
    .set({
      status: "rejected",
      reviewStatus: "upheld",
      reviewedAt: new Date(),
      reviewedBy: adminId,
      objectPurgeAt: null,
    })
    .where(eq(userPhotos.id, photoId))
    .returning();

  const [admin] = await db
    .select({ username: adminUsers.username })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);

  logActivity("admin.photo_upheld", {
    metadata: { photoId, userId: photo.userId, adminId, adminUsername: admin?.username ?? null },
  });

  return { ok: true, card: await serializeReviewCard(updated) };
}

export async function applySettingsToPending(
  settings: ModerationSettingsMap,
  adminId: string
): Promise<{ allowed: number; skippedCap: number; stillPending: number }> {
  const db = getDb();
  const pending = await db
    .select()
    .from(userPhotos)
    .where(eq(userPhotos.reviewStatus, "pending"));

  let allowed = 0;
  let skippedCap = 0;
  for (const photo of pending) {
    const scores = (photo.moderationScores ?? {}) as Record<string, number>;
    const decision = decide(scores, settings);
    if (!decision.ok) continue;
    const result = await allowRejectedPhoto(photo.id, adminId);
    if (result.ok) allowed += 1;
    else if (result.status === 409) skippedCap += 1;
  }

  const [row] = await db
    .select({ n: count() })
    .from(userPhotos)
    .where(eq(userPhotos.reviewStatus, "pending"));

  logActivity("admin.moderation_apply_pending", {
    metadata: { adminId, allowed, skippedCap, stillPending: Number(row?.n ?? 0) },
  });

  return { allowed, skippedCap, stillPending: Number(row?.n ?? 0) };
}

export async function expireDueRejectedPhotos(): Promise<number> {
  const db = getDb();
  const due = await db
    .select()
    .from(userPhotos)
    .where(
      and(
        eq(userPhotos.reviewStatus, "pending"),
        isNotNull(userPhotos.objectPurgeAt),
        lt(userPhotos.objectPurgeAt, new Date())
      )
    );

  for (const photo of due) {
    if (isSpacesConfigured()) {
      try {
        await deleteObject(photo.objectKey);
      } catch (error) {
        console.error("failed to delete expired rejected photo:", photo.id, error);
      }
    }
  }

  if (due.length === 0) return 0;

  await db
    .update(userPhotos)
    .set({
      reviewStatus: "expired",
      objectPurgeAt: null,
    })
    .where(
      inArray(
        userPhotos.id,
        due.map((row) => row.id)
      )
    );

  logActivity("admin.photo_review_expired", {
    metadata: { count: due.length, photoIds: due.map((row) => row.id) },
  });

  return due.length;
}

export async function replayWhatIf(settings: ModerationSettingsMap) {
  const db = getDb();
  const rows = await db
    .select({
      id: userPhotos.id,
      status: userPhotos.status,
      reviewStatus: userPhotos.reviewStatus,
      scores: userPhotos.moderationScores,
    })
    .from(userPhotos)
    .where(isNotNull(userPhotos.moderationScores))
    .orderBy(sql`${userPhotos.createdAt} desc`)
    .limit(200);

  let pendingWouldAllow = 0;
  let historicalWouldQueue = 0;
  let pendingStay = 0;
  let historicalStayAllow = 0;

  for (const row of rows) {
    const decision = decide((row.scores ?? {}) as Record<string, number>, settings);
    if (row.reviewStatus === "pending") {
      if (decision.ok) pendingWouldAllow += 1;
      else pendingStay += 1;
    } else if (row.status === "ready" && row.reviewStatus !== "overturned") {
      if (!decision.ok) historicalWouldQueue += 1;
      else historicalStayAllow += 1;
    }
  }

  return {
    sampleSize: rows.length,
    pendingWouldAllow,
    pendingStay,
    historicalWouldQueue,
    historicalStayAllow,
  };
}
