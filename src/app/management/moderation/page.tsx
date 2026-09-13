"use client";

import ReviewCard from "@/components/management/ReviewCard";
import type { ReviewCard as ReviewCardData, ReviewStatus } from "@/lib/managementTypes";
import type { ModerationSettingsMap } from "@/lib/moderationCatalog";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const FILTERS: { id: ReviewStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "overturned", label: "Allowed" },
  { id: "upheld", label: "Kept rejected" },
  { id: "expired", label: "Expired" },
];

function Queue() {
  const search = useSearchParams();
  const status = (search.get("status") as ReviewStatus) || "pending";
  const [photos, setPhotos] = useState<ReviewCardData[]>([]);
  const [settings, setSettings] = useState<ModerationSettingsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/management/moderation?status=${status}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load");
    setPhotos(data.photos ?? []);
    setSettings(data.settings);
  }, [status]);

  useEffect(() => {
    setError(null);
    void load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function act(id: string, action: "allow" | "uphold") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/management/moderation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setPhotos((current) => current.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Photo review</h1>
          <p className="mt-1 text-sm text-white/50">
            Sightengine held these. Allow puts the photo back in the user’s library.
          </p>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((filter) => (
            <Link
              key={filter.id}
              href={filter.id === "pending" ? "/management/moderation" : `/management/moderation?status=${filter.id}`}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                status === filter.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 space-y-4">
        {settings && photos.length === 0 ? (
          <p className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-white/40">
            Nothing in this list.
          </p>
        ) : null}
        {settings
          ? photos.map((photo) => (
              <div key={photo.id}>
                <Link href={`/management/moderation/${photo.id}`} className="mb-2 inline-block text-xs text-white/40 hover:text-white">
                  Open card
                </Link>
                <ReviewCard
                  photo={photo}
                  settings={settings}
                  busy={busyId === photo.id}
                  onAllow={() => void act(photo.id, "allow")}
                  onUphold={() => void act(photo.id, "uphold")}
                />
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

export default function ModerationQueuePage() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}
