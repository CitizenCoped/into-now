import { NextRequest, NextResponse } from "next/server";
import { MANAGEMENT_COOKIE, verifyManagementToken } from "@/lib/managementJwt";

const PUBLIC_PAGE_EXACT = new Set(["/management/login", "/management/setup"]);
const PUBLIC_API_PREFIXES = ["/api/management/login", "/api/management/setup"];

function isPublic(pathname: string) {
  if (PUBLIC_PAGE_EXACT.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(MANAGEMENT_COOKIE)?.value;
  const session = token ? await verifyManagementToken(token) : null;

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/management/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/management", "/management/:path*", "/api/management/:path*"],
};
