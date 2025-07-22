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

import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get("__Secure-next-auth.session-token");

  let token = null;

  if (cookie) {
    try {
      const verified = await jwtVerify(cookie.value, secret);
      token = verified.payload;
    } catch (err) {
      console.error("Token verification failed:", err.message);
    }
  }

  console.log("🔍 MIDDLEWARE HIT:");
  console.log("🔗 Path:", pathname);
  console.log("📦 Token:", token);
  console.log("🍪 Cookie:", cookie?.value.slice(0, 50) + "...");

  // 🔐 Same access logic as before...
  const isProtected = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isTeamManagerRoute = pathname.startsWith("/dashboard/team_manager");
  const isMemberRoute = pathname.startsWith("/dashboard/member");
  const isAdminOnlyRoute =
    pathname.startsWith("/dashboard/admin/addUser") ||
    pathname.startsWith("/dashboard/admin/manageMeedian");
  const isManagersCommonRoute = pathname.startsWith("/dashboard/managersCommon");

  if (isProtected && !token) {
    console.warn("🚫 No token found. Redirecting to /");
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (token) {
    const role = token.role;

    if (role === "member" && !isMemberRoute) {
      return NextResponse.redirect(new URL("/dashboard/member", req.url));
    }

    if (role === "admin" && (isMemberRoute || isTeamManagerRoute)) {
      return NextResponse.redirect(new URL("/dashboard/admin", req.url));
    }

    if (role === "team_manager" && (isMemberRoute || isAdminOnlyRoute)) {
      return NextResponse.redirect(new URL("/dashboard/team_manager", req.url));
    }

    if (isManagersCommonRoute && role !== "admin" && role !== "team_manager") {
      return NextResponse.redirect(new URL("/dashboard/member", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
