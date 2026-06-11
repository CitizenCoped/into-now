const SESSION_KEY = "intonow_session_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}