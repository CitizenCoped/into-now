"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import GrokAssist from "./GrokAssist";

type Props = {
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    lat: number;
    lng: number;
  }) => Promise<void>;
  onBack: () => void;
  defaultLat: number;
  defaultLng: number;
};

export default function PostCreateForm({ onSubmit, onBack, defaultLat, defaultLng }: Props) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      alert("Title and description required");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        lat: defaultLat,
        lng: defaultLng,
      });
      setTitle("");
      setDescription("");
      onBack();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-white/50 transition hover:text-white"
      >
        <span aria-hidden>←</span> Back to posts
      </button>

      <h3 className="text-base font-semibold text-white">Create New Post</h3>
      <p className="mt-0.5 text-xs text-white/40">Share what you&apos;re into, right now.</p>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c} className="bg-[#0f0d18]">
            {c}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
      />

      <GrokAssist
        category={category}
        title={title}
        description={description}
        onApply={(t, d) => {
          setTitle(t);
          setDescription(d);
        }}
      />

      <div className="mt-3 flex gap-2 pb-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 rounded-lg bg-[#10B981] py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post Now"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}