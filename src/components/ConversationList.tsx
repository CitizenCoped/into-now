"use client";

import { formatRelativeTime } from "@/lib/messagePreview";
import type { ConversationSummary } from "@/hooks/useMessages";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
  conversations: ConversationSummary[];
  loading: boolean;
  onSelect: (conversationId: string) => void;
};

export default function ConversationList({ conversations, loading, onSelect }: Props) {
  if (loading) {
    return <p className="py-6 text-center text-sm text-white/30">Loading conversations...</p>;
  }

  if (conversations.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-white/30">
        No conversations yet. Message someone on the map or from a post.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      {conversations.map((convo) => (
        <button
          key={convo.id}
          type="button"
          onClick={() => onSelect(convo.id)}
          className="w-full rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-white/15 hover:bg-white/8"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ProfileAvatar
                photoUrl={convo.otherUser?.photoUrl}
                displayName={convo.otherUser?.displayName}
                size="sm"
              />
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  convo.otherUser?.isOnline ? "bg-[#22FF66]" : "bg-white/20"
                }`}
                style={
                  convo.otherUser?.isOnline ? { boxShadow: "0 0 6px #22FF66" } : undefined
                }
              />
              <span className="truncate font-semibold text-white">
                {convo.otherUser?.displayLabel ?? "Unknown"}
              </span>
            </div>
            {convo.lastMessage && (
              <span className="shrink-0 text-[10px] text-white/30">
                {formatRelativeTime(convo.lastMessage.createdAt)}
              </span>
            )}
          </div>
          {convo.otherUser?.isExpired && (
            <p className="mt-1 text-[10px] text-[#FF4D6D]">This user has expired</p>
          )}
          {convo.lastMessage && (
            <p className="mt-1.5 text-xs text-white/50 line-clamp-2">
              {convo.lastMessage.preview}
              {convo.lastMessage.isTruncated ? "…" : ""}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}