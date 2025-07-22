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

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = [
  "/dashboard/admin",
  "/dashboard/team_manager",
  "/dashboard/residential_staff",
  "/dashboard/non_residential_staff",
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Skip protection if route not protected
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  // Use next-auth's getToken() for decoding encrypted session
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  console.log("🔍 MIDDLEWARE HIT:");
  console.log("🔗 Path:", pathname);
  console.log("📦 Token:", token);
  console.log("🍪 Cookies:", req.cookies.getAll());

  if (!token) {
    console.log("🚫 No token found. Redirecting to /login");
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const role = token.role;

  if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
    console.log(`🚫 Role ${role} not authorized for /dashboard/admin`);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/team_manager") && role !== "team_manager") {
    console.log(`🚫 Role ${role} not authorized for /dashboard/team_manager`);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/residential_staff") && role !== "residential_staff") {
    console.log(`🚫 Role ${role} not authorized for /dashboard/residential_staff`);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/non_residential_staff") && role !== "non_residential_staff") {
    console.log(`🚫 Role ${role} not authorized for /dashboard/non_residential_staff`);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};