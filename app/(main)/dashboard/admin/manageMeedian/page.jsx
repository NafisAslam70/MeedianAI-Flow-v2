"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR, { mutate } from "swr";
import Team from "./Team";
import Students from "./Students";
import Bulk from "./Bulk";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const toHHMM = (t) => {
  if (!t) return "";
  const parts = t.split(":");
  return parts.length >= 2 ? `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}` : "";
};

const ensureSeconds = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t || null);

export default function ManageMeedian() {
  const [users, setUsers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [students, setStudents] = useState([]);
  const [userTimes, setUserTimes] = useState({});
  const [userMriRoles, setUserMriRoles] = useState({});
  const [loading, setLoading] = useState({
    team: true,
    slots: true,
    calendar: true,
    students: true,
    userTimes: true,
    mriRoles: true,
  });
  const [saving, setSaving] = useState({
    team: false,
    slots: false,
    calendar: false,
    userTimes: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const [editSlot, setEditSlot] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showManageTimingsModal, setShowManageTimingsModal] = useState(false);
  const [editTimingsSlot, setEditTimingsSlot] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const userTypes = ["residential", "non_residential", "semi_residential"];
  const roleTypes = ["member", "admin", "team_manager"];
  const memberScopes = ["i_member", "o_member", "s_member"];
  const teamManagerTypes = [
    "head_incharge",
    "coordinator",
    "accountant",
    "chief_counsellor",
    "hostel_incharge",
    "principal",
  ];
  const mriRoles = [
    "nmri_moderator",
    "msp_ele_moderator",
    "msp_pre_moderator",
    "mhcp1_moderator",
    "mhcp2_moderator",
    "events_moderator",
    "assessment_moderator",
    "sports_moderator",
    "util_moderator",
  ];

  /* ----------------------------- SWR ----------------------------- */
  const { data: userData, error: userError } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });
  const { data: slotData, error: slotError } = useSWR(
    activeSection && ["n-mris", "mspr", "mhcp"].includes(activeSection) ? "/api/admin/manageMeedian?section=slots" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, revalidateOnReconnect: false }
  );
  const { data: calendarData, error: calendarError } = useSWR(
    "/api/admin/manageMeedian?section=schoolCalendar",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, revalidateOnReconnect: false }
  );
  const { data: studentData, error: studentError } = useSWR(
    activeSection === "students" ? "/api/member/student" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, revalidateOnReconnect: false }
  );
  const { data: userTimesData, error: userTimesError } = useSWR(
    "/api/admin/manageMeedian?section=userOpenCloseTimes",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, revalidateOnReconnect: false }
  );

  /* ----------------------------- Effects ----------------------------- */
  useEffect(() => {
    if (userData) {
      setUsers(userData.users || []);
      setMembers(userData.users?.filter((u) => u.role === "member" || u.role === "team_manager") || []);
      setUserMriRoles(userData.userMriRoles || {});
      setLoading((p) => ({ ...p, team: false, mriRoles: false }));
    }
    if (userError) {
      setError(`Failed to load users: ${userError.message}. Check database, auth, or server logs.`);
      setLoading((p) => ({ ...p, team: false, mriRoles: false }));
    }
  }, [userData, userError]);

  useEffect(() => {
    if (slotData) {
      setSlots(slotData.slots || []);
      setBulkAssignments(
        (slotData.slots || []).reduce((acc, slot) => {
          acc[slot.id] = slot.assignedMemberId || null;
          return acc;
        }, {})
      );
      setLoading((p) => ({ ...p, slots: false }));
    }
    if (slotError) {
      setError(`Failed to load slots: ${slotError.message}. Check database, auth, or server logs.`);
      setLoading((p) => ({ ...p, slots: false }));
    }
  }, [slotData, slotError]);

  useEffect(() => {
    if (calendarData) {
      setCalendar(calendarData.calendar || []);
      setLoading((p) => ({ ...p, calendar: false }));
    }
    if (calendarError) {
      setError(`Failed to load school calendar: ${calendarError.message}`);
      setLoading((p) => ({ ...p, calendar: false }));
    }
  }, [calendarData, calendarError]);

  useEffect(() => {
    if (studentData) {
      setStudents(studentData.students || []);
      setLoading((p) => ({ ...p, students: false }));
    }
    if (studentError) {
      setError(`Failed to load students: ${studentError.message}. Check database or server logs.`);
      setLoading((p) => ({ ...p, students: false }));
    }
  }, [studentData, studentError]);

  useEffect(() => {
    if (userTimesData) {
      const list = userTimesData.userOpenCloseTimes || userTimesData.times || userTimesData.items || [];
      const mapped = {};
      list.forEach((row) => {
        mapped[row.userId] = {
          dayOpenedAt: toHHMM(row.dayOpenedAt),
          dayClosedAt: toHHMM(row.dayClosedAt),
          useCustomTimes: !!row.useCustomTimes,
        };
      });
      setUserTimes(mapped);
      setLoading((p) => ({ ...p, userTimes: false }));
    }
    if (userTimesError) {
      setError(`Failed to load per-user open/close times: ${userTimesError.message}`);
      setLoading((p) => ({ ...p, userTimes: false }));
    }
  }, [userTimesData, userTimesError]);

  /* -------------------------- Handlers -------------------------- */
  const handleUserChange = (id, field, value) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, [field]: field === "immediate_supervisor" ? (value ? parseInt(value) : null) : value }
          : u
      )
    );
  };

  const handleUserMriRoleChange = (userId, roles) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, mriRoles: roles.filter((role) => mriRoles.includes(role)) }
          : u
      )
    );
  };

  const handleUserTimeToggle = (userId, checked) => {
    setUserTimes((prev) => ({
      ...prev,
      [userId]: {
        dayOpenedAt: prev[userId]?.dayOpenedAt || "",
        dayClosedAt: prev[userId]?.dayClosedAt || "",
        useCustomTimes: !!checked,
      },
    }));
  };

  const handleUserTimeChange = (userId, field, value) => {
    setUserTimes((prev) => ({
      ...prev,
      [userId]: {
        dayOpenedAt: field === "dayOpenedAt" ? value : prev[userId]?.dayOpenedAt || "",
        dayClosedAt: field === "dayClosedAt" ? value : prev[userId]?.dayClosedAt || "",
        useCustomTimes: prev[userId]?.useCustomTimes ?? true,
      },
    }));
  };

  const saveTeamChanges = async () => {
    setSaving((p) => ({ ...p, team: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: users }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSuccess("Team changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=team");
    } catch (err) {
      setError(`Error saving team: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, team: false }));
    }
  };

  const saveUserTimesChanges = async () => {
    setSaving((p) => ({ ...p, userTimes: true }));
    setError("");
    setSuccess("");
    try {
      const updates = Object.entries(userTimes).map(([userId, v]) => ({
        userId: parseInt(userId, 10),
        useCustomTimes: !!v.useCustomTimes,
        dayOpenedAt: v.useCustomTimes ? ensureSeconds(v.dayOpenedAt) : null,
        dayClosedAt: v.useCustomTimes ? ensureSeconds(v.dayClosedAt) : null,
      }));
      const res = await fetch("/api/admin/manageMeedian?section=userOpenCloseTimes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSuccess("Per-user open/close times saved!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=userOpenCloseTimes", undefined, { revalidate: true });
    } catch (err) {
      setError(`Error saving per-user times: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, userTimes: false }));
    }
  };

  const saveSlotAssignment = async (slotId, memberId) => {
    setSaving((p) => ({ ...p, slots: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ slotId, memberId }] }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, assignedMemberId: memberId } : s)));
      setBulkAssignments((prev) => ({ ...prev, [slotId]: memberId }));
      setSuccess("Slot assignment saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
    } catch (err) {
      setError(`Error saving slot assignment: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((p) => ({ ...p, slots: false }));
      setEditSlot(null);
    }
  };

  const deleteSlotAssignment = async (slotId) => {
    setSaving((p) => ({ ...p, slots: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, assignedMemberId: null } : s)));
      setBulkAssignments((prev) => ({ ...prev, [slotId]: null }));
      setSuccess("Slot assignment deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
    } catch (err) {
      setError(`Error deleting slot assignment: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, slots: false }));
      setEditSlot(null);
    }
  };

  const saveSlotTimings = async (slotId, startTime, endTime) => {
    setSaving((p) => ({ ...p, slots: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ slotId, startTime: ensureSeconds(startTime), endTime: ensureSeconds(endTime) }],
        }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, startTime, endTime } : s)));
      setSuccess("Slot timings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
    } catch (err) {
      setError(`Error saving slot timings: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((p) => ({ ...p, slots: false }));
      setEditTimingsSlot(null);
    }
  };

  const handleCalendarChange = (id, field, value) => {
    setCalendar((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const saveCalendarChanges = async () => {
    setSaving((p) => ({ ...p, calendar: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: calendar }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSuccess("School calendar saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=schoolCalendar");
    } catch (err) {
      setError(`Error saving calendar: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, calendar: false }));
    }
  };

  const addCalendarEntry = async (entry) => {
    setSaving((p) => ({ ...p, calendar: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setCalendar((prev) => [...prev, responseData.entry]);
      setSuccess("Calendar entry added successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=schoolCalendar");
    } catch (err) {
      setError(`Error adding calendar entry: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, calendar: false }));
    }
  };

  const deleteCalendarEntry = async (id) => {
    setSaving((p) => ({ ...p, calendar: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Delete failed: ${res.status}`);
      setCalendar((prev) => prev.filter((entry) => entry.id !== id));
      setSuccess("Calendar entry deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=schoolCalendar");
    } catch (err) {
      setError(`Error deleting calendar entry: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, calendar: false }));
    }
  };

  const handleBack = () => {
    setActiveSection(null);
    setError("");
    setSuccess("");
    setShowBulkModal(false);
    setShowManageTimingsModal(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-4 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6 sm:gap-8 overflow-y-auto">
        <AnimatePresence>
          {(error || success) && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`absolute top-4 left-4 right-4 text-lg font-medium p-4 rounded-lg shadow-md ${
                error ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"
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
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-2xl sm:text-3xl font-bold text-center text-gray-800"
        >
          ⚙️ Meedian Management Portal
        </motion.h1>
        <div className="flex gap-4 flex-wrap">
          <motion.button
            onClick={handleBack}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ← Back
          </motion.button>
          <motion.div
            onClick={() => setActiveSection("team")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "team" ? "bg-teal-600 text-white" : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">Team</h2>
          </motion.div>
          <motion.div
            onClick={() => setActiveSection("students")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "students" ? "bg-teal-600 text-white" : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 0, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">Students</h2>
          </motion.div>
          <motion.div
            onClick={() => setActiveSection("bulk")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "bulk" ? "bg-teal-600 text-white" : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 0, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">Bulk Operations</h2>
          </motion.div>
        </div>
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
                className="flex-1 bg-white rounded-lg shadow-md p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("team")}
                whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Manage Meedian Team</h2>
                  <p className="text-base sm:text-lg text-gray-600">
                    Update team member details such as name, email, role, supervisor — or remove a user.
                  </p>
                </div>
              </motion.div>
              <motion.div
                className="flex-1 bg-white rounded-lg shadow-md p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("students")}
                whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 0, 128, 0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Manage Meedian Students</h2>
                  <p className="text-base sm:text-lg text-gray-600">
                    View and manage student details, grouped by hostel and day scholars.
                  </p>
                </div>
              </motion.div>
              <motion.div
                className="flex-1 bg-white rounded-lg shadow-md p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("bulk")}
                whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 0, 128, 0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Manage Bulk Operations</h2>
                  <p className="text-base sm:text-lg text-gray-600">Manage slots, calendar, and day-close times.</p>
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
                <Team
                  users={users}
                  setUsers={setUsers}
                  userTimes={userTimes}
                  setUserTimes={setUserTimes}
                  loading={loading}
                  saving={saving}
                  setError={setError}
                  setSuccess={setSuccess}
                  setConfirmDeleteUser={setConfirmDeleteUser}
                  userTypes={userTypes}
                  roleTypes={roleTypes}
                  memberScopes={memberScopes}
                  teamManagerTypes={teamManagerTypes}
                  mriRoles={mriRoles}
                  userMriRoles={userMriRoles}
                  saveTeamChanges={saveTeamChanges}
                  saveUserTimesChanges={saveUserTimesChanges}
                  handleUserChange={handleUserChange}
                  handleUserTimeToggle={handleUserTimeToggle}
                  handleUserTimeChange={handleUserTimeChange}
                  handleUserMriRoleChange={handleUserMriRoleChange}
                />
              )}
              {activeSection === "students" && (
                <Students
                  setError={setError}
                  setSuccess={setSuccess}
                />
              )}
              {activeSection === "bulk" && (
                <Bulk
                  slots={slots}
                  setSlots={setSlots}
                  members={members}
                  calendar={calendar}
                  setCalendar={setCalendar}
                  loading={loading}
                  saving={saving}
                  setSaving={setSaving}
                  error={error}
                  success={success}
                  setError={setError}
                  setSuccess={setSuccess}
                  editSlot={editSlot}
                  setEditSlot={setEditSlot}
                  showBulkModal={showBulkModal}
                  setShowBulkModal={setShowBulkModal}
                  bulkAssignments={bulkAssignments}
                  setBulkAssignments={setBulkAssignments}
                  showConfirmModal={showConfirmModal}
                  setShowConfirmModal={setShowConfirmModal}
                  showManageTimingsModal={showManageTimingsModal}
                  setShowManageTimingsModal={setShowManageTimingsModal}
                  editTimingsSlot={editTimingsSlot}
                  setEditTimingsSlot={setEditTimingsSlot}
                  saveSlotAssignment={saveSlotAssignment}
                  deleteSlotAssignment={deleteSlotAssignment}
                  saveSlotTimings={saveSlotTimings}
                  handleCalendarChange={handleCalendarChange}
                  saveCalendarChanges={saveCalendarChanges}
                  addCalendarEntry={addCalendarEntry}
                  deleteCalendarEntry={deleteCalendarEntry}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {confirmDeleteUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-2">Remove User</h2>
                <p className="text-gray-600">
                  Are you sure you want to permanently remove <span className="font-semibold">{confirmDeleteUser.name}</span>? This action
                  cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmDeleteUser(null)}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setSaving((p) => ({ ...p, team: true }));
                      setError("");
                      setSuccess("");
                      try {
                        const res = await fetch("/api/admin/manageMeedian?section=team", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: confirmDeleteUser.id }),
                        });
                        const responseData = await res.json();
                        if (!res.ok) throw new Error(responseData.error || `Delete failed: ${res.status}`);
                        setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteUser.id));
                        setMembers((prev) => prev.filter((u) => u.id !== confirmDeleteUser.id));
                        setUserTimes((prev) => {
                          const c = { ...prev };
                          delete c[confirmDeleteUser.id];
                          return c;
                        });
                        setUserMriRoles((prev) => {
                          const c = { ...prev };
                          delete c[confirmDeleteUser.id];
                          return c;
                        });
                        setSuccess(`Deleted user: ${confirmDeleteUser.name}`);
                        setTimeout(() => setSuccess(""), 3000);
                        await mutate("/api/admin/manageMeedian?section=team");
                        await mutate("/api/admin/manageMeedian?section=userOpenCloseTimes");
                      } catch (err) {
                        setError(`Error deleting user: ${err.message}`);
                      } finally {
                        setSaving((p) => ({ ...p, team: false }));
                        setConfirmDeleteUser(null);
                      }
                    }}
                    disabled={saving.team}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                  >
                    {saving.team ? "Removing..." : "Remove"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}