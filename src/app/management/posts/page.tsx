"use client";

import PostMediaCard, { type PostMediaAction } from "@/components/management/PostMediaCard";
import type { PostMediaCard as PostMediaCardData, RescanDecision } from "@/lib/managementTypes";
import type { ModerationSettingsMap } from "@/lib/moderationCatalog";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type State = "live" | "hidden" | "held" | "all";
type Kind = "all" | "photo" | "video";

const STATES: { id: State; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "hidden", label: "Taken down" },
  { id: "held", label: "Held" },
  { id: "all", label: "All" },
];

const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "photo", label: "Photos" },
  { id: "video", label: "Videos" },
];

function hrefFor(state: State, kind: Kind, includeExpired: boolean) {
  const params = new URLSearchParams();
  if (state !== "live") params.set("state", state);
  if (kind !== "all") params.set("kind", kind);
  if (includeExpired) params.set("includeExpired", "1");
  const qs = params.toString();
  return qs ? `/management/posts?${qs}` : "/management/posts";
}

function Browser() {
  const search = useSearchParams();
  const state = (search.get("state") as State) || "live";
  const kind = (search.get("kind") as Kind) || "all";
  const includeExpired = search.get("includeExpired") === "1";

  const [items, setItems] = useState<PostMediaCardData[]>([]);
  const [settings, setSettings] = useState<ModerationSettingsMap | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, RescanDecision>>({});
  const [loading, setLoading] = useState(false);

  const query = useCallback(
    (before?: string) => {
      const params = new URLSearchParams({ state, includeExpired: includeExpired ? "1" : "0" });
      if (kind !== "all") params.set("kind", kind);
      if (before) params.set("before", before);
      return `/api/management/posts-media?${params}`;
    },
    [state, kind, includeExpired]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(query());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setItems(data.items ?? []);
      setSettings(data.settings);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    setError(null);
    setDecisions({});
    void load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const res = await fetch(query(nextCursor));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setItems((current) => [...current, ...(data.items ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function act(item: PostMediaCardData, action: PostMediaAction, reason?: string) {
    setBusyId(item.id);
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
        // Siblings on the same post change state too — reload the list.
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
      setItems((current) => current.map((row) => (row.id === item.id ? data.item : row)));
      if (data.decision) {
        setDecisions((current) => ({ ...current, [item.id]: data.decision }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs ${active ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Posts</h1>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Everything in the public Posts section, judged by the Posts profile. Take-downs and
            hides apply on the next feed refresh; media links already handed out keep working for
            up to an hour.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            {STATES.map((s) => (
              <Link key={s.id} href={hrefFor(s.id, kind, includeExpired)} className={chip(state === s.id)}>
                {s.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {KINDS.map((k) => (
              <Link key={k.id} href={hrefFor(state, k.id, includeExpired)} className={chip(kind === k.id)}>
                {k.label}
              </Link>
            ))}
            <Link
              href={hrefFor(state, kind, !includeExpired)}
              className={`ml-2 ${chip(includeExpired)}`}
            >
              {includeExpired ? "✓ " : ""}Include expired
            </Link>
          </div>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 space-y-4">
        {settings && !loading && items.length === 0 ? (
          <p className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-white/40">
            Nothing in this list.
          </p>
        ) : null}
        {settings
          ? items.map((item) => (
              <PostMediaCard
                key={item.id}
                item={item}
                settings={settings}
                busy={busyId === item.id}
                decision={decisions[item.id] ?? null}
                onAction={(action, reason) => void act(item, action, reason)}
              />
            ))
          : null}
        {loading ? <p className="text-sm text-white/40">Loading…</p> : null}
        {nextCursor && !loading ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/60 hover:text-white"
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function PostsBrowserPage() {
  return (
    <Suspense>
      <Browser />
    </Suspense>
  );
}
