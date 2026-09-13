import { getManagementAdminFromRequest } from "@/lib/managementAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const admin = await getManagementAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
  return NextResponse.json({ admin });
}
