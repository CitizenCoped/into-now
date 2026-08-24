/**
 * Shared layout constants for the four corner controls (Filters, Profile,
 * Messages, Posts) and the centered logo, plus the map padding they imply.
 *
 * Keeping these in one place means the corner buttons, the MapLibre
 * `setPadding()` call, and the nav-control CSS offset all agree on the same
 * "safe rectangle" so pan/zoom/center never end up hidden under chrome.
 */

/** Diameter (px) shared by all four collapsed corner icon buttons. */
export const CORNER_BUTTON_SIZE = 56;

/** Gap (px) between a corner button and the viewport/safe-area edge. Mirrors the `1rem` used across panel positioning. */
export const CORNER_MARGIN = 16;

/** Extra breathing room (px) beyond the button footprint before map content should start. */
export const CORNER_BUFFER = 10;

/** Approximate height (px) reserved for the centered top-of-screen logo. */
export const LOGO_RESERVED_HEIGHT = 44;

const BASE_INSET = CORNER_BUTTON_SIZE + CORNER_MARGIN + CORNER_BUFFER;

/** Reads a CSS env() safe-area inset in pixels by measuring a throwaway probe element. */
function readSafeAreaInset(side: "top" | "bottom" | "left" | "right"): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = "0px";
  probe.style.width = "0px";
  (probe.style as unknown as Record<string, string>)[`padding${side[0].toUpperCase()}${side.slice(1)}`] =
    `env(safe-area-inset-${side}, 0px)`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0;
  document.body.removeChild(probe);
  return value;
}

export type MapChromePadding = { top: number; bottom: number; left: number; right: number };

/**
 * Padding (px) to hand to `map.setPadding()` so the camera keeps everything
 * inside the rectangle bounded by the four corner controls (and, on top,
 * the centered logo).
 */
export function getMapChromePadding(): MapChromePadding {
  return {
    top: BASE_INSET + LOGO_RESERVED_HEIGHT + readSafeAreaInset("top"),
    bottom: BASE_INSET + readSafeAreaInset("bottom"),
    left: BASE_INSET + readSafeAreaInset("left"),
    right: BASE_INSET + readSafeAreaInset("right"),
  };
}
