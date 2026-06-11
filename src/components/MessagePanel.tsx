"use client";

import type { AuthUser } from "@/hooks/useAuth";
import type { ConversationSummary } from "@/hooks/useMessages";
import type { Message } from "@/lib/schema";
import AuthForm from "./AuthForm";
import ConversationList from "./ConversationList";
import ConversationThread from "./ConversationThread";

type PanelView = "inbox" | "thread";

type Props = {
  expanded: boolean;
  view: PanelView;
  activeConversationId: string | null;
  onExpandedChange: (expanded: boolean) => void;
  onViewChange: (view: PanelView) => void;
  onConversationSelect: (conversationId: string) => void;
  onBackToInbox: () => void;
  user: AuthUser | null;
  authLoading: boolean;
  onSendCode: (phone: string) => Promise<string>;
  onVerifyCode: (phone: string, code: string) => Promise<void>;
  onLogout: () => Promise<void>;
  conversations: ConversationSummary[];
  messages: Message[];
  loadingInbox: boolean;
  loadingThread: boolean;
  onSendMessage: (body: string) => Promise<void>;
  unreadCount: number;
};

export default function MessagePanel({
  expanded,
  view,
  activeConversationId,
  onExpandedChange,
  onViewChange,
  onConversationSelect,
  onBackToInbox,
  user,
  authLoading,
  onSendCode,
  onVerifyCode,
  onLogout,
  conversations,
  messages,
  loadingInbox,
  loadingThread,
  onSendMessage,
  unreadCount,
}: Props) {
  const panelPosition =
    "intonow-messages-panel fixed z-20 bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => onExpandedChange(true)}
        className={`${panelPosition} flex items-center gap-2 rounded-full border border-white/10 bg-[#0f0d18]/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition hover:border-[#22D3EE]/40`}
        aria-label="Open messages panel"
      >
        <span className="text-sm font-semibold text-[#22D3EE]">Messages</span>
        {unreadCount > 0 && (
          <span className="rounded-full bg-[#22D3EE]/20 px-2 py-0.5 text-xs font-medium text-[#22D3EE]">
            {unreadCount}
          </span>
        )}
        <span className="text-white/50" aria-hidden>
          ▲
        </span>
      </button>
    );
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  return (
    <aside
      className={`${panelPosition} flex max-h-[min(55vh,480px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0d18]/90 shadow-2xl backdrop-blur-xl ${
        view === "thread" ? "max-h-[min(70vh,560px)]" : ""
      }`}
      data-messages-panel-expanded="true"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#22D3EE]">Messages</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {user ? user.maskedPhone : "Sign in to chat"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => onLogout()}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/50 transition hover:text-white"
            >
              Log out
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onViewChange("inbox");
              onBackToInbox();
              onExpandedChange(false);
            }}
            className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/60 transition hover:text-white"
            aria-label="Minimize panel"
          >
            ▼
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pt-3">
        {authLoading ? (
          <p className="py-6 text-center text-sm text-white/30">Checking session...</p>
        ) : !user ? (
          <AuthForm onSendCode={onSendCode} onVerifyCode={onVerifyCode} />
        ) : view === "thread" && activeConversationId ? (
          <>
            <button
              type="button"
              onClick={() => {
                onViewChange("inbox");
                onBackToInbox();
              }}
              className="mb-3 shrink-0 text-left text-xs text-white/40 transition hover:text-white/70"
            >
              ← Back to conversations
            </button>
            <ConversationThread
              messages={messages}
              currentUserId={user.id}
              otherUser={activeConversation?.otherUser ?? null}
              loading={loadingThread}
              onSend={onSendMessage}
            />
          </>
        ) : (
          <>
            <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-white/40">
              Conversations
            </h3>
            <ConversationList
              conversations={conversations}
              loading={loadingInbox}
              onSelect={(id) => {
                onConversationSelect(id);
                onViewChange("thread");
              }}
            />
          </>
        )}
      </div>
    </aside>
  );
}