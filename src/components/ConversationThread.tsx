"use client";

import { containsPhoneNumber, CONTACT_WARNING_MESSAGE } from "@/lib/contentScreens";
import { previewMessage } from "@/lib/messagePreview";
import type { ConversationSummary } from "@/hooks/useMessages";
import { usePhotoLibrary } from "@/hooks/usePhotoLibrary";
import { FEATURES } from "@/lib/flags";
import type { MessageView } from "@/lib/photoTypes";
import { MAX_PHOTOS_PER_MESSAGE } from "@/lib/photoTypes";
import { useEffect, useRef, useState } from "react";
import MessagePhotos from "./MessagePhotos";
import PhotoSheet from "./PhotoSheet";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
  messages: MessageView[];
  currentUserId: string;
  otherUser: ConversationSummary["otherUser"];
  loading: boolean;
  highlightMessageId?: string | null;
  onHighlightComplete?: () => void;
  onSend: (body: string, photoIds: string[]) => Promise<void>;
  onRevealPhoto: (messageId: string, photoId: string) => void;
  onToggleHidePhoto: (messageId: string, photoId: string, current: boolean) => void;
};

export default function ConversationThread({
  messages,
  currentUserId,
  otherUser,
  loading,
  highlightMessageId,
  onHighlightComplete,
  onSend,
  onRevealPhoto,
  onToggleHidePhoto,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showContactWarning, setShowContactWarning] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledHighlight = useRef<string | null>(null);

  const photosEnabled = FEATURES.photoBlur;
  const library = usePhotoLibrary(photosEnabled);

  const expired = otherUser?.isExpired;

  // Prune selections whose photo left the library (deleted / rejected).
  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        library.photos.some((p) => p.id === id && p.status === "ready")
      )
    );
  }, [library.photos]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(photoId)) return prev.filter((id) => id !== photoId);
      if (prev.length >= MAX_PHOTOS_PER_MESSAGE) return prev;
      return [...prev, photoId];
    });
  }

  useEffect(() => {
    if (!highlightMessageId) {
      handledHighlight.current = null;
    }
  }, [highlightMessageId]);

  useEffect(() => {
    if (!highlightMessageId || loading) return;
    if (handledHighlight.current === highlightMessageId) return;

    const target = messages.find((m) => m.id === highlightMessageId);
    if (!target) return;

    handledHighlight.current = highlightMessageId;

    const { isTruncated } = previewMessage(target.body);
    if (isTruncated) {
      setExpandedIds((prev) => new Set(prev).add(highlightMessageId));
    }

    requestAnimationFrame(() => {
      const el = document.getElementById(`message-${highlightMessageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(highlightMessageId);

      window.setTimeout(() => {
        setHighlightedId(null);
        onHighlightComplete?.();
      }, 2500);
    });
  }, [highlightMessageId, loading, messages, onHighlightComplete]);

  async function sendDraft() {
    const body = draft.trim();
    const photoIds = selectedIds;
    if (!body && photoIds.length === 0) return;

    setSending(true);
    setError("");
    try {
      await onSend(body, photoIds);
      setDraft("");
      setSelectedIds([]);
      setSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (expired || blocked) return;
    const body = draft.trim();
    if (!body && selectedIds.length === 0) return;

    // Contact-info warning: advise, never block. "Send Anyway" sends as typed.
    if (containsPhoneNumber(body)) {
      setShowContactWarning(true);
      return;
    }

    await sendDraft();
  }

  async function handleBlock() {
    if (!otherUser?.id || blocking) return;
    if (
      !window.confirm(
        `Block ${otherUser.displayLabel ?? "this user"}? They won't be able to message you, and you won't see each other's posts.`
      )
    ) {
      return;
    }
    setBlocking(true);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: otherUser.id }),
      });
      if (!res.ok) throw new Error();
      setBlocked(true);
    } catch {
      setError("Couldn't block right now. Try again.");
    } finally {
      setBlocking(false);
    }
  }

  const attachActive = sheetOpen || selectedIds.length > 0;
  const sendDisabled = sending || (!draft.trim() && selectedIds.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center gap-2 border-b border-white/5 pb-3">
        <ProfileAvatar
          photoUrl={otherUser?.photoUrl}
          displayName={otherUser?.displayName}
          userId={otherUser?.id}
          size="sm"
        />
        <span
          className={`h-2 w-2 rounded-full ${otherUser?.isOnline ? "bg-[#FF9E2C]" : "bg-white/20"}`}
          style={otherUser?.isOnline ? { boxShadow: "0 0 6px #FF9E2C" } : undefined}
        />
        <span className="font-semibold text-white">{otherUser?.displayLabel ?? "Chat"}</span>
        {otherUser?.isOnline && <span className="text-[10px] text-[#FF9E2C]">Online</span>}
        {expired && <span className="text-[10px] text-[#FF4D6D]">Expired</span>}
        {otherUser?.id && !blocked && (
          <button
            type="button"
            onClick={handleBlock}
            disabled={blocking}
            className="ml-auto shrink-0 text-[10px] text-white/25 transition hover:text-[#FF4D6D]"
          >
            {blocking ? "Blocking..." : "Block"}
          </button>
        )}
        {blocked && <span className="ml-auto text-[10px] text-[#FF4D6D]">Blocked</span>}
      </div>

      {otherUser?.statement && (
        <p className="mb-3 shrink-0 text-xs text-white/50">{otherUser.statement}</p>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading && messages.length === 0 && (
          <p className="py-4 text-center text-sm text-white/30">Loading messages...</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-4 text-center text-sm text-white/30">Say hi — start the conversation.</p>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          const expanded = expandedIds.has(message.id);
          const { preview, isTruncated } = previewMessage(message.body);
          const showPreview = isTruncated && !expanded;
          const isHighlighted = highlightedId === message.id;
          const photos = message.photos ?? [];
          const hasText = message.body.trim().length > 0;

          return (
            // A div (not a button) — photo tiles and the eye toggle are
            // interactive children, and buttons can't nest.
            <div
              key={message.id}
              id={`message-${message.id}`}
              onClick={() => isTruncated && toggleExpanded(message.id)}
              className={`block w-[calc(100%-1.5rem)] rounded-xl border px-3 py-2.5 text-left transition ${
                isMine
                  ? "ml-6 border-[#FF8A1E]/20 bg-[#FF8A1E]/10"
                  : "mr-6 border-white/5 bg-white/5"
              } ${isTruncated ? "cursor-pointer hover:border-white/15" : "cursor-default"} ${
                isHighlighted ? "ring-2 ring-[#FF8A1E]/60 border-[#FF8A1E]/40" : ""
              }`}
            >
              {hasText && (
                <p className="text-sm text-white whitespace-pre-wrap">
                  {showPreview ? preview : message.body}
                  {showPreview && "…"}
                </p>
              )}
              <MessagePhotos
                photos={photos}
                isMine={isMine}
                hasText={hasText}
                onReveal={(photoId) => onRevealPhoto(message.id, photoId)}
                onToggleHide={(photoId, current) =>
                  onToggleHidePhoto(message.id, photoId, current)
                }
              />
              {isTruncated && (
                <span className="mt-1 block text-[10px] text-white/30">
                  {expanded ? "Tap to collapse" : "Tap to read more"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {showContactWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0d18] p-5 shadow-2xl">
            <p className="text-sm text-white/90">{CONTACT_WARNING_MESSAGE}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowContactWarning(false)}
                className="flex-1 rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2 text-sm font-semibold text-[#06040c] transition hover:brightness-110"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowContactWarning(false);
                  await sendDraft();
                }}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/60 transition hover:text-white"
              >
                Send Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {blocked ? (
        <p className="mt-3 shrink-0 text-center text-xs text-[#FF4D6D]">
          You blocked this user. They can no longer message you.
        </p>
      ) : expired ? (
        <p className="mt-3 shrink-0 text-center text-xs text-[#FF4D6D]">
          This user&apos;s anonymous session has ended.
        </p>
      ) : (
        <div className="mt-3 shrink-0">
          {/* PhotoSheet bleeds to the panel edges (parent pads 1rem). */}
          {photosEnabled && sheetOpen && (
            <div className="-mx-4">
              <PhotoSheet
                photos={library.photos}
                previewUrls={library.previewUrls}
                selectedIds={selectedIds}
                error={library.error}
                onToggleSelect={toggleSelect}
                onUpload={library.uploadPhoto}
                onDelete={library.deletePhoto}
              />
            </div>
          )}
          <form onSubmit={handleSend} className="border-t border-white/5 pt-3">
            {error && <p className="mb-2 text-xs text-[#FF4D6D]">{error}</p>}
            <div className="flex items-end gap-2">
              {photosEnabled && (
                <button
                  type="button"
                  title="Attach photos"
                  aria-expanded={sheetOpen}
                  onClick={() => setSheetOpen((open) => !open)}
                  className="flex shrink-0 items-center justify-center transition"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(255,255,255,.04)",
                    border: `1px solid ${
                      attachActive ? "rgba(255,138,30,.5)" : "rgba(255,255,255,.1)"
                    }`,
                    color: attachActive ? "#FF8A1E" : "rgba(255,255,255,.5)",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </button>
              )}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reply..."
                rows={1}
                className="min-w-0 flex-1 resize-none rounded-[10px] border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF8A1E]/50"
                style={{ paddingTop: 9, paddingBottom: 9 }}
              />
              <button
                type="submit"
                disabled={sendDisabled}
                className="shrink-0 rounded-[10px] bg-gradient-to-r from-[#FFB03A] to-[#F56A00] text-sm font-bold text-[#06040c] transition hover:brightness-110 disabled:opacity-[.45]"
                style={{ padding: "9px 16px" }}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
