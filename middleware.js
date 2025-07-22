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

// Routes that need a valid session
const protectedRoutes = [
  "/dashboard/admin",
  "/dashboard/team_manager",
  "/dashboard/residential_staff",
  "/dashboard/non_residential_staff",
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Skip protection if route not in list
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (!isProtected) return NextResponse.next();

  // Decrypt the JWT cookie
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    // leave `cookieName` unset so it works for both dev & prod names
  });

  if (!token) {
    // Not logged in → send to /login
    const loginURL = req.nextUrl.clone();
    loginURL.pathname = "/login";
    loginURL.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginURL);
  }

  // Role‑based guards
  const role = token.role;

  if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/team_manager") && role !== "team_manager") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/residential_staff") && role !== "residential_staff") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/non_residential_staff") && role !== "non_residential_staff") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // All good
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
