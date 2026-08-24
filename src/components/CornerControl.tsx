"use client";

import type { CSSProperties, ReactNode } from "react";
import { CORNER_BUTTON_SIZE } from "@/lib/mapChrome";

export type CornerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const CORNER_POSITION_CLASSES: Record<CornerPosition, string> = {
  "top-left": "top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))]",
  "top-right": "top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]",
  "bottom-left": "bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]",
  "bottom-right": "bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]",
};

type Props = {
  position: CornerPosition;
  onClick: () => void;
  ariaLabel: string;
  icon: ReactNode;
  accentColor?: string;
  badge?: ReactNode;
  statusDot?: ReactNode;
};

/**
 * Shared symmetric circular icon button used for the four always-visible
 * corner FABs (Filters / Profile / Messages / Posts) so they read as one
 * cohesive "frame" around the map. FABs stack above expanded panels (z-40 >
 * panel z-30) so the launching corner also closes its feature. Icon content
 * and badges are supplied by callers; this component only owns size,
 * position, and shared chrome styling.
 */
export default function CornerControl({
  position,
  onClick,
  ariaLabel,
  icon,
  accentColor = "#FF4D6D",
  badge,
  statusDot,
}: Props) {
  const style: CSSProperties = {
    width: CORNER_BUTTON_SIZE,
    height: CORNER_BUTTON_SIZE,
    ["--intonow-corner-accent" as string]: accentColor,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={style}
      className={`intonow-corner-btn fixed z-40 ${CORNER_POSITION_CLASSES[position]} flex items-center justify-center rounded-full border border-white/10 bg-[#0f0d18]/90 text-white/80 shadow-2xl backdrop-blur-xl transition hover:border-[var(--intonow-corner-accent)]/50 hover:text-white`}
    >
      <span className="relative flex items-center justify-center">
        {icon}
        {statusDot}
        {badge}
      </span>
    </button>
  );
}
