"use client";
import { useSession } from "next-auth/react";

export default function MyPerformance() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <div>Loading...</div>;
  if (!["member", "team_manager"].includes(role)) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">My Performance</h1>
      <p>Coming soon: Performance metrics, charts, reviews, etc.</p>
    </div>
  );
}