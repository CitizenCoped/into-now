"use client";

import { useState } from "react";
import {
  IDENTITY_TOKENS,
  TOKEN_LABELS,
  CODE_COLORS,
  type IdentityToken,
} from "@/lib/codes";
import type { AuthUser } from "@/hooks/useAuth";
import CornerControl from "./CornerControl";

export type UserFilters = {
  minAge: number;
  maxAge: number;
  maxDistanceMiles: number;
};

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  user: AuthUser | null;
  forMe: boolean;
  onForMeChange: (forMe: boolean) => void;
  posterFilters: string[];
  onPosterFiltersChange: (posterFilters: string[]) => void;
  onSaveIdentity: (identity: IdentityToken) => Promise<unknown>;
  userFilters: UserFilters;
  onUserFiltersChange: (filters: UserFilters) => void;
  onUpgradeClick: () => void;
};

export default function FilterPanel({
  expanded,
  onExpandedChange,
  user,
  forMe,
  onForMeChange,
  posterFilters,
  onPosterFiltersChange,
  onSaveIdentity,
  userFilters,
  onUserFiltersChange,
  onUpgradeClick,
}: Props) {
  const [pickingIdentity, setPickingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const panelPosition =
    "intonow-filter-panel fixed z-20 top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))]";

  const fab = (
      <CornerControl
        position="top-left"
        onClick={() => onExpandedChange(!expanded)}
        ariaLabel={expanded ? "Close filters" : "Open filters"}
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
            <line x1="4" y1="6" x2="20" y2="6" />
            <circle cx="9" cy="6" r="2" fill="#0f0d18" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <circle cx="15" cy="12" r="2" fill="#0f0d18" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="11" cy="18" r="2" fill="#0f0d18" />
          </svg>
        }
      />
  );

  if (!expanded) return fab;

  const isRegistered = user && !user.isAnonymous;

  return (
    <>
    {fab}
    <aside
      className={`${panelPosition} flex max-h-[min(60vh,520px)] w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0d18]/90 shadow-2xl backdrop-blur-xl`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <p className="text-sm font-semibold text-[#FF4D6D]">Filters</p>
        <button
          type="button"
          onClick={() => onExpandedChange(false)}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/60 transition hover:text-white"
          aria-label="Minimize filters"
        >
          ▲
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {!isRegistered ? (
          <div className="space-y-3">
            <p className="text-sm text-white/60">
              Create a free account to filter posts and people on the map.
            </p>
            <button
              type="button"
              onClick={onUpgradeClick}
              className="w-full rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2.5 text-sm font-semibold text-[#06040c]"
            >
              Sign up free
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* "For me" — show only posts looking for my identity (or Anyone). */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  For me
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={forMe}
                  onClick={() => {
                    if (forMe) {
                      onForMeChange(false);
                      setPickingIdentity(false);
                      return;
                    }
                    if (user?.identity) {
                      onForMeChange(true);
                    } else {
                      setPickingIdentity(true);
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    forMe ? "bg-[#FF8A1E]" : "bg-white/10"
                  }`}
                  aria-label="Show posts looking for me"
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      forMe ? "left-[1.375rem]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                {forMe && user?.identity
                  ? `Showing posts looking for ${TOKEN_LABELS[user.identity as IdentityToken] ?? user.identity} — or anyone.`
                  : "Only show posts looking for you (or anyone)."}
              </p>

              {pickingIdentity && !user?.identity && (
                <div className="mt-2 rounded-xl border border-[#FF8A1E]/20 bg-[#FF8A1E]/5 p-3">
                  <p className="mb-2 text-[11px] font-semibold text-[#FF8A1E]">
                    First — you are:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {IDENTITY_TOKENS.map((token) => {
                      const color = CODE_COLORS[token];
                      return (
                        <button
                          key={token}
                          type="button"
                          disabled={savingIdentity}
                          onClick={async () => {
                            setSavingIdentity(true);
                            try {
                              await onSaveIdentity(token);
                              setPickingIdentity(false);
                              onForMeChange(true);
                            } finally {
                              setSavingIdentity(false);
                            }
                          }}
                          className="rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
                          style={{ borderColor: `${color}66`, color }}
                        >
                          {token} · {TOKEN_LABELS[token]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-white/30">
                    Saved to your profile — change it anytime there.
                  </p>
                </div>
              )}
            </div>

            {/* Manual filter by who's posting. "For me" wins while it's on. */}
            <div className={forMe ? "pointer-events-none opacity-40" : ""}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Posted by
              </p>
              <div className="flex flex-wrap gap-2">
                {IDENTITY_TOKENS.map((token) => {
                  const active = posterFilters.includes(token);
                  const color = CODE_COLORS[token];
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        onPosterFiltersChange(
                          active
                            ? posterFilters.filter((c) => c !== token)
                            : [...posterFilters, token]
                        );
                      }}
                      className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
                      style={
                        active
                          ? {
                              borderColor: `${color}66`,
                              backgroundColor: `${color}26`,
                              color,
                            }
                          : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                      }
                    >
                      {token}4… · {TOKEN_LABELS[token]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                People — age range
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-white/50">
                  Min
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={userFilters.minAge}
                    onChange={(e) =>
                      onUserFiltersChange({
                        ...userFilters,
                        minAge: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/50">
                  Max
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={userFilters.maxAge}
                    onChange={(e) =>
                      onUserFiltersChange({
                        ...userFilters,
                        maxAge: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                  />
                </label>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                People — distance (miles)
              </p>
              <input
                type="range"
                min={1}
                max={50}
                value={userFilters.maxDistanceMiles}
                onChange={(e) =>
                  onUserFiltersChange({
                    ...userFilters,
                    maxDistanceMiles: Number(e.target.value),
                  })
                }
                className="w-full"
              />
              <p className="mt-1 text-xs text-white/40">Within {userFilters.maxDistanceMiles} mi</p>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}