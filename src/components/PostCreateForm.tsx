"use client";

import { useState } from "react";
import {
  IDENTITY_TOKENS,
  LOOKING_FOR_TOKENS,
  TOKEN_LABELS,
  CODE_COLORS,
  composeCode,
  type IdentityToken,
  type LookingForToken,
} from "@/lib/codes";
import { THEME } from "@/lib/theme";
import GrokAssist from "./GrokAssist";

type Props = {
  onSubmit: (data: {
    title: string;
    description: string;
    posterIs: IdentityToken;
    lookingFor: LookingForToken;
    lat: number;
    lng: number;
  }) => Promise<void>;
  onBack: () => void;
  defaultLat: number;
  defaultLng: number;
  /** Pre-fills the "You are" picker (from user.identity, Phase 2). */
  defaultPosterIs?: IdentityToken | null;
};

function TokenPicker<T extends LookingForToken>({
  label,
  tokens,
  value,
  onChange,
}: {
  label: string;
  tokens: readonly T[];
  value: T;
  onChange: (token: T) => void;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((token) => {
          const active = token === value;
          return (
            <button
              key={token}
              type="button"
              onClick={() => onChange(token)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                active
                  ? "border-[#FF8A1E]/60 bg-[#FF8A1E]/20 text-[#FF8A1E]"
                  : "border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {token} · {TOKEN_LABELS[token]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function PostCreateForm({
  onSubmit,
  onBack,
  defaultLat,
  defaultLng,
  defaultPosterIs,
}: Props) {
  const [posterIs, setPosterIs] = useState<IdentityToken>(defaultPosterIs ?? "M");
  const [lookingFor, setLookingFor] = useState<LookingForToken>("ANY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = composeCode(posterIs, lookingFor);
  const codeColor = CODE_COLORS[posterIs];

  /** Keep the focused field visible above the mobile keyboard. */
  function scrollFieldIntoView(e: React.FocusEvent<HTMLElement>) {
    const el = e.target;
    window.setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  }

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      setError("Headline and description are both required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        posterIs,
        lookingFor,
        lat: defaultLat,
        lng: defaultLng,
      });
      setTitle("");
      setDescription("");
      onBack();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't post right now. Try again in a moment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable form body — footer stays pinned below. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-xs text-white/50 transition hover:text-white"
        >
          <span aria-hidden>←</span> Back to posts
        </button>

        <h3 className="text-base font-semibold text-white">New Post</h3>
        <p className="mt-0.5 text-xs text-white/40">
          Who are you looking for — <span style={{ color: THEME.coral }}>right now?</span>
        </p>

        {/* Live code preview — the classic personals header, composed live. */}
        <div
          className="mt-3 flex items-center justify-center rounded-xl border py-2.5"
          style={{ borderColor: `${codeColor}66`, backgroundColor: `${codeColor}1a` }}
        >
          <span
            className="text-2xl font-black tracking-widest"
            style={{ color: codeColor, textShadow: `0 0 12px ${codeColor}55` }}
            aria-live="polite"
          >
            {code}
          </span>
        </div>

        <TokenPicker
          label="You are"
          tokens={IDENTITY_TOKENS}
          value={posterIs}
          onChange={setPosterIs}
        />
        <TokenPicker
          label="Looking for"
          tokens={LOOKING_FOR_TOKENS}
          value={lookingFor}
          onChange={setLookingFor}
        />

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={scrollFieldIntoView}
          placeholder="Headline — make it count"
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={scrollFieldIntoView}
          placeholder="What you're looking for, where, and when. Right now."
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF4D6D]/50"
        />

        <GrokAssist
          posterIs={posterIs}
          lookingFor={lookingFor}
          title={title}
          description={description}
          onApply={(t, d) => {
            setTitle(t);
            setDescription(d);
          }}
        />
      </div>

      {/* Pinned footer: errors + actions always visible. */}
      <div className="shrink-0 border-t border-white/5 pt-2">
        {error && (
          <p className="mb-2 rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/10 px-3 py-2 text-xs text-[#FF4D6D]">
            {error}
          </p>
        )}
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
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
    </div>
  );
}
