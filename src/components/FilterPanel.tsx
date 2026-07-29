"use client";

import { CATEGORIES } from "@/lib/categories";
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
  categories: string[];
  onCategoriesChange: (categories: string[]) => void;
  userFilters: UserFilters;
  onUserFiltersChange: (filters: UserFilters) => void;
  onUpgradeClick: () => void;
};

export default function FilterPanel({
  expanded,
  onExpandedChange,
  user,
  categories,
  onCategoriesChange,
  userFilters,
  onUserFiltersChange,
  onUpgradeClick,
}: Props) {
  const panelPosition =
    "intonow-filter-panel fixed z-20 top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))]";

  if (!expanded) {
    return (
      <CornerControl
        position="top-left"
        onClick={() => onExpandedChange(true)}
        ariaLabel="Open filters"
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
  }

  const isRegistered = user && !user.isAnonymous;

  return (
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!isRegistered ? (
          <div className="space-y-3">
            <p className="text-sm text-white/60">
              Create a free account to filter posts and people on the map.
            </p>
            <button
              type="button"
              onClick={onUpgradeClick}
              className="w-full rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] py-2.5 text-sm font-semibold text-[#06040c]"
            >
              Sign up free
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Post categories
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onCategoriesChange(
                          active
                            ? categories.filter((c) => c !== cat)
                            : [...categories, cat]
                        );
                      }}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        active
                          ? "border-[#FF4D6D]/40 bg-[#FF4D6D]/15 text-[#FF4D6D]"
                          : "border-white/10 text-white/50 hover:text-white"
                      }`}
                    >
                      {cat}
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
  );
}