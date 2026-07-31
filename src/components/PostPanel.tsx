"use client";

import type { Post } from "@/lib/schema";
import { getCodeColor, type IdentityToken, type LookingForToken } from "@/lib/codes";
import CornerControl from "./CornerControl";
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
    posterIs: IdentityToken;
    lookingFor: LookingForToken;
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
      <CornerControl
        position="bottom-right"
        onClick={() => onExpandedChange(true)}
        ariaLabel="Open posts panel"
        accentColor="#FF4D6D"
        icon={
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M16.5 19v-1.2a3.3 3.3 0 0 0-3.3-3.3H6.8a3.3 3.3 0 0 0-3.3 3.3V19" />
            <circle cx="9.7" cy="8.3" r="2.8" />
            <path d="M20.5 19v-1.2a2.8 2.8 0 0 0-2-2.7" />
            <path d="M14.9 5.2a2.8 2.8 0 0 1 0 5.5" />
          </svg>
        }
        statusDot={
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f0d18] ${
              connected ? "bg-[#FF9E2C]" : "bg-white/30"
            }`}
            style={connected ? { boxShadow: "0 0 6px #FF9E2C" } : undefined}
          />
        }
        badge={
          liveCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#FF4D6D] px-1 text-[10px] font-bold text-white">
              {liveCount > 99 ? "99+" : liveCount}
            </span>
          ) : undefined
        }
      />
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
          <p className="text-sm font-semibold text-[#FF4D6D]">Posts</p>
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
            className={`h-2 w-2 rounded-full ${connected ? "bg-[#FF9E2C]" : "bg-white/20"}`}
            style={connected ? { boxShadow: "0 0 6px #FF9E2C" } : undefined}
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
              Who&apos;s looking, near you
            </h3>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {posts.length === 0 && (
                <p className="py-4 text-center text-sm text-white/30">No posts yet — be the first!</p>
              )}
              {posts.map((post) => {
                const color = getCodeColor(post.category);
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
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#06040c]"
                        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }}
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
                        className="mt-2 w-full rounded-lg border border-[#FF8A1E]/30 bg-[#FF8A1E]/10 px-3 py-1.5 text-xs font-semibold text-[#FF8A1E] transition hover:bg-[#FF8A1E]/20"
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