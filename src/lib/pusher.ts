import Pusher from "pusher";

let pusherServer: Pusher | null = null;

export function getPusherServer() {
  if (pusherServer) return pusherServer;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? "us3";

  if (!appId || !key || !secret) return null;

  pusherServer = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return pusherServer;
}

export { PRESENCE_CHANNEL, PRESENCE_EVENT, PRESENCE_TTL_MS } from "./presenceConfig";

export const MESSAGE_EVENT = "message-new";

export function userChannel(userId: string) {
  return `private-user-${userId}`;
}

export function conversationChannel(conversationId: string) {
  return `private-conversation-${conversationId}`;
}