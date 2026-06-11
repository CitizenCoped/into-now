import { getAuthUserFromRequest, maskPhone } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      maskedPhone: maskPhone(user.phone),
    },
  });
}