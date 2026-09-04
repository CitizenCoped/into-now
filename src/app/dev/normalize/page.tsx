/**
 * /dev/normalize — harness for src/lib/imageNormalize.ts.
 *
 * Available in local dev and on Vercel preview deployments (so the real
 * production bundle, including the lazy WASM HEIC chunk, can be tested on
 * actual phones). Returns 404 on production deployments. VERCEL_ENV is set
 * by Vercel at build time; locally it is undefined.
 */

import { notFound } from "next/navigation";
import Harness from "./Harness";

export default function NormalizeHarnessPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <Harness />;
}
