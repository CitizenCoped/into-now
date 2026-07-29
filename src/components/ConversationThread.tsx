"use client";

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (expired) return;
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
          className={`h-2 w-2 rounded-full ${otherUser?.isOnline ? "bg-[#22FF66]" : "bg-white/20"}`}
          style={otherUser?.isOnline ? { boxShadow: "0 0 6px #22FF66" } : undefined}
        />
        <span className="font-semibold text-white">{otherUser?.displayLabel ?? "Chat"}</span>
        {otherUser?.isOnline && <span className="text-[10px] text-[#22FF66]">Online</span>}
        {expired && <span className="text-[10px] text-[#FF4D6D]">Expired</span>}
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
                  ? "ml-6 border-[#22D3EE]/20 bg-[#22D3EE]/10"
                  : "mr-6 border-white/5 bg-white/5"
              } ${isTruncated ? "cursor-pointer hover:border-white/15" : "cursor-default"} ${
                isHighlighted ? "ring-2 ring-[#22D3EE]/60 border-[#22D3EE]/40" : ""
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

      {expired ? (
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
            className="mb-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#22D3EE]/50"
          />
          {error && <p className="mb-2 text-xs text-[#FF4D6D]">{error}</p>}
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}