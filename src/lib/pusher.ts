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

export const PRESENCE_CHANNEL = "presence-into-now";
export const PRESENCE_EVENT = "presence-update";
export const PRESENCE_TTL_MS = 45_000;