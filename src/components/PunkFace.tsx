"use client";

/**
 * Deterministic "punk" avatar fallback used whenever a user has no photo.
 * 8 hand-drawn SVG variants on a yellow circular base, picked by a stable
 * hash of a seed (userId, falling back to displayName).
 */

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPunkFaceVariant(seed?: string | null): number {
  const s = seed && seed.trim().length > 0 ? seed.trim() : "anon";
  return hashString(s) % 8;
}

const BASE_FILL = "#FFD400";
const INK = "#1A1410";

function XEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke={INK} strokeWidth={3.4} strokeLinecap="round">
      <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} />
      <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} />
    </g>
  );
}

function DotEye({ cx, cy, r = 4.5 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={INK} />;
}

function RingEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={6.5} fill="none" stroke={INK} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={2} fill={INK} />
    </g>
  );
}

function SpiralEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M ${cx} ${cy} m -7 0 a 7 7 0 1 1 14 0 a 4.5 4.5 0 1 1 -9 0 a 2.2 2.2 0 1 1 4.4 0`}
      fill="none"
      stroke={INK}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
  );
}

function SquiggleMouth() {
  return (
    <path
      d="M 16 44 Q 22 38, 28 44 T 40 44 T 48 38"
      fill="none"
      stroke={INK}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  );
}

function SmirkMouth() {
  return (
    <path
      d="M 18 42 Q 32 50, 46 36"
      fill="none"
      stroke={INK}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  );
}

function ZigzagMouth() {
  return (
    <path
      d="M 16 42 L 23 46 L 30 40 L 37 46 L 44 40 L 48 43"
      fill="none"
      stroke={INK}
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function ZipperMouth() {
  return (
    <g stroke={INK} strokeWidth={2.6} strokeLinecap="round">
      <line x1={16} y1={42} x2={48} y2={42} />
      {[20, 26, 32, 38, 44].map((x, i) => (
        <line key={x} x1={x} y1={39} x2={x} y2={i % 2 === 0 ? 46 : 45} />
      ))}
    </g>
  );
}

function Mohawk() {
  return (
    <path
      d="M 22 10 L 27 -2 L 32 8 L 37 -2 L 42 10 Z"
      fill={INK}
      transform="translate(0, 6)"
    />
  );
}

const FACES: Array<() => JSX.Element> = [
  // 0: classic XX eyes + squiggle mouth
  () => (
    <>
      <XEye cx={22} cy={27} />
      <XEye cx={42} cy={27} />
      <SquiggleMouth />
    </>
  ),
  // 1: wild spiral eyes + smirk
  () => (
    <>
      <SpiralEye cx={22} cy={27} />
      <SpiralEye cx={42} cy={27} />
      <SmirkMouth />
    </>
  ),
  // 2: asymmetric eyes (X + dot) + zigzag mouth
  () => (
    <>
      <XEye cx={22} cy={27} />
      <DotEye cx={42} cy={27} r={5.5} />
      <ZigzagMouth />
    </>
  ),
  // 3: ring eyes + zipper mouth
  () => (
    <>
      <RingEye cx={22} cy={27} />
      <RingEye cx={42} cy={27} />
      <ZipperMouth />
    </>
  ),
  // 4: XX eyes + zigzag mouth + mohawk spike (punchy)
  () => (
    <>
      <Mohawk />
      <XEye cx={22} cy={27} />
      <XEye cx={42} cy={27} />
      <ZigzagMouth />
    </>
  ),
  // 5: spiral eyes + zipper mouth
  () => (
    <>
      <SpiralEye cx={22} cy={27} />
      <SpiralEye cx={42} cy={27} />
      <ZipperMouth />
    </>
  ),
  // 6: asymmetric ring + dot eyes + smirk (punchy)
  () => (
    <>
      <RingEye cx={22} cy={27} />
      <DotEye cx={42} cy={27} r={5.5} />
      <SmirkMouth />
    </>
  ),
  // 7: dot eyes + squiggle mouth + mohawk spike
  () => (
    <>
      <Mohawk />
      <DotEye cx={22} cy={27} />
      <DotEye cx={42} cy={27} />
      <SquiggleMouth />
    </>
  ),
];

type Props = {
  variant: number;
  className?: string;
};

export default function PunkFace({ variant, className }: Props) {
  const v = ((variant % FACES.length) + FACES.length) % FACES.length;
  const Face = FACES[v];

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Punk avatar"
      style={{ display: "block" }}
    >
      <clipPath id={`punk-clip-${v}`}>
        <circle cx={32} cy={32} r={30} />
      </clipPath>
      <circle cx={32} cy={32} r={30} fill={BASE_FILL} stroke={INK} strokeWidth={2} />
      <g clipPath={`url(#punk-clip-${v})`}>{Face()}</g>
    </svg>
  );
}
