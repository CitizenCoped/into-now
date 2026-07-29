"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
  user: AuthUser;
  onSave: (updates: { displayName: string; statement: string; photoUrl: string }) => Promise<unknown>;
};

export default function ProfileEditor({ user, onSave }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [statement, setStatement] = useState(user.statement ?? "");
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoSelect(file: File) {
    setUploading(true);
    setError("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setPhotoUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !statement.trim() || !photoUrl.trim()) {
      setError("Photo, display name, and statement are all required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSave({
        displayName: displayName.trim(),
        statement: statement.trim(),
        photoUrl: photoUrl.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div className="text-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mx-auto block"
          disabled={uploading}
        >
          <ProfileAvatar photoUrl={photoUrl} displayName={displayName} userId={user.id} size="lg" />
          <p className="mt-2 text-xs text-[#22D3EE]">
            {uploading ? "Uploading..." : "Tap to add your photo"}
          </p>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePhotoSelect(file);
          }}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="How you want to appear"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">Statement</label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Who you are and what you're looking for"
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50"
        />
      </div>

      {error && <p className="text-sm text-[#FF4D6D]">{error}</p>}

      <button
        type="submit"
        disabled={loading || uploading}
        className="rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Continue to map"}
      </button>
    </form>
  );
}