"use client";

import ProfileAvatar from "./ProfileAvatar";

type Props = {
  isSelf?: boolean;
  isLit?: boolean;
  photoUrl?: string | null;
  displayName?: string | null;
  userId?: string | null;
};

const LIVE_CYAN = "#00F0FF";

export default function LiveUserMarker({
  isSelf,
  isLit = true,
  photoUrl,
  displayName,
  userId,
}: Props) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-full ${isLit ? "" : "opacity-50 grayscale"}`}
      style={isLit ? { boxShadow: `0 0 0 2px ${LIVE_CYAN}` } : undefined}
    >
      <ProfileAvatar
        photoUrl={photoUrl}
        displayName={displayName}
        userId={userId}
        size="sm"
      />
      {isSelf && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#120A14]"
          style={{ backgroundColor: LIVE_CYAN }}
        />
      )}
    </div>
  );
}
