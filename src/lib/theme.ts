/**
 * The Best Drug palette — single source of truth for accent colors.
 *
 * Hex literals still live in many components (the v2 recolor left them
 * scattered); new and touched code should import from here so the next
 * recolor is a one-file change. Matches the --tbd-* vars in globals.css.
 *
 * Contrast: void (#07060B) on pink (#FF2D8A) ≈ 6:1 — CTAs use dark text on
 * pink, never white. Cyan on void ≈ 14:1, so cyan is safe as small text.
 */
export const THEME = {
  /** Primary — CTAs, active states, titles, unread badges (dark text on it). */
  accent: "#FF2D8A",
  /** Contrast — live presence ring/badge, link hover, "Message author", focus rings. */
  live: "#00F0FF",
  /** Text / bone. */
  ink: "#F5F5F0",
  /** Soft accents for chips. */
  accentSoft: "#FF8AC2",
  liveSoft: "#7DF9FF",
  violet: "#B48CFF",
  /** App background void. */
  void: "#07060B",
  /** Panel surface (pink-tinted). */
  panel: "#120A14",
} as const;
