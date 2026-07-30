"use client";

import { useState } from "react";

type Suggestion = {
  suggestedTitle: string;
  suggestedDescription: string;
  tips: string[];
  category?: string | null;
};

type Props = {
  category: string;
  title: string;
  description: string;
  onApply: (title: string, description: string) => void;
};

export default function GrokAssist({ category, title, description, onApply }: Props) {
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
        body: JSON.stringify({ category, titleDraft: title, descriptionDraft: description }),
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
    <div className="mt-3 rounded-xl border border-[#FF8A1E]/20 bg-[#FF8A1E]/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#FF8A1E]">Grok Post Coach</p>
        <button
          type="button"
          onClick={getHelp}
          disabled={loading}
          className="rounded-lg bg-[#FF8A1E]/20 px-3 py-1 text-xs font-medium text-[#FF8A1E] transition hover:bg-[#FF8A1E]/30 disabled:opacity-50"
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
            className="w-full rounded-lg bg-[#FF8A1E] py-1.5 text-xs font-semibold text-[#06040c] transition hover:brightness-110"
          >
            Use suggestion
          </button>
        </div>
      )}
    </div>
  );
}
