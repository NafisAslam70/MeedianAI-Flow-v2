"use client";
import { useSession } from "next-auth/react";

export default function CloseMyDay() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <div>Loading...</div>;
  if (!["member", "team_manager"].includes(role)) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Close My Day</h1>
      <p>Coming soon: Functionality to close your day, submit reports, etc.</p>
    </div>
  );
}