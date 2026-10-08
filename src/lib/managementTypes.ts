import type { ModerationSurface } from "@/lib/moderationCatalog";
import type { MediaKind, MediaPurpose } from "@/lib/photoTypes";

export type ReviewStatus = "pending" | "upheld" | "overturned" | "expired";

export type ReviewCard = {
  id: string;
  userId: string;
  userContact: string;
  status: string;
  reviewStatus: ReviewStatus | null;
  scores: Record<string, number> | null;
  raw: Record<string, unknown> | null;
  isLive: boolean;
  aspectRatio: number;
  blurDataUrl: string;
  createdAt: string;
  objectPurgeAt: string | null;
  reviewedAt: string | null;
  /** Presigned media URL (photo or video), 10 min. */
  imageUrl: string | null;
  kind: MediaKind;
  purpose: MediaPurpose;
  /** Which threshold profile judges this item. */
  surface: ModerationSurface;
  durationMs: number | null;
  /** The post this media is attached to, if any. */
  postId: string | null;
  adminHiddenAt: string | null;
  rescannedAt: string | null;
};

/** Where a post media item stands in the public Posts section. */
export type PostMediaState = "live" | "hidden" | "held" | "expired";

export type AdminMark = {
  at: string;
  byUsername: string | null;
  reason: string | null;
};

export type PostMediaCard = ReviewCard & {
  state: PostMediaState;
  /** Set while an admin has taken this item down. */
  adminHidden: AdminMark | null;
  post: {
    id: string;
    title: string;
    code: string;
    createdAt: string;
    expiresAt: string;
    expired: boolean;
    position: number;
    authorId: string | null;
    /** Set while an admin has hidden the whole post. */
    hidden: AdminMark | null;
  } | null;
};

/** Fresh Sightengine decision from an on-demand re-scan. */
export type RescanDecision = {
  wouldReject: boolean;
  skipped: boolean;
  topClass: string | null;
  topScore: number;
  triggered: { path: string; score: number; threshold: number }[];
};
