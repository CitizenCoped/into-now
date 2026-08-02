"use client";

const VIDEO_URL =
  "https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/Video/landing-loop.mp4";
const POSTER_URL =
  "https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/images/landing-poster.jpg";

/**
 * Fullscreen looping background video for the pre-auth landing / age gate.
 * Dimmed to ~30% visibility over the page background so foreground text stays
 * readable. autoPlay + muted + playsInline is required for iOS Safari to
 * autoplay at all; when autoplay is blocked (e.g. Low Power Mode) the poster
 * frame shows instead.
 */
export default function LandingVideoBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#06040c]"
      aria-hidden
    >
      <video
        src={VIDEO_URL}
        poster={POSTER_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        className="h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#06040c]/80 to-transparent" />
    </div>
  );
}
