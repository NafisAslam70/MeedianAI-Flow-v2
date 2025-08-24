"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, X, User, Calendar, MessageSquare, BookOpen, FileText, BarChart } from "lucide-react";
import Link from "next/link";

export default function Profile({ setChatboxOpen = () => {}, setChatRecipient = () => {} }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    whatsapp_number: "",
    whatsapp_enabled: true,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [leaveRequest, setLeaveRequest] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    transferTo: "",
    proof: null,
  });
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [immediateSupervisor, setImmediateSupervisor] = useState(null);

  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || "",
        whatsapp_number: session.user.whatsapp_number || "",
        whatsapp_enabled: session.user.whatsapp_enabled !== false,
      });
      setImagePreview(session.user.image || "/default-avatar.png");
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/member/profile", { credentials: "include" });
        const data = await response.json();
        if (response.ok) {
          setFormData({
            name: data.user.name || "",
            whatsapp_number: data.user.whatsapp_number || "",
            whatsapp_enabled: data.user.whatsapp_enabled !== false,
          });
          setImagePreview(data.user.image || "/default-avatar.png");
          setImmediateSupervisor({
            id: data.user.immediate_supervisor,
            name: data.user.immediate_supervisor_name || "None",
            role: data.user.immediate_supervisor_role || "",
          });
          await fetch("/api/auth/session", { credentials: "include" });
        } else {
          console.error("Failed to fetch profile:", { status: response.status, error: data.error });
          setError(data.error || "Failed to fetch profile data");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Fetch profile error:", err);
        setError("Failed to fetch profile data");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/member/users", { credentials: "include" });
        const data = await response.json();
        if (response.ok) {
          console.log("Fetched users from /api/member/users:", data.users); // Debug log
          setUsers(data.users || []);
        } else {
          console.error("Failed to fetch users:", { status: response.status, error: data.error });
          setError("Failed to fetch users. Please try again.");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Fetch users error:", err);
        setError("Failed to fetch users. Please try again.");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchLeaveHistory = async () => {
      try {
        const response = await fetch("/api/member/leave-request", { credentials: "include" });
        if (!response.ok) {
          const text = await response.text();
          console.error("Leave history fetch failed:", { status: response.status, statusText: response.statusText, text });
          throw new Error(`Failed to fetch leave history: ${response.statusText || "Unknown error"}`);
        }
        const data = await response.json();
        setLeaveHistory(data.requests || []);
      } catch (err) {
        console.error("Fetch leave history error:", err);
        setError(`Failed to fetch leave history: ${err.message}`);
        setTimeout(() => setError(""), 3000);
      }
    };

    if (status === "authenticated") {
      fetchProfile();
      fetchUsers();
      fetchLeaveHistory();
    }
  }, [session, status]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLeaveChange = (e) => {
    const { name, value, files } = e.target;
    setLeaveRequest((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        setTimeout(() => setError(""), 3000);
        return;
      }
      setProfileImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("whatsapp_number", formData.whatsapp_number);
      formDataToSend.append("whatsapp_enabled", formData.whatsapp_enabled);
      if (profileImage) {
        formDataToSend.append("image", profileImage);
      }

      const response = await fetch("/api/member/profile", {
        method: "PATCH",
        body: formDataToSend,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setFormData({
        name: data.user.name || "",
        whatsapp_number: data.user.whatsapp_number || "",
        whatsapp_enabled: data.user.whatsapp_enabled !== false,
      });
      setImagePreview(data.user.image || "/default-avatar.png");
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 2500);

      await fetch("/api/auth/session", { credentials: "include" });
      window.postMessage({ type: "PROFILE_UPDATED" }, window.location.origin);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New password and confirmation do not match");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/member/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setSuccess("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageDelete = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/member/profile", {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete profile picture");
      }

      setProfileImage(null);
      setImagePreview(data.user.image || "/default-avatar.png");
      setSuccess("Profile picture removed!");
      setTimeout(() => setSuccess(""), 2500);

      await fetch("/api/auth/session", { credentials: "include" });
      window.postMessage({ type: "PROFILE_UPDATED" }, window.location.origin);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    if (!leaveRequest.startDate || !leaveRequest.endDate || !leaveRequest.reason) {
      setError("Please fill in all required fields");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }

    try {
      const leaveData = new FormData();
      leaveData.append("startDate", leaveRequest.startDate);
      leaveData.append("endDate", leaveRequest.endDate);
      leaveData.append("reason", leaveRequest.reason);
      if (leaveRequest.proof) {
        leaveData.append("proof", leaveRequest.proof);
      }
      if (session?.user?.role === "team_manager" && leaveRequest.transferTo) {
        leaveData.append("transferTo", leaveRequest.transferTo);
      }

      const response = await fetch("/api/member/leave-request", {
        method: "POST",
        body: leaveData,
      });

      const data = await response.json();
      if (!response.ok) {
        const text = await response.text();
        console.error("Leave request submission failed:", { status: response.status, statusText: response.statusText, text });
        throw new Error(data.error || "Failed to submit leave request");
      }

      setSuccess("Leave request submitted successfully!");
      setLeaveRequest({
        startDate: "",
        endDate: "",
        reason: "",
        transferTo: "",
        proof: null,
      });
      setShowLeaveModal(false);
      const historyResponse = await fetch("/api/member/leave-request", { credentials: "include" });
      if (!historyResponse.ok) {
        const text = await historyResponse.text();
        console.error("Leave history refresh failed:", { status: historyResponse.status, statusText: historyResponse.statusText, text });
        throw new Error(`Failed to refresh leave history: ${historyResponse.statusText || "Unknown error"}`);
      }
      const historyData = await historyResponse.json();
      setLeaveHistory(historyData.requests || []);
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    router.push(`/dashboard/${session?.user?.role === "team_manager" ? "team_manager" : session?.user?.role}`);
  };

  const handleTalkToSuperintendent = () => {
    console.log("Talk to Superintendent clicked", { users }); // Debug log
    const superintendent = users.find((user) => user.id === 43);
    if (superintendent?.id) {
      console.log("Opening chat with superintendent:", superintendent); // Debug log
      setChatboxOpen(true);
      setChatRecipient(String(superintendent.id));
    } else {
      console.error("Superintendent (id: 43) not found. Users:", users);
      setError("Superintendent not found. Please contact an admin or try again later.");
      setTimeout(() => setError(""), 5000);
    }
  };

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-50"
      >
        <motion.div className="text-2xl font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
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

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.33, ease: "easeOut" }}
      className="fixed top-16 left-0 right-0 bottom-16 z-40 flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 dark:from-gray-800/80 dark:to-gray-900/80 p-4 md:p-8"
    >
      <div
        className="relative w-full max-w-[100vw] sm:max-w-[85vw] md:max-w-[95vw] h-[80vh] bg-white/90 dark:bg-gray-900/90 border border-teal-200/50 shadow-2xl rounded-3xl px-4 md:px-8 py-6 flex flex-col gap-8 overflow-y-auto glassmorphism backdrop-blur-2xl transition-all custom-scrollbar"
        style={{
          boxShadow: "0 12px 40px 0 rgba(16, 42, 67, 0.15), 0 2px 12px 0 rgba(16,42,67,0.1)",
        }}
      >
        <motion.button
          whileHover={{ scale: 1.13, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleClose}
          className="absolute top-4 right-4 z-50 p-2 bg-gray-100/90 dark:bg-gray-800/90 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 rounded-full shadow-lg border border-gray-200/50 dark:border-gray-700/50 transition-all"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </motion.button>

        {/* Main Section: Profile Settings and Meed Widgets */}
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-[2.7] min-w-[300px] flex flex-col">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <User className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
              Profile Settings
            </h1>

            <AnimatePresence>
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-green-800 text-sm font-medium bg-green-100/90 dark:bg-green-900/90 p-3 rounded-lg shadow-md border border-green-300/50 dark:border-green-700/50 mb-4"
                >
                  {success}
                </motion.p>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-red-800 text-sm font-medium bg-red-100/90 dark:bg-red-900/90 p-3 rounded-lg shadow-md border border-red-300/50 dark:border-red-700/50 mb-4"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <form onSubmit={handleProfileUpdate} className="flex flex-col gap-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Profile"
                      className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-3 border-teal-600 object-cover shadow-lg"
                    />
                    <label
                      htmlFor="profile-image"
                      className="absolute bottom-0 right-0 bg-teal-600 text-white p-2 rounded-full cursor-pointer hover:bg-teal-700 transition shadow-md"
                    >
                      <Camera size={18} />
                      <input
                        id="profile-image"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                        disabled={isLoading}
                      />
                    </label>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleImageDelete}
                    className="text-red-600 hover:text-red-700 text-sm font-medium transition"
                    disabled={isLoading || !imagePreview || imagePreview === "/default-avatar.png"}
                  >
                    Remove Profile Picture
                  </motion.button>
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">WhatsApp Number</label>
                    <input
                      type="tel"
                      name="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="whatsapp_enabled"
                      checked={formData.whatsapp_enabled}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Enable WhatsApp Notifications
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-md transition"
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Update Profile"}
                </motion.button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-600" />
                Meed Widgets for You
              </h2>
              <div className="flex flex-row flex-wrap gap-4">
                <Link href="/dashboard/member/myPerformance">
                  <motion.div
                    className="bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-lg p-5 flex flex-col items-center justify-between cursor-pointer min-w-[150px] flex-1 min-h-[180px]"
                    whileHover={{ scale: 1.05, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.25)" }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <BarChart className="w-8 h-8 text-teal-600 mb-2" />
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 text-center">My Performance</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">View your performance metrics</p>
                  </motion.div>
                </Link>
                <motion.div
                  className="bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-lg p-5 flex flex-col items-center justify-between cursor-pointer min-w-[150px] flex-1 min-h-[180px]"
                  whileHover={{ scale: 1.05, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowLeaveModal(true)}
                >
                  <Calendar className="w-8 h-8 text-teal-600 mb-2" />
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 text-center">Leave Request</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Submit a leave of absence</p>
                </motion.div>

                <motion.div
                  className="bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-lg p-5 flex flex-col items-center justify-between cursor-pointer min-w-[150px] flex-1 min-h-[180px]"
                  whileHover={{ scale: 1.05, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleTalkToSuperintendent}
                >
                  <MessageSquare className="w-8 h-8 text-teal-600 mb-2" />
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 text-center">Talk to Superintendent</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Connect with the superintendent</p>
                </motion.div>
                <motion.div
                  className="bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-lg p-5 flex flex-col items-center justify-between cursor-pointer min-w-[150px] flex-1 min-h-[180px]"
                  whileHover={{ scale: 1.05, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => window.open("https://www.nafisaslam.com/login", "_blank")}
                >
                  <BookOpen className="w-8 h-8 text-teal-600 mb-2" />
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 text-center">Learn New Things</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Explore learning resources</p>
                </motion.div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Leave History
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowHistoryModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-md transition"
                disabled={isLoading}
              >
                View Leave History
              </motion.button>
            </div>
          </div>

          <div className="flex-[1.3] min-w-[320px] max-w-[520px] flex flex-col bg-gradient-to-br from-blue-50/70 to-slate-100/70 dark:from-gray-800/80 dark:to-gray-900/80 rounded-2xl shadow-xl border border-teal-100/50 dark:border-gray-700/50 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              User Information
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
                  <p className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700">
                    {session?.user?.email || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Role</label>
                  <p className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700">
                    {session?.user?.role?.replace("_", " ") || "N/A"}
                  </p>
                </div>
                {session?.user?.role === "team_manager" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Team Manager Type</label>
                    <p className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700">
                      {session?.user?.team_manager_type?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Reports To</label>
                  <p className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700">
                    {immediateSupervisor?.name || "None"} {immediateSupervisor?.role ? `(${immediateSupervisor.role})` : ""}
                  </p>
                </div>
              </div>
              <form onSubmit={handlePasswordUpdate} className="grid gap-4 mt-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Change Password
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-md transition"
                    disabled={isLoading}
                  >
                    {isLoading ? "Changing..." : "Change Password"}
                  </motion.button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showLeaveModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-teal-200/50 dark:border-gray-700/50"
              >
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Submit Leave Request</h2>
                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={leaveRequest.startDate}
                      onChange={handleLeaveChange}
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={leaveRequest.endDate}
                      onChange={handleLeaveChange}
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Reason</label>
                    <textarea
                      name="reason"
                      value={leaveRequest.reason}
                      onChange={handleLeaveChange}
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      rows={4}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Supporting Document (Optional)</label>
                    <input
                      type="file"
                      name="proof"
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      onChange={handleLeaveChange}
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      disabled={isLoading}
                    />
                  </div>
                  {session?.user?.role === "team_manager" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Transfer Role To</label>
                      <select
                        name="transferTo"
                        value={leaveRequest.transferTo}
                        onChange={handleLeaveChange}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50/90 dark:bg-gray-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                        disabled={isLoading}
                      >
                        <option value="">Select User</option>
                        {users
                          .filter((u) => u.id !== session?.user?.id && (u.role === "admin" || u.role === "team_manager"))
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => setShowLeaveModal(false)}
                      className="px-5 py-2.5 bg-gray-400 text-white rounded-lg text-sm font-medium hover:bg-gray-500 shadow-md transition"
                      disabled={isLoading}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-md transition"
                      disabled={isLoading}
                    >
                      {isLoading ? "Submitting..." : "Submit for Approval"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showHistoryModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-200/50 dark:border-gray-700/50"
              >
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                  Leave History
                </h2>
                {leaveHistory.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 text-center">No leave requests found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-700 dark:text-gray-200">
                      <thead className="text-xs text-gray-700 dark:text-gray-200 uppercase bg-gray-50/90 dark:bg-gray-800/90">
                        <tr>
                          <th className="px-4 py-3">Start Date</th>
                          <th className="px-4 py-3">End Date</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Submitted To</th>
                          <th className="px-4 py-3">Proof</th>
                          <th className="px-4 py-3">Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveHistory.map((request) => (
                          <tr key={request.id} className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50/90 dark:hover:bg-gray-800/90">
                            <td className="px-4 py-3">{new Date(request.startDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3">{new Date(request.endDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3">{request.reason}</td>
                            <td className="px-4 py-3 capitalize">{request.status}</td>
                            <td className="px-4 py-3">{request.supervisorName || "N/A"}</td>
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
                            <td className="px-4 py-3">{new Date(request.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowHistoryModal(false)}
                    className="px-5 py-2.5 bg-gray-400 text-white rounded-lg text-sm font-medium hover:bg-gray-500 shadow-md transition"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 7px;
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #60a5fa/40;
            border-radius: 6px;
          }
          .custom-scrollbar {
            scrollbar-color: #60a5fa/40 transparent;
            scrollbar-width: thin;
          }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #2563eb/50;
          }
          .glassmorphism {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }
          html.dark .glassmorphism {
            background: rgba(30, 41, 59, 0.9);
          }
        `}</style>
      </div>
    </motion.div>
  );
}