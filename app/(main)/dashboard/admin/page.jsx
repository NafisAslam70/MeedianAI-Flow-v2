"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import UserDashboardView from "./UserDashboardView"; // Adjust path if necessary
import ManagersCommonDashboard from "../managersCommon/page"; // Adjust path if necessary

const fetcher = (url) => fetch(url).then((res) => res.json());

const UserSelection = ({ onSelect, selectedUserId }) => {
  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const users = usersData?.users || [];

  return (
    <div className="flex justify-end">
      <select
        value={selectedUserId || ""}
        onChange={(e) => onSelect(Number(e.target.value) || null)}
        className="w-48 px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white shadow-sm"
      >
        <option value="">Select User</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role})
          </option>
        ))}
      </select>
    </div>
  );
};

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [view, setView] = useState("team"); // Default to "team"
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "team_manager" ? "/dashboard/team_manager" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-100"
      >
        <motion.div
          className="text-2xl font-semibold text-gray-700 flex items-center gap-2"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-6 h-6 border-4 border-t-teal-600 border-teal-200 rounded-full"
          />
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  return (
    <>
      {/* View Switch Tabs */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-50">
        <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView("team")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
              view === "team"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Team Tasks
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView("user")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
              view === "user"
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            User Dashboards
          </motion.button>
        </div>
      </div>

      {/* Conditional View Render */}
      <AnimatePresence mode="wait">
        {view === "team" && (
          <motion.div
            key="team"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            <ManagersCommonDashboard disableUserSelect={true} />
          </motion.div>
        )}
        {view === "user" && (
          <motion.div
            key="user"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
                <UserSelection onSelect={setSelectedUserId} selectedUserId={selectedUserId} />
                {selectedUserId ? (
                  <UserDashboardView userId={selectedUserId} />
                ) : (
                  <p className="text-center text-gray-600">Select a user to view their dashboard.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}