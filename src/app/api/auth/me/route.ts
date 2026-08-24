import { getAuthUserFromRequest, serializeAuthUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: serializeAuthUser(user) });
}