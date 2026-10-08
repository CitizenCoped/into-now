"use client";

import PostMediaCard, { type PostMediaAction } from "@/components/management/PostMediaCard";
import type { PostMediaCard as PostMediaCardData, RescanDecision } from "@/lib/managementTypes";
import type { ModerationSettingsMap } from "@/lib/moderationCatalog";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function PostMediaDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<PostMediaCardData | null>(null);
  const [settings, setSettings] = useState<ModerationSettingsMap | null>(null);
  const [decision, setDecision] = useState<RescanDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/management/posts-media/${params.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Not found");
    setItem(data.item);
    setSettings(data.settings);
  }, [params.id]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [load]);

  async function act(action: PostMediaAction, reason?: string) {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "hide" || action === "unhide") {
        if (!item.post) return;
        const res = await fetch(`/api/management/posts/${item.post.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Action failed");
        await load();
        return;
      }
      const res = await fetch(`/api/management/posts-media/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setItem(data.item);
      setSettings(data.settings);
      if (data.decision) setDecision(data.decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/management/posts" className="text-xs text-white/40 hover:text-white">
        ← Posts
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-white">Post media</h1>
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {item && settings ? (
        <div className="mt-6">
          <PostMediaCard
            item={item}
            settings={settings}
            busy={busy}
            decision={decision}
            onAction={(action, reason) => void act(action, reason)}
          />
          {item.raw ? (
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/50">
              {JSON.stringify(item.raw, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : !error ? (
        <p className="mt-6 text-sm text-white/40">Loading…</p>
      ) : null}
    </div>
  );
}
