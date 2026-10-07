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
import { FEATURES } from "@/lib/flags";
import { THEME } from "@/lib/theme";
import { usePostMedia } from "@/hooks/usePostMedia";
import GrokAssist from "./GrokAssist";
import PostMediaStep from "./PostMediaStep";

export type PostSubmission = {
  title: string;
  description: string;
  posterIs: IdentityToken;
  lookingFor: LookingForToken;
  lat: number;
  lng: number;
  /** Ordered post media ids (empty for a text-only post). */
  mediaIds: string[];
};

type Props = {
  onSubmit: (data: PostSubmission) => Promise<void>;
  onBack: () => void;
  defaultLat: number;
  defaultLng: number;
  /** Pre-fills the "You are" picker (from user.identity, Phase 2). */
  defaultPosterIs?: IdentityToken | null;
  /** Media needs an owner; signed-out posts skip step 2. */
  canAttachMedia: boolean;
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
                  ? "border-[#FF2D8A]/60 bg-[#FF2D8A]/20 text-[#FF2D8A]"
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
  canAttachMedia,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [posterIs, setPosterIs] = useState<IdentityToken>(defaultPosterIs ?? "M");
  const [lookingFor, setLookingFor] = useState<LookingForToken>("ANY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const media = usePostMedia();
  // Step 2 exists only when media can actually be attached: the photo
  // feature is on, and there's a signed-in owner for the uploads.
  const mediaStepEnabled = FEATURES.photoBlur && canAttachMedia;

  const code = composeCode(posterIs, lookingFor);
  const codeColor = CODE_COLORS[posterIs];

  /** Keep the focused field visible above the mobile keyboard. */
  function scrollFieldIntoView(e: React.FocusEvent<HTMLElement>) {
    const el = e.target;
    window.setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  }

  function validateText(): boolean {
    if (!title.trim() || !description.trim()) {
      setError("Headline and description are both required.");
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (!validateText()) return;
    if (!mediaStepEnabled) {
      void submit([]);
      return;
    }
    setStep(2);
  }

  function handleCancel() {
    media.discardAll();
    onBack();
  }

  async function submit(mediaIds: string[]) {
    if (!validateText()) return;
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
        mediaIds,
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

  const stepIndicator = (
    <span className="text-[10px] font-bold uppercase tracking-[.14em] text-white/40">
      Step <span className="text-[#00F0FF]">{step}</span> of 2
    </span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable form body — footer stays pinned below. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {step === 1 ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1 text-xs text-white/50 transition hover:text-white"
              >
                <span aria-hidden>←</span> Back to posts
              </button>
              {mediaStepEnabled && stepIndicator}
            </div>

            <h3 className="text-base font-semibold text-white">New Post</h3>
            <p className="mt-0.5 text-xs text-white/40">
              Who are you looking for — <span style={{ color: THEME.accent }}>right now?</span>
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
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF2D8A]/50"
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder="What you're looking for, where, and when. Right now."
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF2D8A]/50"
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
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="flex items-center gap-1 text-xs text-white/50 transition hover:text-white"
              >
                <span aria-hidden>←</span> Back
              </button>
              {stepIndicator}
            </div>
            <PostMediaStep
              items={media.items}
              error={media.error}
              preparing={media.preparing}
              photoCount={media.photoCount}
              videoCount={media.videoCount}
              slotsLeft={media.slotsLeft}
              onAddFile={media.addFile}
              onRemove={media.removeItem}
            />
          </>
        )}
      </div>

      {/* Pinned footer: errors + actions always visible. */}
      <div className="shrink-0 border-t border-white/5 pt-2">
        {error && (
          <p className="mb-2 rounded-lg border border-[#FF2D8A]/30 bg-[#FF2D8A]/10 px-3 py-2 text-xs text-[#FF2D8A]">
            {error}
          </p>
        )}
        <div className="flex gap-2 pb-1">
          {step === 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#FF2D8A] py-2 text-sm font-semibold text-[#07060B] transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? (
                "Posting..."
              ) : mediaStepEnabled ? (
                <>
                  Next <span aria-hidden>→</span>
                </>
              ) : (
                "Post Now"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(media.readyIds)}
              disabled={submitting || media.busy}
              className="flex-1 rounded-lg bg-[#FF2D8A] py-2 text-sm font-semibold text-[#07060B] transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Posting..." : media.busy ? "Screening…" : "Post Now"}
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
        {step === 2 && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              media.discardAll();
              void submit([]);
            }}
            className="mx-auto block px-2 py-1 text-xs text-white/40 transition hover:text-white"
          >
            Post without photos
          </button>
        )}
      </div>
    </div>
  );
}
