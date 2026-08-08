import { getAuthUserFromRequest } from "@/lib/auth";
import { isConversationParticipant } from "@/lib/conversations";
import { getPusherServer, PRESENCE_CHANNEL, userChannel } from "@/lib/pusher";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return NextResponse.json({ error: "Invalid auth request" }, { status: 400 });
  }

  const allowedUserChannel = userChannel(user.id);
  let authorized = channelName === allowedUserChannel;

  if (!authorized && channelName.startsWith("private-conversation-")) {
    const conversationId = channelName.replace("private-conversation-", "");
    authorized = await isConversationParticipant(conversationId, user.id);
  }

  // The shared live-map channel: any signed-in user may listen.
  const isPresenceChannel = channelName === PRESENCE_CHANNEL;
  if (!authorized && isPresenceChannel) {
    authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Pusher not configured" }, { status: 503 });
  }

  // presence-* channels require member data in the signature.
  const auth = isPresenceChannel
    ? pusher.authorizeChannel(socketId, channelName, { user_id: user.id })
    : pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(auth);
}