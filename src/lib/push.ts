import { getDb } from "@/lib/db";
import { pushPreferences, pushSubscriptions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@intonow.app";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function getPushPreferences(userId: string) {
  const [prefs] = await getDb()
    .select()
    .from(pushPreferences)
    .where(eq(pushPreferences.userId, userId))
    .limit(1);

  return (
    prefs ?? {
      userId,
      notifyMessages: true,
      notifyPresence: true,
    }
  );
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };

  const subs = await getDb()
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url ?? "/",
            tag: payload.tag,
            icon: "/logo.svg",
          })
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    })
  );

  return { sent, failed };
}