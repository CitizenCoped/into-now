"use client";

import { containsPhoneNumber, CONTACT_WARNING_MESSAGE } from "@/lib/contentScreens";
import { previewMessage } from "@/lib/messagePreview";
import type { ConversationSummary } from "@/hooks/useMessages";
import type { Message } from "@/lib/schema";
import { useEffect, useRef, useState } from "react";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
  messages: Message[];
  currentUserId: string;
  otherUser: ConversationSummary["otherUser"];
  loading: boolean;
  highlightMessageId?: string | null;
  onHighlightComplete?: () => void;
  onSend: (body: string) => Promise<void>;
};

export default function ConversationThread({
  messages,
  currentUserId,
  otherUser,
  loading,
  highlightMessageId,
  onHighlightComplete,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showContactWarning, setShowContactWarning] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledHighlight = useRef<string | null>(null);

  const expired = otherUser?.isExpired;

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
    if (!body) return;

    setSending(true);
    setError("");
    try {
      await onSend(body);
      setDraft("");
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
    if (!body) return;

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

          return (
            <button
              key={message.id}
              id={`message-${message.id}`}
              type="button"
              onClick={() => isTruncated && toggleExpanded(message.id)}
              className={`block w-full rounded-xl border px-3 py-2.5 text-left transition ${
                isMine
                  ? "ml-6 border-[#FF8A1E]/20 bg-[#FF8A1E]/10"
                  : "mr-6 border-white/5 bg-white/5"
              } ${isTruncated ? "cursor-pointer hover:border-white/15" : "cursor-default"} ${
                isHighlighted ? "ring-2 ring-[#FF8A1E]/60 border-[#FF8A1E]/40" : ""
              }`}
            >
              <p className="text-sm text-white whitespace-pre-wrap">
                {showPreview ? preview : message.body}
                {showPreview && "…"}
              </p>
              {isTruncated && (
                <span className="mt-1 block text-[10px] text-white/30">
                  {expanded ? "Tap to collapse" : "Tap to read more"}
                </span>
              )}
            </button>
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
        <form onSubmit={handleSend} className="mt-3 shrink-0 border-t border-white/5 pt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply..."
            rows={2}
            className="mb-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF8A1E]/50"
          />
          {error && <p className="mb-2 text-xs text-[#FF4D6D]">{error}</p>}
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}