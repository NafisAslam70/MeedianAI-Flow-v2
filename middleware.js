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

  console.log("🔐 Middleware check:");
  console.log("⛳ Path:", pathname);
  console.log("🧾 Token:", token);

  // ✅ Allow API routes to bypass auth checks
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // ✅ Route classifications
  const isProtected = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isTeamManagerRoute = pathname.startsWith("/dashboard/team_manager");
  const isMemberRoute = pathname.startsWith("/dashboard/member");
  const isAdminOnlyRoute =
    pathname.startsWith("/dashboard/admin/addUser") ||
    pathname.startsWith("/dashboard/admin/manageMeedian");
  const isManagersCommonRoute = pathname.startsWith("/dashboard/managersCommon");

  // ✅ If user not logged in and accessing protected route
  if (isProtected && !token) {
    console.warn("🚫 No token found. Redirecting to home.");
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ✅ If token exists, enforce role-based routing
  if (token) {
    const role = token.role;
    const teamType = token.team_manager_type;

    // 🛑 If role is not set (edge case)
    if (!role) {
      console.warn("⚠️ Role missing in token. Redirecting to login.");
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // ✅ Member access
    if (role === "member" && !isMemberRoute) {
      console.log("🔁 Redirecting member to /dashboard/member");
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }

    // ✅ Admin access
    if (role === "admin") {
      if (isMemberRoute || isTeamManagerRoute) {
        console.log("🔁 Redirecting admin to /dashboard/admin");
        return NextResponse.redirect(new URL("/dashboard/admin", request.url));
      }
    }

    // ✅ Team Manager access
    if (role === "team_manager") {
      if (isMemberRoute || isAdminOnlyRoute) {
        console.log("🔁 Redirecting team manager to /dashboard/team_manager");
        return NextResponse.redirect(new URL("/dashboard/team_manager", request.url));
      }
    }

    // ✅ ManagersCommon access (only admin or team_manager)
    if (isManagersCommonRoute && role !== "admin" && role !== "team_manager") {
      console.log("🔁 Redirecting unauthorized user from /dashboard/managersCommon to /dashboard/member");
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }
  }

  // ✅ If all is good
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
