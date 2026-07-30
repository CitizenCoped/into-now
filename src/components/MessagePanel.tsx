"use client";

import type { AuthUser } from "@/hooks/useAuth";
import type { ConversationSummary } from "@/hooks/useMessages";
import type { PushPreferences } from "@/hooks/usePushNotifications";
import type { Message } from "@/lib/schema";
import ConversationList from "./ConversationList";
import ConversationThread from "./ConversationThread";
import CornerControl from "./CornerControl";
import PhoneAuthForm from "./PhoneAuthForm";
import PushSettings from "./PushSettings";

type PanelView = "inbox" | "thread";

type Props = {
  expanded: boolean;
  view: PanelView;
  activeConversationId: string | null;
  highlightMessageId: string | null;
  onHighlightComplete: () => void;
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
  pushPermission: NotificationPermission;
  pushSubscribed: boolean;
  pushPreferences: PushPreferences;
  pushLoading: boolean;
  pushError: string;
  onEnablePush: () => Promise<void>;
  onDisablePush: () => Promise<void>;
  onPushPreferencesChange: (next: Partial<PushPreferences>) => Promise<void>;
};

function sessionLabel(user: AuthUser) {
  if (user.maskedPhone) return user.maskedPhone;
  if (user.displayLabel) return user.displayLabel;
  return "Signed in";
}

export default function MessagePanel({
  expanded,
  view,
  activeConversationId,
  highlightMessageId,
  onHighlightComplete,
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
  pushPermission,
  pushSubscribed,
  pushPreferences,
  pushLoading,
  pushError,
  onEnablePush,
  onDisablePush,
  onPushPreferencesChange,
}: Props) {
  const panelPosition =
    "intonow-messages-panel fixed z-20 bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]";

  if (!expanded) {
    return (
      <CornerControl
        position="bottom-left"
        onClick={() => onExpandedChange(true)}
        ariaLabel="Open messages panel"
        accentColor="#FF8A1E"
        icon={
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        }
        badge={
          unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#FF8A1E] px-1 text-[10px] font-bold text-[#06040c]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : undefined
        }
      />
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
          <p className="text-sm font-semibold text-[#FF8A1E]">Messages</p>
          <p className="mt-0.5 truncate text-[11px] text-white/40">
            {user ? sessionLabel(user) : "Sign in to chat"}
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

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          view === "inbox" ? "p-3 pt-2" : "p-4 pt-3"
        }`}
      >
        {authLoading ? (
          <p className="py-6 text-center text-sm text-white/30">Checking session...</p>
        ) : !user ? (
          <PhoneAuthForm onSendCode={onSendCode} onVerifyCode={onVerifyCode} />
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
              highlightMessageId={highlightMessageId}
              onHighlightComplete={onHighlightComplete}
              onSend={onSendMessage}
            />
          </>
        ) : (
          <>
            <h3 className="mb-1.5 shrink-0 text-xs font-semibold uppercase tracking-wider text-white/40">
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
            <PushSettings
              permission={pushPermission}
              subscribed={pushSubscribed}
              preferences={pushPreferences}
              loading={pushLoading}
              error={pushError}
              onEnable={onEnablePush}
              onDisable={onDisablePush}
              onPreferencesChange={onPushPreferencesChange}
            />
          </>
        )}
      </div>
    </aside>
  );
}