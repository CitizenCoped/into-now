/**
 * Text screens for FOSTA-compliance and user safety.
 *
 * Two independent checks, both plain regex — importable from server routes
 * and client components alike:
 *
 * 1. findSolicitationSignal — server-side gate on post text. The platform's
 *    legal line is COMMERCIAL solicitation; adult expression stays free.
 *    Deliberately modest pattern list: catch the obvious, keep false
 *    positives rare. Tune as real content arrives.
 *
 * 2. containsPhoneNumber — client-side DM check powering the contact-info
 *    warning modal (warn-only; nothing is blocked or logged).
 */

const SOLICITATION_PATTERNS: { pattern: RegExp; label: string }[] = [
  // Price-per-time constructions: "$200/hr", "150 an hour", "300 hh"
  { pattern: /\$?\s?\d{2,4}\s*(?:\/|per|an?\s+)\s*(?:hr|hour|hh|half|night|session)/i, label: "rate" },
  // "roses"/"donations" as payment euphemisms near amounts
  { pattern: /\d{2,4}\s*(?:roses|kisses)\b/i, label: "euphemism" },
  { pattern: /\b(?:donation|tribute)s?\b.{0,20}\$?\d{2,4}/i, label: "euphemism" },
  { pattern: /\$?\d{2,4}.{0,20}\b(?:donation|tribute)s?\b/i, label: "euphemism" },
  // Explicit commercial terms
  { pattern: /\bescorts?\b/i, label: "commercial" },
  { pattern: /\b(?:incall|outcall)s?\b/i, label: "commercial" },
  { pattern: /\bgfe\b/i, label: "commercial" },
  { pattern: /\bpay\s*(?:per|for)\s*(?:meet|play|session)\b/i, label: "commercial" },
  // Payment handles combined with meeting language is out of scope for a
  // personals post either way
  { pattern: /\b(?:cash\s?app|venmo|zelle|paypal)\b.{0,30}\$?\d{2,4}/i, label: "payment" },
];

/**
 * Returns a label describing the matched signal, or null when clean.
 * Run on title + description together.
 */
export function findSolicitationSignal(text: string): string | null {
  for (const { pattern, label } of SOLICITATION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/** Message shown to the poster when the screen trips. */
export const SOLICITATION_REJECTION_MESSAGE =
  "This post looks like it offers or requests paid services, which isn't allowed here. into.now is for real, non-commercial connection — reword and try again.";

const PHONE_PATTERNS: RegExp[] = [
  // E.164-ish: +15558675309
  /\+\d{10,14}/,
  // Separated 10-digit: 555-867-5309, 555.867.5309, (555) 867 5309, 555 867 5309
  /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/,
  // Bare 10-11 digit runs
  /(?<!\d)1?\d{10}(?!\d)/,
];

/** Practical, quick detection of the common ways people share numbers. */
export function containsPhoneNumber(text: string): boolean {
  return PHONE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Exact copy for the DM contact-info warning modal (owner-specified). */
export const CONTACT_WARNING_MESSAGE =
  "It looks as if you're trying to send a phone number or other contact information. We strongly advise you keep communications on the platform - for your safety and to protect against fraud.";
