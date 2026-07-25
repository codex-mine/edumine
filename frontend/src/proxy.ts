import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ROLES, isRole, roleCanAccess } from "@/lib/auth/roles";

const SESSION_ROLE_COOKIE = "session_role";
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

/** Optimistic, cookie-presence-only routing (Next.js docs: "Optimistic checks with
 * Proxy"). This never decodes/verifies the JWT — it only reads the non-sensitive
 * `session_role` hint cookie the backend sets alongside the real httpOnly tokens.
 * The actual authorization decision is always re-verified server-side (FastAPI RBAC
 * guards) and client-side (AuthProvider + dashboard layout), so a stale or forged
 * hint here can only misroute the UI, never grant real access. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionRole = request.cookies.get(SESSION_ROLE_COOKIE)?.value;
  const isAuthenticated = Boolean(sessionRole && isRole(sessionRole));

  const firstSegment = pathname.split("/")[1] ?? "";
  const isRoleDashboard = isRole(firstSegment);

  if (isRoleDashboard && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isRoleDashboard && isAuthenticated && !roleCanAccess(sessionRole as (typeof ROLES)[number], firstSegment)) {
    const forbiddenUrl = new URL("/forbidden", request.url);
    forbiddenUrl.searchParams.set("required", firstSegment);
    return NextResponse.redirect(forbiddenUrl);
  }

  if (AUTH_PAGES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL(`/${sessionRole}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
