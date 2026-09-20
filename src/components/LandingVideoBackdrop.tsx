"use client";

import { useEffect, useRef } from "react";

const VIDEO_URL =
  "https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/Video/landing-loop.mp4";
const POSTER_URL =
  "https://thebestdrug.sfo3.cdn.digitaloceanspaces.com/images/landing-poster.jpg";

/** Any of these counts as a user activation that lets mobile Safari/Chrome start playback. */
const GESTURE_EVENTS = ["touchstart", "touchend", "pointerdown", "click", "keydown"] as const;

/**
 * Fullscreen looping background video for the pre-auth landing / age gate.
 * Video at ~55% under a top/bottom void scrim plus the pink (top-left) and
 * cyan (bottom-right) brand glows, so foreground text stays readable.
 *
 * Mobile autoplay is best-effort by design: iOS blocks it in Low Power Mode /
 * Low Data Mode, or when Safari's Auto-Play setting is off, and the
 * `autoplay` attribute alone never recovers. So we also call play() on
 * mount, again on the first touch/click/key (a user gesture is always
 * allowed to start a muted video), and whenever the page becomes visible.
 * Until it starts, the poster frame shows.
 */
export default function LandingVideoBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set the property as well as the attribute: some WebKit builds check the
    // live property when deciding whether a play() is allowed without a gesture.
    video.muted = true;
    video.defaultMuted = true;

    let disposed = false;

    const removeGestureListeners = () => {
      for (const type of GESTURE_EVENTS) document.removeEventListener(type, tryPlay);
    };

    const tryPlay = () => {
      if (disposed || !video.paused) return;
      const attempt = video.play();
      if (!attempt) return;
      attempt
        .then(() => {
          // Playing — the gesture fallbacks are no longer needed.
          removeGestureListeners();
        })
        .catch(() => {
          // Autoplay refused (no gesture yet, Low Power Mode, etc.); keep the
          // poster and wait for a gesture or visibility change.
        });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryPlay();
    };

    // Safari occasionally ignores `loop` after a background/foreground cycle.
    const onEnded = () => {
      video.currentTime = 0;
      tryPlay();
    };

    tryPlay();
    for (const type of GESTURE_EVENTS) {
      document.addEventListener(type, tryPlay, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    video.addEventListener("ended", onEnded);

    return () => {
      disposed = true;
      removeGestureListeners();
      document.removeEventListener("visibilitychange", onVisibility);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#07060B]"
      aria-hidden
    >
      <video
        ref={videoRef}
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
