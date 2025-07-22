"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function TeamManagerHistory() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "team_manager") {
      router.push(
        session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/team_manager/history");
        const data = await res.json();
        if (res.ok) {
          setHistory(data.history || []);
        } else {
          setError(data.error || "Failed to fetch history");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch history");
        setTimeout(() => setError(""), 3000);
      }
    };
    fetchHistory();
  }, []);

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-700"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Task History */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Team Manager Task History</h2>
          <div className="space-y-2">
            {history.length > 0 ? (
              history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-2 bg-gray-50 rounded-lg"
                >
                  <p className="text-sm font-medium text-gray-700">
                    {item.title}: {item.status} (Completed: {new Date(item.completedAt).toLocaleDateString()})
                  </p>
                  {item.comment && <p className="text-sm text-gray-600">{item.comment}</p>}
                </motion.div>
              ))
            ) : (
              <p className="text-sm text-gray-600">No history available.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}