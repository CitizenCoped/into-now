"use client";

import ProfileAvatar from "./ProfileAvatar";

type Props = {
  isSelf?: boolean;
  isLit?: boolean;
  photoUrl?: string | null;
  displayName?: string | null;
};

export default function LiveUserMarker({
  isSelf,
  isLit = true,
  photoUrl,
  displayName,
}: Props) {
  if (photoUrl || displayName) {
    return (
      <div className={`relative ${isLit ? "" : "opacity-50 grayscale"}`}>
        {isLit && (
          <span className="absolute -inset-1 inline-flex animate-ping rounded-full bg-[#22FF66] opacity-40" />
        )}
        <ProfileAvatar photoUrl={photoUrl} displayName={displayName} size="sm" />
      </div>
    );
  }

  return (
    <div className={`relative flex h-6 w-6 items-center justify-center ${isLit ? "" : "opacity-40"}`}>
      {isLit && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22FF66] opacity-50" />
      )}
      <span
        className={`relative h-4 w-4 rounded-full border-2 border-white ${
          isSelf ? "bg-[#22FF66]" : isLit ? "bg-[#10B981]" : "bg-white/30"
        }`}
        style={isLit ? { boxShadow: "0 0 12px #22FF66" } : undefined}
      />
    </div>
  );
}