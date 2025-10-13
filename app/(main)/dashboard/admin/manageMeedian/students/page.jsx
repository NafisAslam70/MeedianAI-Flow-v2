"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/admin/students");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
      Redirecting to the full-screen Students Manager…
    </div>
  );
}
