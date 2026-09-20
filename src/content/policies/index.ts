import fs from "node:fs";
import path from "node:path";

/**
 * Registry of published legal documents rendered at /policies/[slug].
 * Server-only: `readPolicyMarkdown` touches the filesystem, and the pages
 * that use it are statically generated (see `generateStaticParams`).
 *
 * The markdown files are the legal text verbatim (formatting normalized
 * only). Cross-references to policies that are not published yet are
 * deliberately plain text; link them here once they ship.
 */
export type PolicySlug = "terms-of-service" | "safety-policy" | "take-it-down";

export type PolicyMeta = {
  slug: PolicySlug;
  title: string;
  /** One line for the hub card and <meta name="description">. */
  description: string;
  /** ISO date (YYYY-MM-DD). */
  effectiveDate: string;
  file: string;
};

export const POLICIES: readonly PolicyMeta[] = [
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    description: "The agreement that governs your access to and use of The Best Drug.",
    effectiveDate: "2026-09-21",
    file: "terms-of-service.md",
  },
  {
    slug: "safety-policy",
    title: "Safety Policy",
    description: "Prohibited conduct, reporting guidelines, and safety resources.",
    effectiveDate: "2026-09-21",
    file: "safety-policy.md",
  },
  {
    slug: "take-it-down",
    title: "TAKE IT DOWN Act Policy",
    description: "How to request removal of nonconsensual intimate imagery.",
    effectiveDate: "2026-09-21",
    file: "take-it-down.md",
  },
];

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "policies");

export function getPolicy(slug: string): PolicyMeta | undefined {
  return POLICIES.find((policy) => policy.slug === slug);
}

export function readPolicyMarkdown(meta: PolicyMeta): string {
  return fs.readFileSync(path.join(CONTENT_DIR, meta.file), "utf8");
}

/** "2026-09-21" → "September 21, 2026" (UTC, so the calendar date never shifts). */
export function formatEffectiveDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );
}
