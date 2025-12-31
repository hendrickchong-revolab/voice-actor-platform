import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasNextAuthSessionCookie(req: NextRequest) {
  // NextAuth v4 cookie names vary by environment (secure prefix in prod).
  return Boolean(
    req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value,
  );
}

export function middleware(req: NextRequest) {
  // Keep middleware tiny/fast: only gate on presence of a session cookie.
  // Role enforcement is handled in server layouts for /manager and /agent.
  if (!hasNextAuthSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/agent/:path*", "/manager/:path*"],
};
