"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import UserDashboardView from "./UserDashboardView"; // Adjust path as needed; this is the modified PersonalView component

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedUserId, setSelectedUserId] = useState(null);

  const { data: usersData } = useSWR("/api/member/users", fetcher);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "team_manager" ? "/dashboard/team_manager" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  if (status === "loading") {
    return <div className="fixed inset-0 flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  const users = usersData?.users || [];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center">
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-indigo-800">Admin Dashboard - View User Dashboards</h1>
        <select
          value={selectedUserId || ""}
          onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
          className="w-1/4 px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white shadow-sm"
        >
          <option value="">Select User</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
        {selectedUserId && <UserDashboardView userId={selectedUserId} />}
      </div>
    </div>
  );
}