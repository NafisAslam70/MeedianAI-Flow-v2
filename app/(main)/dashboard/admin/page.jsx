// FILE: app/(main)/dashboard/admin/page.jsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      router.push("/dashboard/managersCommon");
    } else if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "team_manager" ? "/dashboard/managersCommon" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  return null; // No UI, just redirect
}