import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "./loadEnv";
import {
  CLASS_CATALOG,
  collectCatalogScores,
  decide,
  DEFAULT_MODERATION_SETTINGS,
} from "../src/lib/moderationCatalog";

loadEnv();

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";
const DEFAULT_MODELS = "nudity-2.1,gore-2.0,offensive";

/** Public SFW fixtures only — indoor-ish portrait, beach, outdoor, animal. */
const FIXTURES: { id: string; url: string; note: string }[] = [
  {
    id: "portrait",
    url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=640&q=80",
    note: "Indoor-style portrait (false-positive case for scene descriptors)",
  },
  {
    id: "beach",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640&q=80",
    note: "Beach scene",
  },
  {
    id: "outdoor",
    url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=640&q=80",
    note: "Neutral outdoor landscape",
  },
  {
    id: "animal",
    url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=640&q=80",
    note: "Neutral animal photo",
  },
];

async function checkUrl(url: string): Promise<Record<string, unknown>> {
  const user = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret) {
    throw new Error("SIGHTENGINE_USER / SIGHTENGINE_SECRET are not set");
  }

  const media = await fetch(url, {
    headers: { "User-Agent": "into-now-sightengine-probe/1.0" },
  });
  if (!media.ok) {
    throw new Error(`Could not download fixture: HTTP ${media.status}`);
  }
  const bytes = new Uint8Array(await media.arrayBuffer());
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const form = new FormData();
  form.set("media", new Blob([copy]), "fixture.jpg");
  form.set("models", process.env.SIGHTENGINE_MODELS ?? DEFAULT_MODELS);
  form.set("api_user", user);
  form.set("api_secret", secret);

  const res = await fetch(SIGHTENGINE_ENDPOINT, { method: "POST", body: form });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.status !== "success") {
    throw new Error(`Sightengine error: HTTP ${res.status} ${JSON.stringify(data.error ?? data)}`);
  }
  return data;
}

async function main() {
  const outDir = resolve(process.cwd(), "tmp/sightengine-probes");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  console.log(`Probing Sightengine (${FIXTURES.length} public fixtures)\n`);

  const summary: unknown[] = [];

  for (const fixture of FIXTURES) {
    process.stdout.write(`• ${fixture.id} … `);
    try {
      const raw = await checkUrl(fixture.url);
      const scores = collectCatalogScores(raw);
      const current = decide(scores, DEFAULT_MODERATION_SETTINGS);
      const watched06 = CLASS_CATALOG.filter((entry) => entry.path !== "nudity.very_suggestive" && entry.path !== "offensive.middle_finger")
        .map((entry) => ({
          path: entry.path,
          score: scores[entry.path] ?? null,
          rejectAt06: (scores[entry.path] ?? 0) >= 0.6,
        }));

      const row = {
        id: fixture.id,
        note: fixture.note,
        url: fixture.url,
        decision: current,
        watchedAt06: watched06,
        requestId: raw.request,
      };
      summary.push({ ...row, raw });

      writeFileSync(resolve(outDir, `${stamp}-${fixture.id}.json`), JSON.stringify({ fixture, raw, scores, current }, null, 2));

      const bits = Object.entries(scores)
        .map(([path, score]) => `${path}=${(score as number).toFixed(3)}`)
        .join("  ");
      console.log(`${current.ok ? "PASS" : "QUEUE"}  ${bits}`);
    } catch (error) {
      console.log("FAIL");
      console.error(`  ${error instanceof Error ? error.message : error}`);
      summary.push({ id: fixture.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const summaryPath = resolve(outDir, `${stamp}-summary.json`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nDumps written to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
