"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Check, X } from "lucide-react";

export default function ApproveLeave() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && !["admin", "team_manager"].includes(session?.user?.role)) {
      router.push("/dashboard/member");
    }

    const fetchLeaveRequests = async () => {
      try {
        const response = await fetch("/api/managersCommon/approve-leave-request", { credentials: "include" });
        if (!response.ok) {
          const text = await response.text();
          console.error("Failed to fetch leave requests:", { status: response.status, statusText: response.statusText, text });
          throw new Error(`Failed to fetch leave requests: ${response.statusText || "Unknown error"}`);
        }
        const data = await response.json();
        setLeaveRequests(data.requests || []);
      } catch (err) {
        console.error("Fetch leave requests error:", err);
        setError(`Failed to fetch leave requests: ${err.message}`);
        setTimeout(() => setError(""), 3000);
      }
    };

    if (status === "authenticated") {
      fetchLeaveRequests();
    }
  }, [status, session, router]);

  const handleApproveReject = async (requestId, status) => {
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/managersCommon/approve-leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });

      const data = await response.json();
      if (!response.ok) {
        const text = await response.text();
        console.error("Failed to process leave request:", { status: response.status, statusText: response.statusText, text });
        throw new Error(data.error || `Failed to ${status} leave request`);
      }

      setSuccess(`Leave request ${status} successfully!`);
      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? { ...req, status, approvedAt: new Date().toISOString() }
            : req
        )
      );
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/dashboard/managersCommon");
  };

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-50"
      >
        <motion.div className="text-xl font-semibold text-gray-600">
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error and Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg shadow-md"
            >
              {error}
            </motion.p>
          )}
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-green-600 text-sm font-medium bg-green-50 p-4 rounded-lg shadow-md"
            >
              {success}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              className="mr-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm shadow-md transition-all duration-200"
            >
              Back
            </motion.button>
            <h1 className="text-3xl font-bold text-indigo-800 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Leave Requests
            </h1>
          </div>
        </div>

        {/* Leave Requests Table */}
        {leaveRequests.length === 0 ? (
          <p className="text-gray-600 text-center">No leave requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Proof</th>
                  <th className="px-4 py-3">Transfer To</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{request.userName}</td>
                    <td className="px-4 py-3">{new Date(request.startDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{new Date(request.endDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{request.reason}</td>
                    <td className="px-4 py-3 capitalize">
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          request.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : request.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {request.proof ? (
                        <a
                          href={request.proof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-700"
                        >
                          View
                        </a>
                      ) : (
                        "None"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {request.transferTo
                        ? leaveRequests.find((req) => req.userId === request.transferTo)?.userName || "N/A"
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3">{new Date(request.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleApproveReject(request.id, "approved")}
                            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-all duration-200"
                            disabled={isLoading}
                          >
                            <Check className="w-4 h-4 inline-block mr-1" />
                            Approve
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleApproveReject(request.id, "rejected")}
                            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-all duration-200"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4 inline-block mr-1" />
                            Reject
                          </motion.button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}