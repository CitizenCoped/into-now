/**
 * Sunset Pop palette — single source of truth for accent colors.
 *
 * The v2 recolor (commit 33bc369) left hex literals scattered through
 * components; new and touched code should import from here so the next
 * recolor is a one-file change. Matches --intonow-* vars in globals.css.
 */
export const THEME = {
  /** Primary accent (was cyan pre-recolor). */
  accent: "#FF8A1E",
  /** Brand coral — headers, active chips, alerts. */
  coral: "#FF4D6D",
  /** CTA gradient endpoints (from → to). */
  ctaFrom: "#FFB03A",
  ctaTo: "#F56A00",
  /** Live-presence glow. */
  liveGlow: "#FF9E2C",
  /** App background void. */
  void: "#06040c",
  /** Panel background. */
  panel: "#0f0d18",
} as const;
