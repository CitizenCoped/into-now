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
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {conversations.map((convo) => (
        <button
          key={convo.id}
          type="button"
          onClick={() => onSelect(convo.id)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
        >
              <ProfileAvatar
                photoUrl={convo.otherUser?.photoUrl}
                displayName={convo.otherUser?.displayName}
                userId={convo.otherUser?.id}
                size="sm"
              />
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              convo.otherUser?.isOnline ? "bg-[#22FF66]" : "bg-white/20"
            }`}
            style={convo.otherUser?.isOnline ? { boxShadow: "0 0 6px #22FF66" } : undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-white">
                {convo.otherUser?.displayLabel ?? "Unknown"}
              </span>
              {convo.otherUser?.isExpired && (
                <span className="shrink-0 text-[10px] text-[#FF4D6D]">expired</span>
              )}
            </div>
            {convo.lastMessage && (
              <p className="truncate text-xs text-white/50 line-clamp-1">
                {convo.lastMessage.preview}
                {convo.lastMessage.isTruncated ? "…" : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {convo.lastMessage && (
              <span className="text-[10px] text-white/30">
                {formatRelativeTime(convo.lastMessage.createdAt)}
              </span>
            )}
            {convo.unreadCount > 0 && (
              <span className="rounded-full bg-[#FF7A1A] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-black">
                {convo.unreadCount}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
