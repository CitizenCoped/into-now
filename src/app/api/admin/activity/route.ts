import { isAdminAuthorized } from "@/lib/adminAuth";
import { getDb } from "@/lib/db";
import { activityLog } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(
    Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100,
    500
  );

  const rows = await getDb()
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return NextResponse.json({ activities: rows });
}