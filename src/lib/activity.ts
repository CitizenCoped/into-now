import { getDb } from "@/lib/db";
import { activityLog } from "@/lib/schema";

export type ActivityPayload = {
  userId?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown>;
};

function persistActivity(
  action: string,
  payload: ActivityPayload
): Promise<void> {
  return getDb()
    .insert(activityLog)
    .values({
      action,
      userId: payload.userId ?? null,
      phone: payload.phone ?? null,
      metadata: payload.metadata ?? null,
    })
    .then(() => undefined);
}

export function logActivity(action: string, payload: ActivityPayload = {}) {
  const entry = {
    action,
    userId: payload.userId ?? null,
    phone: payload.phone ?? null,
    metadata: payload.metadata ?? null,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify({ type: "activity", ...entry }));

  void persistActivity(action, payload).catch((error) => {
    console.error("activity_log insert failed:", error);
  });
}