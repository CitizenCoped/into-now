/**
 * Personals codes — the heart of the pivot.
 *
 * A post is "I am X, looking for Y": `posterIs` and `lookingFor` are stored
 * separately and the classic code is derived (`M` + `W` → "M4W",
 * `MW` + `MW` → "MW4MW", `W` + `ANY` → "W4ANY"). All token combinations are
 * valid by design — no allowlist.
 */

/** Who a person or couple is. Valid for both sides of a code. */
export const IDENTITY_TOKENS = ["M", "W", "T", "MW", "MM", "WW"] as const;

/** What a post can target: any identity, or anyone at all. */
export const LOOKING_FOR_TOKENS = [...IDENTITY_TOKENS, "ANY"] as const;

export type IdentityToken = (typeof IDENTITY_TOKENS)[number];
export type LookingForToken = (typeof LOOKING_FOR_TOKENS)[number];

export const TOKEN_LABELS: Record<LookingForToken, string> = {
  M: "Man",
  W: "Woman",
  T: "Trans person",
  MW: "M/W couple",
  MM: "Two men",
  WW: "Two women",
  ANY: "Anyone",
};

/**
 * Post accent colors, keyed by who is posting (6 colors keeps the map
 * readable; the badge text carries the full code). Sunset Pop palette.
 */
export const CODE_COLORS: Record<IdentityToken, string> = {
  M: "#FFB03A",
  W: "#FF4D6D",
  T: "#A78BFA",
  MW: "#FF8A1E",
  MM: "#F56A00",
  WW: "#EC4899",
};

const FALLBACK_COLOR = "#FF8A1E";

export function isIdentityToken(value: string): value is IdentityToken {
  return (IDENTITY_TOKENS as readonly string[]).includes(value);
}

export function isLookingForToken(value: string): value is LookingForToken {
  return (LOOKING_FOR_TOKENS as readonly string[]).includes(value);
}

/** "M" + "W" → "M4W" */
export function composeCode(posterIs: IdentityToken, lookingFor: LookingForToken): string {
  return `${posterIs}4${lookingFor}`;
}

/** "M4W" → { posterIs: "M", lookingFor: "W" }; null on malformed input. */
export function parseCode(
  code: string
): { posterIs: IdentityToken; lookingFor: LookingForToken } | null {
  const match = /^([A-Z]+)4([A-Z]+)$/.exec(code);
  if (!match) return null;
  const [, posterIs, lookingFor] = match;
  if (!isIdentityToken(posterIs) || !isLookingForToken(lookingFor)) return null;
  return { posterIs, lookingFor };
}

/** Accent color for a full code (e.g. "MW4W"), by its poster half. */
export function getCodeColor(code: string): string {
  const parsed = parseCode(code);
  return parsed ? CODE_COLORS[parsed.posterIs] : FALLBACK_COLOR;
}
