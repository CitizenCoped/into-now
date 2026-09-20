"use client";

import { useState } from "react";

import type { IdentityToken, LookingForToken } from "@/lib/codes";

type Suggestion = {
  suggestedTitle: string;
  suggestedDescription: string;
  tips: string[];
};

type Props = {
  posterIs: IdentityToken;
  lookingFor: LookingForToken;
  title: string;
  description: string;
  onApply: (title: string, description: string) => void;
};

export default function GrokAssist({ posterIs, lookingFor, title, description, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getHelp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posterIs,
          lookingFor,
          titleDraft: title,
          descriptionDraft: description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuggestion(null);
        throw new Error(data.error ?? "Grok assist failed");
      }
      setSuggestion(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#FF2D8A]/20 bg-[#FF2D8A]/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#FF2D8A]">Grok Post Coach</p>
        <button
          type="button"
          onClick={getHelp}
          disabled={loading}
          className="rounded-lg bg-[#FF2D8A]/20 px-3 py-1 text-xs font-medium text-[#FF2D8A] transition hover:bg-[#FF2D8A]/30 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Help me post"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Suggested title</p>
            <p className="text-sm text-white">{suggestion.suggestedTitle}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Suggested description</p>
            <p className="text-sm text-white/80">{suggestion.suggestedDescription}</p>
          </div>
          {suggestion.tips?.length > 0 && (
            <ul className="list-inside list-disc text-xs text-white/50">
              {suggestion.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() =>
              onApply(suggestion.suggestedTitle, suggestion.suggestedDescription)
            }
            className="w-full rounded-lg bg-[#FF2D8A] py-1.5 text-xs font-semibold text-[#07060B] transition hover:brightness-110"
          >
            Use suggestion
          </button>
        </div>
      )}
    </div>
  );
}
