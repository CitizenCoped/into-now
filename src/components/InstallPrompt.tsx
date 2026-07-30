"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const stored = sessionStorage.getItem("intonow_install_dismissed");
    if (stored === "true") setDismissed(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (isStandalone() || dismissed) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setDismissed(true);
    sessionStorage.setItem("intonow_install_dismissed", "true");
  }

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem("intonow_install_dismissed", "true");
  }

  if (deferred) {
    return (
      <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-30 w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0f0d18]/95 p-3 shadow-2xl backdrop-blur-xl">
        <p className="text-sm font-semibold text-white">Install into.now</p>
        <p className="mt-1 text-xs text-white/50">Add to your home screen for the full app experience.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2 text-xs font-semibold text-[#06040c]"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  if (isIOS() && !showIosHelp) {
    return (
      <button
        type="button"
        onClick={() => setShowIosHelp(true)}
        className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-30 -translate-x-1/2 rounded-full border border-white/10 bg-[#0f0d18]/90 px-4 py-2 text-xs text-white/60 backdrop-blur-xl"
      >
        Install on iPhone
      </button>
    );
  }

  if (isIOS() && showIosHelp) {
    return (
      <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-30 w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0f0d18]/95 p-3 shadow-2xl backdrop-blur-xl">
        <p className="text-sm font-semibold text-white">Install on iPhone</p>
        <p className="mt-1 text-xs text-white/50">
          Tap Share, then &quot;Add to Home Screen&quot; to install into.now and receive notifications.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-white/50"
        >
          Got it
        </button>
      </div>
    );
  }

  return null;
}