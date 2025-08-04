"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import SharedDashboard from "@/components/SharedDashboard";
import ManagersCommonDashboard from "../managersCommon/page";

/* ---------------- fetch helper ---------------- */
const fetcher = (url) => fetch(url).then((r) => r.json());

/* ------------ user-picker component ----------- */
function UserSelection({ selectedUserId, onSelect }) {
  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const users = usersData?.users || [];

  return (
    <select
      value={selectedUserId ?? ""}
      onChange={(e) => onSelect(Number(e.target.value) || null)}
      className="w-52 px-3 py-2 border border-indigo-300 rounded-lg
                 text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">Select user…</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} ({u.role})
        </option>
      ))}
    </select>
  );
}

/* ---------------- main page ------------------- */
export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [view, setView] = useState("team"); // "team" | "user"
  const [selectedUserId, setSelectedUserId] = useState(null);

  /* redirect non-admins ------------------------------------------------ */
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "team_manager"
          ? "/dashboard/team_manager"
          : "/dashboard/member"
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
        <motion.div className="text-2xl font-semibold text-gray-700 flex items-center gap-2">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-6 h-6 border-4 border-t-teal-600 border-teal-200 rounded-full"
          />
          Loading…
        </motion.div>
      </motion.div>
    );
  }

  /* ------------------- header bar ------------------- */
  const Header = (
    <div className="absolute top-4 left-0 right-0 flex justify-center z-50">
      <div className="bg-gray-100 rounded-lg p-1 flex items-center gap-4 shadow-lg">
        {/* view-switch buttons */}
        <div className="flex gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setView("team");
              setSelectedUserId(null); // reset picker when leaving
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors
              ${
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
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors
              ${
                view === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
          >
            User Dashboards
          </motion.button>
        </div>

        {/* user selector – only when “user” tab is active */}
        {view === "user" && (
          <UserSelection
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />
        )}
      </div>
    </div>
  );

  /* ------------------- page body ------------------- */
  return (
    <>
      {Header}

      <AnimatePresence mode="wait">
        {view === "team" && (
          <motion.div
            key="team"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            <ManagersCommonDashboard disableUserSelect />
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
            <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50
                            p-8 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-2xl shadow-2xl
                              p-8 flex flex-col gap-8 overflow-y-auto">
                {selectedUserId ? (
                  <SharedDashboard
                    key={selectedUserId}
                    role="member"
                    viewUserId={selectedUserId}
                    embed
                  />
                ) : (
                  <p className="text-center text-gray-600">
                    Select a user to view their dashboard.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
