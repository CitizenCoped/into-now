import { logActivity } from "@/lib/activity";
import { clearAuthCookie, getAuthUserFromRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (user) {
    logActivity("user.logout", { userId: user.id, phone: user.phone });
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}