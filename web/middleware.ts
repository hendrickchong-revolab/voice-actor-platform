import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const isManagerPath = (pathname: string) => pathname.startsWith("/manager");
const isAgentPath = (pathname: string) => pathname.startsWith("/agent");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/unauthorized"
  ) {
    return NextResponse.next();
  }

  if (!isManagerPath(pathname) && !isAgentPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const role = token.role;

  if (isManagerPath(pathname)) {
    if (role !== "MANAGER" && role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  if (isAgentPath(pathname)) {
    if (role !== "AGENT" && role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/agent/:path*", "/manager/:path*"],
};
