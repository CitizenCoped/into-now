"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import GrokAssist from "./GrokAssist";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    lat: number;
    lng: number;
  }) => Promise<void>;
  defaultLat: number;
  defaultLng: number;
};

export default function PostModal({ open, onClose, onSubmit, defaultLat, defaultLng }: Props) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

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
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16 backdrop-blur-sm sm:pt-24">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0d18] p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Create New Post</h3>
        <p className="mt-1 text-xs text-white/40">Share what you&apos;re into, right now.</p>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
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
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={4}
          className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
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

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-[#10B981] py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Post Now"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
