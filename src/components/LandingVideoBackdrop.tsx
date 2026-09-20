"use client";

const VIDEO_URL =
  "https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/Video/landing-loop.mp4";
const POSTER_URL =
  "https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/images/landing-poster.jpg";

/**
 * Fullscreen looping background video for the pre-auth landing / age gate.
 * Video at ~55% under a top/bottom void scrim plus the pink (top-left) and
 * cyan (bottom-right) brand glows, so foreground text stays readable.
 * autoPlay + muted + playsInline is required for iOS Safari to autoplay at
 * all; when autoplay is blocked (e.g. Low Power Mode) the poster frame shows
 * instead.
 */
export default function LandingVideoBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#07060B]"
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
        className="h-full w-full object-cover opacity-55"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,6,11,.45) 0%, rgba(7,6,11,0) 28%, rgba(7,6,11,0) 60%, rgba(7,6,11,.6) 100%)",
        }}
      />
      <div className="absolute -left-[30%] -top-[10%] h-[40%] w-[80%] rounded-full bg-[#FF2D8A]/[.14] blur-[110px]" />
      <div className="absolute -bottom-[5%] -right-[25%] h-[35%] w-[65%] rounded-full bg-[#00F0FF]/[.08] blur-[100px]" />
    </div>
  );
}
