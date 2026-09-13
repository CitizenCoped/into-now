"use client";

import ReviewCard from "@/components/management/ReviewCard";
import type { ReviewCard as ReviewCardData } from "@/lib/managementTypes";
import type { ModerationSettingsMap } from "@/lib/moderationCatalog";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ModerationDetailPage() {
  const params = useParams<{ id: string }>();
  const [photo, setPhoto] = useState<ReviewCardData | null>(null);
  const [settings, setSettings] = useState<ModerationSettingsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/management/moderation/${params.id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Not found");
        setPhoto(data.photo);
        setSettings(data.settings);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [params.id]);

  async function act(action: "allow" | "uphold") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/management/moderation/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setPhoto(data.photo);
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/management/moderation" className="text-xs text-white/40 hover:text-white">
        ← Review queue
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-white">Photo review</h1>
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {photo && settings ? (
        <div className="mt-6">
          <ReviewCard
            photo={photo}
            settings={settings}
            busy={busy}
            onAllow={() => void act("allow")}
            onUphold={() => void act("uphold")}
          />
          {photo.raw ? (
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/50">
              {JSON.stringify(photo.raw, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : !error ? (
        <p className="mt-6 text-sm text-white/40">Loading…</p>
      ) : null}
    </div>
  );
}
