"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import ManageCalendar from "@/components/manageMeedian/ManageCalendar";
import ManageDayClose from "@/components/manageMeedian/ManageDayClose";
import ManageSlotsPage from "@/components/manageMeedian/ManageSlotsPage"; // Imported ManageSlotsPage

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function ManageTeamPage() {
  const [users, setUsers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState({
    team: true,
    slots: true,
    calendar: true,
    students: true,
  });
  const [saving, setSaving] = useState({
    team: false,
    slots: false,
    calendar: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const userTypes = ["residential", "non_residential", "semi_residential"];
  const roleTypes = ["member", "admin"];

  // Fetch users with SWR
  const { data: userData, error: userError } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });

  // Fetch slots with SWR
  const { data: slotData, error: slotError } = useSWR(
    activeSection && ["n-mris", "mspr", "mhcp"].includes(activeSection) ? "/api/admin/manageMeedian?section=slots" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  // Fetch school calendar
  const { data: calendarData, error: calendarError } = useSWR("/api/admin/manageMeedian?section=schoolCalendar", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });

  // Fetch students with SWR
  const { data: studentData, error: studentError } = useSWR(
    activeSection === "students" ? "/api/admin/manageMeedian?section=students" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  useEffect(() => {
    if (userData) {
      setUsers(userData.users || []);
      setMembers(userData.users.filter((u) => u.role === "member" || u.role === "team_manager") || []);
      setLoading((prev) => ({ ...prev, team: false }));
    }
    if (userError) {
      console.error("User fetch error:", userError);
      setError(`Failed to load users: ${userError.message}. Check database, auth, or server logs.`);
      setLoading((prev) => ({ ...prev, team: false }));
    }
  }, [userData, userError]);

  useEffect(() => {
    if (slotData) {
      const uniqueSlots = Array.from(new Map(slotData.slots.map((slot) => [slot.id, slot])).values()).sort((a, b) => a.id - b.id);
      setSlots(
        uniqueSlots.map((slot) => ({
          ...slot,
          startTime: slot.startTime ? slot.startTime.split(":")[0] + ":" + slot.startTime.split(":")[1] : "",
          endTime: slot.endTime ? slot.endTime.split(":")[0] + ":" + slot.endTime.split(":")[1] : "",
          assignedMemberId: slot.assignedMemberId,
        }))
      );
      setLoading((prev) => ({ ...prev, slots: false }));
    }
    if (slotError) {
      console.error("Slots fetch error:", slotError);
      setError(`Failed to load slots: ${slotError.message}. Check database, auth, or server logs.`);
      setLoading((prev) => ({ ...prev, slots: false }));
    }
  }, [slotData, slotError]);

  useEffect(() => {
    if (calendarData) {
      console.log("Received calendar data:", calendarData);
      setCalendar(calendarData.calendar || []);
      setLoading((prev) => ({ ...prev, calendar: false }));
    }
    if (calendarError) {
      console.error("Calendar fetch error:", calendarError);
      setError(`Failed to load school calendar: ${calendarError.message}`);
      setLoading((prev) => ({ ...prev, calendar: false }));
    }
  }, [calendarData, calendarError]);

  useEffect(() => {
    if (studentData) {
      setStudents(studentData.students || []);
      setLoading((prev) => ({ ...prev, students: false }));
    }
    if (studentError) {
      console.error("Students fetch error:", studentError);
      setError(`Failed to load students: ${studentError.message}. Check database or server logs.`);
      setLoading((prev) => ({ ...prev, students: false }));
    }
  }, [studentData, studentError]);

  const handleUserChange = (id, field, value) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: value } : u))
    );
  };

  const saveTeamChanges = async () => {
    setSaving((prev) => ({ ...prev, team: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: users }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Save failed: ${res.status}`);
      }
      setSuccess("Team changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Save team error:", err);
      setError(`Error saving team: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, team: false }));
    }
  };

  const handleCalendarChange = (id, field, value) => {
    setCalendar((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const saveCalendarChanges = async () => {
    setSaving((prev) => ({ ...prev, calendar: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: calendar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Save failed: ${res.status}`);
      setSuccess("School calendar saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      const updatedCalendar = await fetcher("/api/admin/manageMeedian?section=schoolCalendar");
      setCalendar(updatedCalendar.calendar || []);
    } catch (err) {
      console.error("Save calendar error:", err);
      setError(`Error saving calendar: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, calendar: false }));
    }
  };

  const addCalendarEntry = async (entry) => {
    setSaving((prev) => ({ ...prev, calendar: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Save failed: ${res.status}`);
      setCalendar((prev) => [...prev, data.entry]);
      setSuccess("Calendar entry added successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Add calendar entry error:", err);
      setError(`Error adding calendar entry: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, calendar: false }));
    }
  };

  const deleteCalendarEntry = async (id) => {
    setSaving((prev) => ({ ...prev, calendar: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Delete failed: ${res.status}`);
      setCalendar((prev) => prev.filter((entry) => entry.id !== id));
      setSuccess("Calendar entry deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Delete calendar entry error:", err);
      setError(`Error deleting calendar entry: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, calendar: false }));
    }
  };

  const handleBack = () => {
    setActiveSection(null);
    setError("");
    setSuccess("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-4 flex items-center justify-center"
    >
      <div className="w-full h-full bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6 sm:gap-8 overflow-y-auto">
        {/* Error/Success Message */}
        <AnimatePresence>
          {(error || success) && (
            <motion.p
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

        {/* Header */}
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-2xl sm:text-3xl font-bold text-center text-gray-800"
        >
          ⚙️ Meedian Management Portal
        </motion.h1>

        {/* Navigation */}
        <div className="flex gap-4">
          <motion.button
            onClick={handleBack}
            className="w-32 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            ← Back
          </motion.button>
          <motion.div
            onClick={() => setActiveSection("n-mris")}
            className={`flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between cursor-pointer ${
              activeSection === "n-mris" ? "bg-teal-700 text-white" : "hover:bg-teal-100"
            }`}
            whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 128, 128, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-xl font-semibold text-center text-gray-700">N-MRIs</h2>
          </motion.div>
          <motion.div
            onClick={() => setActiveSection("mspr")}
            className={`flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between cursor-pointer ${
              activeSection === "mspr" || activeSection === "mspr-pre" || activeSection === "mspr-primary" ? "bg-teal-700 text-white" : "hover:bg-teal-100"
            }`}
            whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 128, 128, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-xl font-semibold text-center text-gray-700">MSPR</h2>
          </motion.div>
          <motion.div
            onClick={() => setActiveSection("mhcp")}
            className={`flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between cursor-pointer ${
              activeSection === "mhcp" || activeSection === "mhcp1" || activeSection === "mhcp2" ? "bg-teal-700 text-white" : "hover:bg-teal-100"
            }`}
            whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 128, 128, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-xl font-semibold text-center text-gray-700">MHCP</h2>
          </motion.div>
          <motion.div
            onClick={() => setActiveSection("calendar")}
            className={`flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between cursor-pointer ${
              activeSection === "calendar" ? "bg-teal-700 text-white" : "hover:bg-teal-100"
            }`}
            whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 128, 128, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-xl font-semibold text-center text-gray-700">Calendar</h2>
          </motion.div>
        </div>

        {/* Main View or Detailed View */}
        <AnimatePresence mode="wait">
          {activeSection === null ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col sm:flex-row gap-6 sm:gap-8 h-full"
            >
              <motion.div
                className="flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("team")}
                whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 128, 128, 0.3)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2">Manage Meedian Team</h2>
                  <p className="text-base sm:text-lg text-gray-600">Update team member details such as name, email, role, and type.</p>
                </div>
              </motion.div>

              <motion.div
                className="flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("times")}
                whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(128, 0, 128, 0.3)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2">Manage Day-Close Times</h2>
                  <p className="text-base sm:text-lg text-gray-600">Set open and close times for different user types.</p>
                </div>
              </motion.div>

              <motion.div
                className="flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("students")}
                whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 0, 128, 0.3)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2">Manage Meedian Students</h2>
                  <p className="text-base sm:text-lg text-gray-600">View and manage student details, grouped by hostel and day scholars.</p>
                </div>
              </motion.div>

              <motion.div
                className="flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("calendar")}
                whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 0, 128, 0.3)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2">Manage Calendar</h2>
                  <p className="text-base sm:text-lg text-gray-600">Manage school terms and weeks.</p>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex flex-col gap-4"
            >
              {activeSection === "team" && (
                <div className="space-y-4">
                  {loading.team ? (
                    <p className="text-gray-600 text-center text-lg">Loading team members...</p>
                  ) : (
                    <div>
                      {users.length === 0 ? (
                        <p className="text-gray-600 text-center text-lg">No users found. Please check the database or authentication.</p>
                      ) : (
                        users.map((user) => (
                          <motion.div
                            key={user.id}
                            className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between"
                            whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                  type="text"
                                  value={user.name}
                                  onChange={(e) => handleUserChange(user.id, "name", e.target.value)}
                                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                  placeholder="Enter name"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                  type="email"
                                  value={user.email}
                                  onChange={(e) => handleUserChange(user.id, "email", e.target.value)}
                                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                  placeholder="Enter email"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Password (optional)</label>
                                <input
                                  type="password"
                                  value={user.password || ""}
                                  onChange={(e) => handleUserChange(user.id, "password", e.target.value)}
                                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                  placeholder="Enter new password"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUserChange(user.id, "role", e.target.value)}
                                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                >
                                  {roleTypes.map((role) => (
                                    <option key={role} value={role}>
                                      {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Type</label>
                                <select
                                  value={user.type}
                                  onChange={(e) => handleUserChange(user.id, "type", e.target.value)}
                                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                >
                                  {userTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {type.replace("_", " ").toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                      <motion.button
                        onClick={saveTeamChanges}
                        disabled={saving.team || users.length === 0}
                        className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-semibold text-lg transition-all duration-200 bg-teal-600 hover:bg-teal-700 shadow-md`}
                        whileHover={{ scale: saving.team || users.length === 0 ? 1 : 1.03 }}
                        whileTap={{ scale: saving.team || users.length === 0 ? 1 : 0.95 }}
                      >
                        {saving.team ? "Saving..." : "Save Team Changes"}
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
              {activeSection === "times" && (
                <ManageDayClose
                  setError={setError}
                  setSuccess={setSuccess}
                />
              )}
              {activeSection === "n-mris" && (
                <ManageSlotsPage
                  slots={slots}
                  setSlots={setSlots}
                  loading={loading.slots}
                  setLoading={(value) => setLoading((prev) => ({ ...prev, slots: value }))}
                  saving={saving.slots}
                  setSaving={(value) => setSaving((prev) => ({ ...prev, slots: value }))}
                  error={error}
                  setError={setError}
                  success={success}
                  setSuccess={setSuccess}
                  members={members}
                />
              )}
              {activeSection === "mspr" && (
                <div className="space-y-4 h-full">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6">
                      <h2 className="text-xl font-semibold text-gray-700 mb-2 text-center">Pre-Primary Column</h2>
                      {/* Placeholder content */}
                    </div>
                    <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6">
                      <h2 className="text-xl font-semibold text-gray-700 mb-2 text-center">Primary Column</h2>
                      {/* Placeholder content */}
                    </div>
                  </div>
                </div>
              )}
              {activeSection === "mhcp" && (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-700">HW Urgencies (6:30 - 7:30 PM)</h2>
                    <div className="grid grid-cols-4 gap-4">
                      {["T2T3 (Mon-Thu)", "T2T3 (Sat)", "T1", "T4"].map((schedule, index) => (
                        <motion.div
                          key={index}
                          className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-4 flex flex-col justify-between h-48"
                          whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                          transition={{ duration: 0.2 }}
                        >
                          <h3 className="font-semibold text-teal-900 mb-2">{schedule}</h3>
                          {/* Placeholder for schedule details */}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-700">Beyond Potential (7:30 - 8:30 PM)</h2>
                    <div className="grid grid-cols-4 gap-4">
                      {["T1", "T2T3", "T4", "T4Jr"].map((schedule, index) => (
                        <motion.div
                          key={index}
                          className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-4 flex flex-col justify-between h-48"
                          whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                          transition={{ duration: 0.2 }}
                        >
                          <h3 className="font-semibold text-teal-900 mb-2">{schedule}</h3>
                          {/* Placeholder for schedule details */}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <motion.button
                      onClick={() => setActiveSection("mhcp1")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeSection === "mhcp1" ? "bg-teal-700 text-white" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Manage MSPR
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveSection("mhcp2")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeSection === "mhcp2" ? "bg-teal-700 text-white" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Manage MHCP
                    </motion.button>
                  </div>
                </div>
              )}
              {activeSection === "calendar" && (
                <ManageCalendar
                  calendar={calendar}
                  loading={loading.calendar}
                  saving={saving.calendar}
                  onCalendarChange={handleCalendarChange}
                  onSaveCalendar={saveCalendarChanges}
                  onAddEntry={addCalendarEntry}
                  onDeleteEntry={deleteCalendarEntry}
                  error={error}
                  success={success}
                  setError={setError}
                  setSuccess={setSuccess}
                />
              )}
              {activeSection === "students" && (
                <div className="space-y-4 h-full">
                  {loading.students ? (
                    <p className="text-gray-600 text-center text-lg">Loading students...</p>
                  ) : students.length === 0 ? (
                    <p className="text-gray-600 text-center text-lg">No students found. Please check the database.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
                      {/* Hostellers */}
                      <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Hostellers</h2>
                        {Object.entries(
                          students
                            .filter((student) => student.residentialStatus === "hosteller")
                            .reduce((acc, student) => {
                              (acc[student.className] = acc[student.className] || []).push(student);
                              return acc;
                            }, {})
                        ).sort().map(([className, classStudents]) => (
                          <motion.div
                            key={className}
                            className="mb-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <h3 className="text-lg font-medium text-teal-900 mb-2">{className}</h3>
                            <div className="space-y-2">
                              {classStudents.map((student) => (
                                <div
                                  key={student.id}
                                  className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center"
                                >
                                  <div>
                                    <p className="text-gray-700">{student.name}</p>
                                    <p className="text-sm text-gray-500">Father: {student.fatherName || "N/A"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      {/* Day Scholars */}
                      <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Day Scholars</h2>
                        {Object.entries(
                          students
                            .filter((student) => student.residentialStatus === "dayscholar")
                            .reduce((acc, student) => {
                              (acc[student.className] = acc[student.className] || []).push(student);
                              return acc;
                            }, {})
                        ).sort().map(([className, classStudents]) => (
                          <motion.div
                            key={className}
                            className="mb-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <h3 className="text-lg font-medium text-teal-900 mb-2">{className}</h3>
                            <div className="space-y-2">
                              {classStudents.map((student) => (
                                <div
                                  key={student.id}
                                  className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center"
                                >
                                  <div>
                                    <p className="text-gray-700">{student.name}</p>
                                    <p className="text-sm text-gray-500">Father: {student.fatherName || "N/A"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}