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
  imageUrl: string | null;
};
