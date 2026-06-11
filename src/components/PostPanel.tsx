"use client";

import type { Post } from "@/lib/schema";
import { getCategoryColor } from "@/lib/categories";
import PostCreateForm from "./PostCreateForm";

type PanelView = "list" | "create";

type Props = {
  expanded: boolean;
  view: PanelView;
  onExpandedChange: (expanded: boolean) => void;
  onViewChange: (view: PanelView) => void;
  posts: Post[];
  search: string;
  onSearchChange: (value: string) => void;
  onPostClick: (post: Post) => void;
  selectedId: string | null;
  liveCount: number;
  connected: boolean;
  sharing: boolean;
  onSubmitPost: (data: {
    title: string;
    description: string;
    category: string;
    lat: number;
    lng: number;
  }) => Promise<void>;
  defaultLat: number;
  defaultLng: number;
  currentUserId: string | null;
  onMessageAuthor: (authorId: string) => void;
};

export default function PostPanel({
  expanded,
  view,
  onExpandedChange,
  onViewChange,
  posts,
  search,
  onSearchChange,
  onPostClick,
  selectedId,
  liveCount,
  connected,
  sharing,
  onSubmitPost,
  defaultLat,
  defaultLng,
  currentUserId,
  onMessageAuthor,
}: Props) {
  const panelPosition =
    "intonow-panel fixed z-20 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => onExpandedChange(true)}
        className={`${panelPosition} flex items-center gap-2 rounded-full border border-white/10 bg-[#0f0d18]/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition hover:border-[#FF4D6D]/40 sm:left-auto`}
        aria-label="Open posts panel"
      >
        <img src="/logo.svg" alt="" className="h-5 w-auto" />
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-[#22FF66]" : "bg-white/30"}`}
          style={connected ? { boxShadow: "0 0 6px #22FF66" } : undefined}
        />
        {liveCount > 0 && (
          <span className="rounded-full bg-[#FF4D6D]/20 px-2 py-0.5 text-xs font-medium text-[#FF4D6D]">
            {liveCount}
          </span>
        )}
        <span className="text-white/50" aria-hidden>
          ▲
        </span>
      </button>
    );
  }

  const isCreate = view === "create";

  return (
    <aside
      className={`${panelPosition} left-[max(1rem,env(safe-area-inset-left))] flex max-h-[min(55vh,480px)] w-auto flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0d18]/90 shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[min(380px,calc(100vw-2rem))] ${
        isCreate ? "max-h-[min(70vh,560px)]" : ""
      }`}
      data-panel-expanded="true"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <img src="/logo.svg" alt="into.now" className="h-6 w-auto" />
          <p className="mt-0.5 text-[11px] text-white/40">
            what are you into? <span className="text-[#FF4D6D]">NOW?</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onViewChange("list");
            onExpandedChange(false);
          }}
          className="ml-2 shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/60 transition hover:text-white"
          aria-label="Minimize panel"
        >
          ▼
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-2 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-[#22FF66]" : "bg-white/20"}`}
            style={connected ? { boxShadow: "0 0 6px #22FF66" } : undefined}
          />
          {connected ? "Live" : "Connecting..."}
        </span>
        <span>{liveCount} nearby now</span>
        {!sharing && <span className="text-amber-400/80">Location off</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pt-3">
        {isCreate ? (
          <PostCreateForm
            onSubmit={onSubmitPost}
            onBack={() => onViewChange("list")}
            defaultLat={defaultLat}
            defaultLng={defaultLng}
          />
        ) : (
          <>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search posts..."
              className="mb-3 w-full shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
            />

            <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-white/40">
              Nearby Posts
            </h3>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {posts.length === 0 && (
                <p className="py-4 text-center text-sm text-white/30">No posts yet — be the first!</p>
              )}
              {posts.map((post) => {
                const color = getCategoryColor(post.category);
                const active = post.id === selectedId;
                const canMessage =
                  post.authorId && post.authorId !== currentUserId;
                return (
                  <div
                    key={post.id}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-[#FF4D6D]/40 bg-white/10"
                        : "border-white/5 bg-white/5 hover:border-white/15 hover:bg-white/8"
                    }`}
                  >
                    <button type="button" onClick={() => onPostClick(post)} className="w-full text-left">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                        style={{ backgroundColor: color }}
                      >
                        {post.category}
                      </span>
                      <p className="mt-1.5 font-semibold text-white">{post.title}</p>
                      <p className="mt-1 text-xs text-white/50 line-clamp-2">
                        {post.description.length > 65
                          ? `${post.description.substring(0, 65)}...`
                          : post.description}
                      </p>
                    </button>
                    {canMessage && (
                      <button
                        type="button"
                        onClick={() => onMessageAuthor(post.authorId!)}
                        className="mt-2 w-full rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 py-1.5 text-xs font-semibold text-[#22D3EE] transition hover:bg-[#22D3EE]/20"
                      >
                        Message author
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 shrink-0 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => onViewChange("create")}
                className="w-full rounded-lg bg-gradient-to-r from-[#FF4D6D] to-[#FF6B8A] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#FF4D6D]/20 transition hover:brightness-110"
              >
                + New Post
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}