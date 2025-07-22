"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AdminHistory() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  // Redirect if not admin
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "team_manager" ? "/dashboard/team_manager" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/admin/history");
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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-teal-50 to-gray-100 p-3">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-1"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Task History</h2>
        <div className="space-y-2">
          {history.length > 0 ? (
            history.map((item) => (
              <div key={item.id} className="p-2 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700">
                  {item.title}: {item.status} (Completed: {new Date(item.completedAt).toLocaleDateString()})
                </p>
                {item.comment && <p className="text-sm text-gray-600">{item.comment}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">No history available.</p>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500 mt-1 text-center absolute bottom-2 w-full"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}