"use client";

import PunkFace, { getPunkFaceVariant } from "./PunkFace";

type Props = {
  photoUrl?: string | null;
  displayName?: string | null;
  userId?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

export default function ProfileAvatar({ photoUrl, displayName, userId, size = "md" }: Props) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName ?? "Profile"}
        className={`${sizes[size]} shrink-0 rounded-full object-cover border border-white/10`}
      />
    );
  }

  const variant = getPunkFaceVariant(userId ?? displayName);

  return (
    <PunkFace
      variant={variant}
      className={`${sizes[size]} shrink-0 rounded-full border border-white/10`}
    />
  );
}
