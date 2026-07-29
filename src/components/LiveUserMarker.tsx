"use client";

import ProfileAvatar from "./ProfileAvatar";

type Props = {
  isSelf?: boolean;
  isLit?: boolean;
  photoUrl?: string | null;
  displayName?: string | null;
  userId?: string | null;
};

const GLOW_ORANGE = "#FF7A1A";

export default function LiveUserMarker({
  isSelf,
  isLit = true,
  photoUrl,
  displayName,
  userId,
}: Props) {
  return (
    <div className={`relative flex items-center justify-center ${isLit ? "" : "opacity-50 grayscale"}`}>
      {isLit && (
        <>
          <span
            className="pointer-events-none absolute -inset-2.5 animate-pulse rounded-full opacity-70 blur-md"
            style={{ backgroundColor: GLOW_ORANGE }}
          />
          <span
            className="pointer-events-none absolute -inset-1 rounded-full"
            style={{
              boxShadow: `0 0 0 2px rgba(255,122,26,0.55), 0 0 14px 4px rgba(255,122,26,0.55), 0 0 26px 10px rgba(255,107,53,0.3)`,
            }}
          />
        </>
      )}
      <ProfileAvatar
        photoUrl={photoUrl}
        displayName={displayName}
        userId={userId}
        size="sm"
      />
      {isSelf && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f0d18]"
          style={{ backgroundColor: GLOW_ORANGE }}
        />
      )}
    </div>
  );
}
