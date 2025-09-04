
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // Allow API routes to bypass middleware
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Define protected routes
  const isProtected = pathname.startsWith("/dashboard");
  const isGeneralDashboard = pathname === "/dashboard"; // Allow general dashboard for all logged-in users
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isTeamManagerRoute = pathname.startsWith("/dashboard/team_manager");
  const isMemberRoute = pathname.startsWith("/dashboard/member");
  const isAdminOnlyRoute = pathname.startsWith("/dashboard/admin/addUser") || pathname.startsWith("/dashboard/admin/manageMeedian");
  const isManagersCommonRoute = pathname.startsWith("/dashboard/managersCommon");

  // If no token and trying to access protected routes, redirect to home
  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow general dashboard for all logged-in users
  if (isGeneralDashboard && token) {
    return NextResponse.next();
  }

  // If token exists, enforce role-based routing for other dashboard paths
  if (token) {
    const role = token.role;

    // Members can only access /dashboard/member routes
    if (role === "member" && !isMemberRoute && !isGeneralDashboard) {
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }

    // Admins can access /dashboard/admin, /dashboard/managersCommon, and admin-only routes
    if (role === "admin") {
      if (isTeamManagerRoute) {
        return NextResponse.redirect(new URL("/dashboard/admin", request.url));
      }
    }

    // Team Managers can access /dashboard/team_manager, /dashboard/managersCommon, and /dashboard/member (shared pages)
    if (role === "team_manager") {
      if (!isTeamManagerRoute && !isManagersCommonRoute && !isMemberRoute && !isGeneralDashboard) {
        return NextResponse.redirect(new URL("/dashboard/team_manager", request.url));
      }
      if (isAdminOnlyRoute) {
        return NextResponse.redirect(new URL("/dashboard/team_manager", request.url));
      }
    }

    // Admins and Team Managers can access /dashboard/managersCommon routes
    if (isManagersCommonRoute && role !== "admin" && role !== "team_manager") {
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
