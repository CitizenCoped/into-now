"use client";

const CLOUDINARY_EMBED_URL =
  "https://player.cloudinary.com/embed/?cloud_name=dq2wjozdk&public_id=c3b4aa48-ea7f-462c-bc4b-b06c9c748caa_dtpuye";

type Props = {
  className?: string;
};

export default function IntroVideo({ className = "" }: Props) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0814] shadow-[0_0_80px_-20px_rgba(255,138,30,0.35)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,138,30,0.25) 0%, transparent 45%, rgba(255,176,58,0.15) 100%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#06040c]/90 to-transparent" />
      <iframe
        src={CLOUDINARY_EMBED_URL}
        title="Into Now intro"
        className="relative z-0 aspect-video w-full border-0"
        style={{ height: "auto", width: "100%", aspectRatio: "640 / 360" }}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}