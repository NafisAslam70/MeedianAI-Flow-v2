"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { X, ArrowLeft } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function AnnouncementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    target: "all",
    program: "MSP",
    programTitle: "",
    content: "",
    attachments: [],
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [attachmentInput, setAttachmentInput] = useState("");

  const { data: announcementsData, error: announcementsError, mutate } = useSWR(
    "/api/managersCommon/announcements",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && !["admin", "team_manager"].includes(session?.user?.role)) {
      router.push("/dashboard/member");
    } else if (status === "unauthenticated") {
      router.push("/login?role=admin");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (announcementsData) {
      console.log("Fetched announcements:", announcementsData.announcements);
      setAnnouncements(announcementsData.announcements || []);
    }
    if (announcementsError) {
      console.error("Announcements fetch error:", announcementsError);
      setError("Failed to load announcements: " + announcementsError.message);
      setTimeout(() => setError(""), 3000);
    }
  }, [announcementsData, announcementsError]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddAttachment = () => {
    if (attachmentInput && /^https?:\/\/[^\s]+$/.test(attachmentInput)) {
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, attachmentInput],
      }));
      setAttachmentInput("");
    } else {
      setError("Invalid attachment URL");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!formData.target) {
      setError("Target audience is required");
      setLoading(false);
      return;
    }
    if (!formData.program) {
      setError("Program is required");
      setLoading(false);
      return;
    }
    if (formData.program === "Other" && !formData.programTitle) {
      setError("Program title is required for 'Other' program");
      setLoading(false);
      return;
    }
    if (!formData.content.trim()) {
      setError("Announcement content is required");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/managersCommon/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          programTitle: formData.program === "Other" ? formData.programTitle : null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP error ${response.status}`);

      setSuccess("Announcement posted successfully!");
      setFormData({
        target: "all",
        program: "MSP",
        programTitle: "",
        content: "",
        attachments: [],
      });
      mutate();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to post announcement. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-6 overflow-y-auto">
        <AnimatePresence>
          {(error || success) && (
            <motion.p
              key={error ? "error" : "success"}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`absolute top-4 left-4 right-4 text-lg font-medium p-4 rounded-lg shadow-md ${
                error ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-600"
              }`}
              onClick={() => {
                setError("");
                setSuccess("");
              }}
            >
              {error || success} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Post Announcements</h1>
          </div>
          <motion.button
            onClick={() => router.push("/dashboard/managersCommon/assignTask")}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-300"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="inline-block mr-2" size={16} />
            Back to Tasks
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="target" className="block text-sm font-medium text-gray-700">
                Target Audience
              </label>
              <select
                id="target"
                name="target"
                value={formData.target}
                onChange={handleInputChange}
                className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
              >
                <option value="team_members">Team Members</option>
                <option value="students">Students</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label htmlFor="program" className="block text-sm font-medium text-gray-700">
                Program
              </label>
              <select
                id="program"
                name="program"
                value={formData.program}
                onChange={handleInputChange}
                className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
              >
                <option value="MSP">MSP</option>
                <option value="MSP-E">MSP-E</option>
                <option value="MHCP">MHCP</option>
                <option value="MNP">MNP</option>
                <option value="MGHP">MGHP</option>
                <option value="MAP">MAP</option>
                <option value="M4E">M4E</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {formData.program === "Other" && (
              <div>
                <label htmlFor="programTitle" className="block text-sm font-medium text-gray-700">
                  Program Title
                </label>
                <input
                  type="text"
                  id="programTitle"
                  name="programTitle"
                  value={formData.programTitle}
                  onChange={handleInputChange}
                  className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                  placeholder="Enter custom program title"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                Announcement Content
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                rows="4"
                placeholder="Write your announcement here"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="attachmentInput" className="block text-sm font-medium text-gray-700">
                Add Attachment (URL, Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="attachmentInput"
                  value={attachmentInput}
                  onChange={(e) => setAttachmentInput(e.target.value)}
                  className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                  placeholder="Enter attachment URL (e.g., https://example.com/file.pdf)"
                />
                <motion.button
                  type="button"
                  onClick={handleAddAttachment}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Add
                </motion.button>
              </div>
              {formData.attachments.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {formData.attachments.map((url, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                        {url}
                      </a>
                      <motion.button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="text-red-600 hover:text-red-800"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <X size={16} />
                      </motion.button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <motion.button
              type="button"
              onClick={() => router.push("/dashboard/admin/assignTask")}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-2xl text-lg font-semibold hover:bg-gray-300"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading}
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-2xl text-lg font-semibold text-white ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"
              }`}
              whileHover={{ scale: loading ? 1 : 1.03 }}
              whileTap={{ scale: loading ? 1 : 0.95 }}
            >
              {loading ? "Posting..." : "Post Announcement"}
            </motion.button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Announcements</h2>
          {announcements.length === 0 ? (
            <p className="text-gray-600 text-lg">No announcements found.</p>
          ) : (
            <ul className="space-y-4">
              {announcements.map((ann) => (
                <motion.li
                  key={ann.id}
                  className="bg-teal-50 p-4 rounded-2xl shadow-lg hover:bg-teal-100 transition-all duration-200"
                  whileHover={{ scale: 1.03 }}
                >
                  <p className="text-lg font-semibold text-gray-800">
                    {ann.program === "Other" ? ann.programTitle : ann.program} ({ann.target})
                  </p>
                  <p className="text-gray-700">{ann.content}</p>
                  {ann.attachments.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Attachments:</p>
                      <ul className="list-disc pl-5">
                        {ann.attachments.map((url, index) => (
                          <li key={index}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    Posted by {ann.createdByName} on {new Date(ann.createdAt).toLocaleString()}
                  </p>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}