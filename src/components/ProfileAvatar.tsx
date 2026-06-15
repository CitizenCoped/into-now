"use client";

type Props = {
  photoUrl?: string | null;
  displayName?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

export default function ProfileAvatar({ photoUrl, displayName, size = "md" }: Props) {
  const initials = (displayName?.trim()?.[0] ?? "?").toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName ?? "Profile"}
        className={`${sizes[size]} shrink-0 rounded-full object-cover border border-white/10`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 font-semibold text-white`}
    >
      {initials}
    </div>
  );
}