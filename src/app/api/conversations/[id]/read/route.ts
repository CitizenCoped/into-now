import { getAuthUserFromRequest } from "@/lib/auth";
import { isConversationParticipant, markConversationRead } from "@/lib/conversations";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isConversationParticipant(params.id, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markConversationRead(params.id, user.id);

  return NextResponse.json({ ok: true });
}
