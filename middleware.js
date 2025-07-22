// import { getToken } from "next-auth/jwt";
// import { NextResponse } from "next/server";

// export async function middleware(request) {
//   const token = await getToken({
//     req: request,
//     secret: process.env.NEXTAUTH_SECRET,
//   });

//   const { pathname } = request.nextUrl;

//   // Define protected routes
//   const isProtected = pathname.startsWith("/dashboard");
//   const isAdminRoute = pathname.startsWith("/dashboard/admin");
//   const isTeamManagerRoute = pathname.startsWith("/dashboard/team_manager");
//   const isMemberRoute = pathname.startsWith("/dashboard/member");
//   const isAdminOnlyRoute = pathname.startsWith("/dashboard/admin/addUser") || pathname.startsWith("/dashboard/admin/manageMeedian");
//   const isManagersCommonRoute = pathname.startsWith("/dashboard/managersCommon");

//   // If no token and trying to access protected routes, redirect to home
//   if (isProtected && !token) {
//     return NextResponse.redirect(new URL("/", request.url));
//   }

//   // If token exists, enforce role-based routing
//   if (token) {
//     const role = token.role;

//     // Members can only access /dashboard/member routes
//     if (role === "member" && !isMemberRoute) {
//       return NextResponse.redirect(new URL("/dashboard/member", request.url));
//     }

//     // Admins can access /dashboard/admin, /dashboard/managersCommon, and admin-only routes
//     if (role === "admin") {
//       if (isMemberRoute || isTeamManagerRoute) {
//         return NextResponse.redirect(new URL("/dashboard/admin", request.url));
//       }
//     }

//     // Team Managers can access /dashboard/team_manager and /dashboard/managersCommon
//     if (role === "team_manager") {
//       if (isMemberRoute || isAdminOnlyRoute) {
//         return NextResponse.redirect(new URL("/dashboard/team_manager", request.url));
//       }
//     }

//     // Admins and Team Managers can access /dashboard/managersCommon routes
//     if (isManagersCommonRoute && role !== "admin" && role !== "team_manager") {
//       return NextResponse.redirect(new URL("/dashboard/member", request.url));
//     }
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/dashboard/:path*"],
// };

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  console.log("🔍 MIDDLEWARE HIT:");
  console.log("🔗 Path:", pathname);
  console.log("📦 Token:", token);

  if (pathname.startsWith("/api")) return NextResponse.next();

  const isProtected = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isTeamManagerRoute = pathname.startsWith("/dashboard/team_manager");
  const isMemberRoute = pathname.startsWith("/dashboard/member");
  const isAdminOnlyRoute = pathname.startsWith("/dashboard/admin/addUser") || pathname.startsWith("/dashboard/admin/manageMeedian");
  const isManagersCommonRoute = pathname.startsWith("/dashboard/managersCommon");

  if (isProtected && !token) {
    console.warn("🚫 No token found. Redirecting to /");
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (token) {
    const role = token.role;

    if (role === "member" && !isMemberRoute) {
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }

    if (role === "admin" && (isMemberRoute || isTeamManagerRoute)) {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }

    if (role === "team_manager" && (isMemberRoute || isAdminOnlyRoute)) {
      return NextResponse.redirect(new URL("/dashboard/team_manager", request.url));
    }

    if (isManagersCommonRoute && role !== "admin" && role !== "team_manager") {
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
