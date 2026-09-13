import { logActivity } from "@/lib/activity";
import { clearManagementCookie, getManagementAdminFromRequest } from "@/lib/managementAuth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const admin = await getManagementAdminFromRequest(request);
  const res = NextResponse.json({ ok: true });
  clearManagementCookie(res);
  if (admin) {
    logActivity("admin.logout", { metadata: { adminId: admin.id, username: admin.username } });
  }
  return res;
}
