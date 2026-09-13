import { getDb } from "@/lib/db";
import { requireManagementAdmin } from "@/lib/managementAuth";
import { activityLog } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const limit = Math.min(
    Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "200", 10) || 200,
    500
  );

  const rows = await getDb()
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return NextResponse.json({ activities: rows });
}
