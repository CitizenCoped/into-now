/**
 * "THE BEST DRUG" wordmark as live text in the Anton display face (DRUG in
 * brand pink). Rendered as text rather than `/logo.svg` because the SVG's
 * <text> can't load the webfont when used as an <img>; the same glyphs and
 * colors as the asset, guaranteed to render in Anton.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="The Best Drug"
      className={`whitespace-nowrap font-display italic uppercase leading-none tracking-[.04em] text-[#F5F5F0] ${className}`}
    >
      THE BEST <span className="text-[#FF2D8A]">DRUG</span>
    </span>
  );
}
