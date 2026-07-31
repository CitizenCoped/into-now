/**
 * Central feature flags for into.now.
 *
 * PHOTO BLUR IS INTENTIONALLY DEACTIVATED. The blur-to-reveal module
 * (src/components/BlurredPhoto.tsx, src/lib/blur.ts) is built and ready but
 * must stay dark until legal review of the photo feature set is complete.
 *
 * To activate later: set NEXT_PUBLIC_FEATURE_PHOTO_BLUR=true in the
 * environment (Vercel project settings or .env.local). No code changes
 * required — every blur surface checks this flag and renders nothing
 * while it is off.
 */
export const FEATURES = {
  /** Blur-to-reveal photos on posts/profiles. OFF pending legal review. */
  photoBlur: process.env.NEXT_PUBLIC_FEATURE_PHOTO_BLUR === "true",
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isEnabled(feature: FeatureName): boolean {
  return FEATURES[feature];
}
