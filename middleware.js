import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { AUTH_SECRET } from "@/lib/auth.config";

// Edge-safe auth check: decode JWT without DB calls
export const middleware = async (req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Only guard dashboard
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  const secret = AUTH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  const token = await getToken({ req, secret });

  // Not signed in -> go to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Role-based routing
  const role = token.role;

  const isGeneralDashboard = pathname === "/dashboard";
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isTeamManagerRoute = pathname.startsWith("/dashboard/team_manager");
  const isMemberRoute = pathname.startsWith("/dashboard/member");
  const isAdminOnlyRoute = pathname.startsWith("/dashboard/admin/addUser");
  const isManageMeedian = pathname.startsWith("/dashboard/admin/manageMeedian");
  const isAdminClubRoute = pathname.startsWith("/dashboard/admin/admin-club");
  const isAdminStudentsRoute = pathname.startsWith("/dashboard/admin/students");
  const isManagersCommonRoute = pathname.startsWith("/dashboard/managersCommon");

  if (isGeneralDashboard) return; // everyone logged-in can view

  if (role === "member") {
    // Allow members into manageMeedian/admin-club/students when explicitly granted (API enforces finer grants)
    if (isManageMeedian || isAdminClubRoute || isAdminStudentsRoute) return;
    if (!isMemberRoute) {
      return NextResponse.redirect(new URL("/dashboard/member", nextUrl));
    }
  }

  if (role === "admin") {
    if (isTeamManagerRoute) {
      return NextResponse.redirect(new URL("/dashboard/admin", nextUrl));
    }
    // Admin can access managersCommon and admin routes including admin-only
    return;
  }

  if (role === "team_manager") {
    // Allow team managers into Manage Meedian; API + sidebar enforce granular access
    if (isManageMeedian || isAdminClubRoute || isAdminStudentsRoute) return;
    if (
      !isTeamManagerRoute &&
      !isManagersCommonRoute &&
      !isMemberRoute // allow shared pages if you have them
    ) {
      return NextResponse.redirect(new URL("/dashboard/team_manager", nextUrl));
    }
    if (isAdminOnlyRoute) {
      return NextResponse.redirect(new URL("/dashboard/team_manager", nextUrl));
    }
    return;
  }

  // Fallback: members only
  if (!isMemberRoute) {
    return NextResponse.redirect(new URL("/dashboard/member", nextUrl));
  }
  return NextResponse.next();
};

export default middleware;

export const config = {
  matcher: ["/dashboard/:path*"],
};
