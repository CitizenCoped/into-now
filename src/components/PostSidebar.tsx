"use client";

import type { Post } from "@/lib/schema";
import { getCategoryColor } from "@/lib/categories";

type Props = {
  posts: Post[];
  search: string;
  onSearchChange: (value: string) => void;
  onPostClick: (post: Post) => void;
  onNewPost: () => void;
  selectedId: string | null;
};

export default function PostSidebar({
  posts,
  search,
  onSearchChange,
  onPostClick,
  onNewPost,
  selectedId,
}: Props) {
  return (
    <aside className="absolute left-3 top-3 z-20 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/10 bg-[#0f0d18]/80 p-4 shadow-2xl backdrop-blur-xl sm:left-4 sm:top-4">
      <div className="mb-1 flex items-center gap-2">
        <img src="/logo.svg" alt="into.now" className="h-7 w-auto" />
      </div>
      <p className="mb-4 text-sm text-white/50">what are you into? <span className="text-[#FF4D6D]">NOW?</span></p>

      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search posts..."
        className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
      />

      <button
        onClick={onNewPost}
        className="mb-4 w-full rounded-lg bg-gradient-to-r from-[#FF4D6D] to-[#FF6B8A] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#FF4D6D]/20 transition hover:brightness-110"
      >
        + New Post
      </button>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        Nearby Posts
      </h3>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {posts.length === 0 && (
          <p className="py-6 text-center text-sm text-white/30">No posts yet — be the first!</p>
        )}
        {posts.map((post) => {
          const color = getCategoryColor(post.category);
          const active = post.id === selectedId;
          return (
            <button
              key={post.id}
              onClick={() => onPostClick(post)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                active
                  ? "border-[#FF4D6D]/40 bg-white/10"
                  : "border-white/5 bg-white/5 hover:border-white/15 hover:bg-white/8"
              }`}
            >
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
          );
        })}
      </div>
    </aside>
  );
}
