"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR, { mutate } from "swr";
import ManageCalendar from "@/components/manageMeedian/ManageCalendar";
import ManageDayClose from "@/components/manageMeedian/ManageDayClose";
import ManageSlots from "@/components/manageMeedian/ManageSlots";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const toHHMM = (t) => {
  if (!t) return "";
  // accept "HH:MM" or "HH:MM:SS"
  const parts = t.split(":");
  return parts.length >= 2 ? `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}` : "";
};
const ensureSeconds = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t || null);

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
    userTimes: true,
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
  const [showViewAssignments, setShowViewAssignments] = useState(false);
  const [showManageTimingsModal, setShowManageTimingsModal] = useState(false);
  const [editTimingsSlot, setEditTimingsSlot] = useState(null);
  const [teamFilter, setTeamFilter] = useState("members");
  const [expandedCard, setExpandedCard] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [showPasswords, setShowPasswords] = useState({}); // { [userId]: boolean }

  // NEW: per-user open/close times state
  // shape: { [userId]: { dayOpenedAt: "HH:MM", dayClosedAt: "HH:MM", useCustomTimes: boolean } }
  const [userTimes, setUserTimes] = useState({});

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

  /* ----------------------------- SWR ----------------------------- */
  const { data: userData, error: userError } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });

  const { data: slotData, error: slotError } = useSWR(
    activeSection && ["n-mris", "mspr", "mhcp"].includes(activeSection) ? "/api/admin/manageMeedian?section=slots" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  const { data: calendarData, error: calendarError } = useSWR(
    "/api/admin/manageMeedian?section=schoolCalendar",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  const { data: studentData, error: studentError } = useSWR(
    activeSection === "students" ? "/api/admin/manageMeedian?section=students" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  // NEW: per-user times (load for team screen)
  const { data: userTimesData, error: userTimesError } = useSWR(
    "/api/admin/manageMeedian?section=userOpenCloseTimes",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  /* ----------------------------- Effects ----------------------------- */
  useEffect(() => {
    if (userData) {
      setUsers(userData.users || []);
      setMembers(userData.users?.filter((u) => u.role === "member" || u.role === "team_manager") || []);
      setLoading((p) => ({ ...p, team: false }));
    }
    if (userError) {
      setError(`Failed to load users: ${userError.message}. Check database, auth, or server logs.`);
      setLoading((p) => ({ ...p, team: false }));
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

  // NEW: map userOpenCloseTimes to local state
  useEffect(() => {
    if (userTimesData) {
      const list =
        userTimesData.userOpenCloseTimes ||
        userTimesData.times ||
        userTimesData.items ||
        [];
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

  /* -------------------------- Team Handlers -------------------------- */
  const handleUserChange = (id, field, value) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              [field]: field === "immediate_supervisor" ? (value ? parseInt(value) : null) : value,
            }
          : u
      )
    );
  };

  // NEW: per-user time handlers
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
      setExpandedCard(null);
    } catch (err) {
      setError(`Error saving team: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, team: false }));
    }
  };

  // NEW: save per-user open/close times (batch)
  const saveUserTimesChanges = async () => {
    setSaving((p) => ({ ...p, userTimes: true }));
    setError("");
    setSuccess("");
    try {
      // Build updates for rows where toggle is true OR explicitly false (so backend can turn off custom flag)
      const updates = Object.entries(userTimes).map(([userId, v]) => ({
        userId: parseInt(userId, 10),
        useCustomTimes: !!v.useCustomTimes,
        // only send times if custom is ON; backend can ignore when false
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

  // Save both with a single CTA
  const saveAllChanges = async () => {
    // save team and userTimes sequentially to surface precise errors
    await saveTeamChanges();
    await saveUserTimesChanges();
  };

  const requestDeleteUser = (user) => {
    setConfirmDeleteUser(user);
  };

  const deleteUser = async () => {
    if (!confirmDeleteUser) return;
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
      // Optimistic UI update
      setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteUser.id));
      setMembers((prev) => prev.filter((u) => u.id !== confirmDeleteUser.id));
      // remove times for that user if present
      setUserTimes((prev) => {
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
  };

  /* ------------------------- Slot Assignments ------------------------ */
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
      if (!res.ok) throw new Error(responseData.error || `Delete failed: ${res.status}`);
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

  const saveBulkAssignments = async () => {
    setSaving((p) => ({ ...p, slots: true }));
    setError("");
    setSuccess("");
    try {
      const updates = Object.entries(bulkAssignments)
        .filter(([_, memberId]) => memberId !== null)
        .map(([slotId, memberId]) => ({ slotId: parseInt(slotId), memberId }));
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSlots((prev) =>
        prev.map((s) => ({
          ...s,
          assignedMemberId: bulkAssignments[s.id] ?? null,
        }))
      );
      setSuccess("Bulk TOD assignments saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
      setShowBulkModal(false);
      setShowConfirmModal(false);
    } catch (err) {
      setError(`Error saving bulk assignments: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((p) => ({ ...p, slots: false }));
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

  /* -------------------------- Calendar Handlers -------------------------- */
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

  /* --------------------------- UI helpers --------------------------- */
  const handleBack = () => {
    setActiveSection(null);
    setError("");
    setSuccess("");
    setShowBulkModal(false);
    setShowViewAssignments(false);
    setShowManageTimingsModal(false);
    setExpandedCard(null);
  };

  const toggleCard = (id) => {
    setExpandedCard((prev) => (prev === id ? null : id));
  };

  const toggleShowPassword = (userId) => {
    setShowPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  /* ------------------------------- JSX ------------------------------- */
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
            onClick={() => setActiveSection("n-mris")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "n-mris" ? "bg-teal-600 text-white" : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">N-MRIs</h2>
          </motion.div>

          <motion.div
            onClick={() => setActiveSection("mspr")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "mspr" || activeSection === "mspr-pre" || activeSection === "mspr-primary"
                ? "bg-teal-600 text-white"
                : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">MSPR</h2>
          </motion.div>

          <motion.div
            onClick={() => setActiveSection("mhcp")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "mhcp" || activeSection === "mhcp1" || activeSection === "mhcp2"
                ? "bg-teal-600 text-white"
                : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">MHCP</h2>
          </motion.div>

          <motion.div
            onClick={() => setActiveSection("calendar")}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSection === "calendar" ? "bg-teal-600 text-white" : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">Calendar</h2>
          </motion.div>
        </div>

        {activeSection === "n-mris" && (
          <motion.button
            onClick={() => setShowBulkModal(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold text-lg bg-purple-600 hover:bg-purple-700 transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Manage All Allotments
          </motion.button>
        )}

        {activeSection === "n-mris" && (
          <div className="space-y-4 mt-4">
            <h3 className="text-xl font-semibold text-gray-800 text-center">Current Allotted TODs</h3>
            {["Block 1 (Slots 1-6)", "Block 2 (Slots 7-9)", "Block 3 (Slots 10-11)", "Block 4 (Slots 12-14)", "Block 5 (Slots 15-16)", "Block 6 (Slot 145)"].map(
              (blockTitle, blockIndex) => (
                <div key={blockIndex} className="mb-8">
                  <h4 className="text-lg font-medium text-gray-700 mb-4 text-center">{blockTitle}</h4>
                  <div className="grid grid-cols-12 gap-4 mb-6">
                    <div className="col-span-2 font-medium text-gray-700">Slot ID</div>
                    <div className="col-span-6 font-medium text-gray-700">Slot Name</div>
                    <div className="col-span-4 font-medium text-gray-700">Allotted TOD</div>
                  </div>
                  {slots
                    .filter((slot) => {
                      if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                      if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                      if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                      if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                      if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                      if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
                      return false;
                    })
                    .map((slot) => (
                      <div key={slot.id} className="grid grid-cols-12 gap-4 items-center mb-4">
                        <div className="col-span-2 text-gray-700">Slot {slot.id}</div>
                        <div className="col-span-6 text-gray-700">{slot.name}</div>
                        <div className="col-span-4 text-gray-700">
                          {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}
                        </div>
                      </div>
                    ))}
                </div>
              )
            )}
          </div>
        )}

        {activeSection === "n-mris" && (
          <motion.button
            onClick={() => setShowManageTimingsModal(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold text-lg bg-green-600 hover:bg-green-700 transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Manage Slot Timings
          </motion.button>
        )}

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
              {/* Manage Team */}
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

              {/* Manage Times */}
              <motion.div
                className="flex-1 bg-white rounded-lg shadow-md p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("times")}
                whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(128, 0, 128, 0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Manage Day-Close Times</h2>
                  <p className="text-base sm:text-lg text-gray-600">Set open and close times for different user types.</p>
                </div>
              </motion.div>

              {/* Manage Students */}
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

              {/* Manage Calendar */}
              <motion.div
                className="flex-1 bg-white rounded-lg shadow-md p-6 sm:p-8 flex flex-col justify-between cursor-pointer h-full"
                onClick={() => setActiveSection("calendar")}
                whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 0, 128, 0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">Manage Calendar</h2>
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
              {/* TEAM SECTION */}
              {activeSection === "team" && (
                <div className="space-y-6">
                  {loading.team || loading.userTimes ? (
                    <p className="text-gray-600 text-center text-lg">Loading team members...</p>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-800">Manage Team</h2>
                        <select
                          value={teamFilter}
                          onChange={(e) => setTeamFilter(e.target.value)}
                          className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base bg-white"
                        >
                          <option value="members">Normal Team Members</option>
                          <option value="managers">Team Managers</option>
                          <option value="all">All Users</option>
                        </select>
                      </div>

                      {users.length === 0 ? (
                        <p className="text-gray-600 text-center text-lg">No users found. Please check the database or authentication.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {users
                              .filter((user) => {
                                if (teamFilter === "members") return user.role === "member";
                                if (teamFilter === "managers") return user.role === "team_manager" || user.role === "admin";
                                return true;
                              })
                              .map((user) => {
                                const times = userTimes[user.id] || { dayOpenedAt: "", dayClosedAt: "", useCustomTimes: false };
                                return (
                                  <motion.div
                                    key={user.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="bg-white rounded-lg shadow-md p-4 flex flex-col gap-2"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div>
                                        <h3 className="text-lg font-semibold text-gray-800">{user.name}</h3>
                                        <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                                        <p className="text-sm text-gray-500">
                                          Supervisor: {users.find((u) => u.id === user.immediate_supervisor)?.name || "None"}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {/* Expand / collapse */}
                                        <motion.button
                                          onClick={() => toggleCard(user.id)}
                                          className="text-teal-600 hover:text-teal-700"
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          title={expandedCard === user.id ? "Collapse" : "Expand"}
                                        >
                                          <svg className={`w-5 h-5 transform ${expandedCard === user.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </motion.button>

                                        {/* Delete user */}
                                        <motion.button
                                          onClick={() => requestDeleteUser(user)}
                                          className="text-red-600 hover:text-red-700"
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          title="Remove user"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 7h12M9 7v10m6-10v10M4 7h16l-1 12a2 2 0 01-2 2H7a2 2 0 01-2-2L4 7zm5-3h6l1 3H8l1-3z" />
                                          </svg>
                                        </motion.button>
                                      </div>
                                    </div>

                                    <AnimatePresence>
                                      {expandedCard === user.id && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="space-y-4 pt-4 border-t border-gray-200"
                                        >
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Name</label>
                                            <input
                                              type="text"
                                              value={user.name || ""}
                                              onChange={(e) => handleUserChange(user.id, "name", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                              placeholder="Enter name"
                                            />
                                          </div>

                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Email</label>
                                            <input
                                              type="email"
                                              value={user.email || ""}
                                              onChange={(e) => handleUserChange(user.id, "email", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                              placeholder="Enter email"
                                            />
                                          </div>

                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">WhatsApp Number</label>
                                            <input
                                              type="text"
                                              value={user.whatsapp_number || ""}
                                              onChange={(e) => handleUserChange(user.id, "whatsapp_number", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                              placeholder="+1234567890"
                                            />
                                          </div>

                                          {/* Password with show/hide */}
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Password (optional)</label>
                                            <div className="mt-1 flex gap-2">
                                              <input
                                                type={showPasswords[user.id] ? "text" : "password"}
                                                value={user.password || ""}
                                                onChange={(e) => handleUserChange(user.id, "password", e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                                placeholder="Enter new password"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => toggleShowPassword(user.id)}
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                                                title={showPasswords[user.id] ? "Hide password" : "Show password"}
                                              >
                                                {showPasswords[user.id] ? "Hide" : "Show"}
                                              </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                              Leave blank to keep current password.
                                            </p>
                                          </div>

                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Role</label>
                                            <select
                                              value={user.role}
                                              onChange={(e) => handleUserChange(user.id, "role", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                            >
                                              {roleTypes.map((role) => (
                                                <option key={role} value={role}>
                                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          {user.role === "team_manager" && (
                                            <div>
                                              <label className="block text-sm font-medium text-gray-700">Team Manager Type</label>
                                              <select
                                                value={user.team_manager_type || ""}
                                                onChange={(e) => handleUserChange(user.id, "team_manager_type", e.target.value)}
                                                className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                              >
                                                <option value="">Select Type</option>
                                                {teamManagerTypes.map((type) => (
                                                  <option key={type} value={type}>
                                                    {type.replace("_", " ").toUpperCase()}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}

                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Type</label>
                                            <select
                                              value={user.type}
                                              onChange={(e) => handleUserChange(user.id, "type", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                            >
                                              {userTypes.map((type) => (
                                                <option key={type} value={type}>
                                                  {type.replace("_", " ").toUpperCase()}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Member Scope</label>
                                            <select
                                              value={user.member_scope || ""}
                                              onChange={(e) => handleUserChange(user.id, "member_scope", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                            >
                                              {memberScopes.map((scope) => (
                                                <option key={scope} value={scope}>
                                                  {scope.replace("_", " ").toUpperCase()}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          <div>
                                            <label className="block text-sm font-medium text-gray-700">Immediate Supervisor</label>
                                            <select
                                              value={user.immediate_supervisor || ""}
                                              onChange={(e) => handleUserChange(user.id, "immediate_supervisor", e.target.value)}
                                              className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                                            >
                                              <option value="">None</option>
                                              {users
                                                .filter((u) => u.id !== user.id && (u.role === "admin" || u.role === "team_manager"))
                                                .map((supervisor) => (
                                                  <option key={supervisor.id} value={supervisor.id}>
                                                    {supervisor.name} ({supervisor.role})
                                                  </option>
                                                ))}
                                            </select>
                                          </div>

                                          {/* NEW: Per-user Day Open / Day Close */}
                                          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                            <div className="flex items-center justify-between">
                                              <label className="text-sm font-semibold text-gray-700">
                                                Use custom Day Open / Day Close for this user
                                              </label>
                                              <input
                                                type="checkbox"
                                                checked={!!times.useCustomTimes}
                                                onChange={(e) => handleUserTimeToggle(user.id, e.target.checked)}
                                                className="h-4 w-4"
                                              />
                                            </div>

                                            <p className="text-xs text-gray-500 mt-1">
                                              When off, this user follows the default <code>open_close_times</code> for their type.
                                            </p>

                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                              <div>
                                                <label className="block text-sm text-gray-700">Day Open</label>
                                                <input
                                                  type="time"
                                                  value={times.dayOpenedAt || ""}
                                                  onChange={(e) => handleUserTimeChange(user.id, "dayOpenedAt", e.target.value)}
                                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base disabled:opacity-60"
                                                  disabled={!times.useCustomTimes}
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-sm text-gray-700">Day Close</label>
                                                <input
                                                  type="time"
                                                  value={times.dayClosedAt || ""}
                                                  onChange={(e) => handleUserTimeChange(user.id, "dayClosedAt", e.target.value)}
                                                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base disabled:opacity-60"
                                                  disabled={!times.useCustomTimes}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                );
                              })}
                          </div>

                          <motion.button
                            onClick={saveAllChanges}
                            disabled={saving.team || saving.userTimes || users.length === 0}
                            className={`w-full sm:w-auto mt-4 px-6 py-3 rounded-lg text-white font-semibold text-lg transition-all duration-200 bg-teal-600 hover:bg-teal-700 shadow-md ${
                              saving.team || saving.userTimes || users.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            whileHover={{ scale: saving.team || saving.userTimes || users.length === 0 ? 1 : 1.05 }}
                            whileTap={{ scale: saving.team || saving.userTimes || users.length === 0 ? 1 : 0.95 }}
                          >
                            {saving.team || saving.userTimes ? "Saving..." : "Save All Changes"}
                          </motion.button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSection === "times" && <ManageDayClose setError={setError} setSuccess={setSuccess} />}

              {activeSection === "n-mris" && (
                <ManageSlots
                  slots={slots}
                  setSlots={setSlots}
                  loading={loading.slots}
                  saving={saving.slots}
                  editSlot={editSlot}
                  setEditSlot={setEditSlot}
                  saveSlotAssignment={saveSlotAssignment}
                  deleteSlotAssignment={deleteSlotAssignment}
                  members={members}
                />
              )}

              {activeSection === "mspr" && (
                <div className="space-y-4 h-full">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Pre-Primary Column</h2>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Primary Column</h2>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "mhcp" && (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">HW Urgencies (6:30 - 7:30 PM)</h2>
                    <div className="grid grid-cols-4 gap-4">
                      {["T2T3 (Mon-Thu)", "T2T3 (Sat)", "T1", "T4"].map((schedule, index) => (
                        <motion.div
                          key={index}
                          className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between h-48"
                          whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
                          transition={{ duration: 0.2 }}
                        >
                          <h3 className="font-semibold text-teal-900 mb-2">{schedule}</h3>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Beyond Potential (7:30 - 8:30 PM)</h2>
                    <div className="grid grid-cols-4 gap-4">
                      {["T1", "T2T3", "T4", "T4Jr"].map((schedule, index) => (
                        <motion.div
                          key={index}
                          className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between h-48"
                          whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
                          transition={{ duration: 0.2 }}
                        >
                          <h3 className="font-semibold text-teal-900 mb-2">{schedule}</h3>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <motion.button
                      onClick={() => setActiveSection("mhcp1")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSection === "mhcp1" ? "bg-teal-600 text-white" : "bg-teal-500 text-white hover:bg-teal-600"
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Manage MSPR
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveSection("mhcp2")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSection === "mhcp2" ? "bg-teal-600 text-white" : "bg-teal-500 text-white hover:bg-teal-600"
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Manage MHCP
                    </motion.button>
                  </div>
                </div>
              )}

              {activeSection === "students" && (
                <div className="space-y-4 h-full">
                  {loading.students ? (
                    <p className="text-gray-600 text-center text-lg">Loading students...</p>
                  ) : students.length === 0 ? (
                    <p className="text-gray-600 text-center text-lg">No students found. Please check the database.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Hostellers</h2>
                        {Object.entries(
                          students
                            .filter((s) => s.residentialStatus === "hosteller")
                            .reduce((acc, s) => {
                              (acc[s.className] = acc[s.className] || []).push(s);
                              return acc;
                            }, {})
                        )
                          .sort()
                          .map(([className, classStudents]) => (
                            <motion.div key={className} className="mb-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                              <h3 className="text-lg font-medium text-teal-900 mb-2">{className}</h3>
                              <div className="space-y-2">
                                {classStudents.map((student) => (
                                  <div key={student.id} className="bg-gray-50 rounded-lg p-3 shadow-sm flex justify-between items-center">
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

                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Day Scholars</h2>
                        {Object.entries(
                          students
                            .filter((s) => s.residentialStatus === "dayscholar")
                            .reduce((acc, s) => {
                              (acc[s.className] = acc[s.className] || []).push(s);
                              return acc;
                            }, {})
                        )
                          .sort()
                          .map(([className, classStudents]) => (
                            <motion.div key={className} className="mb-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                              <h3 className="text-lg font-medium text-teal-900 mb-2">{className}</h3>
                              <div className="space-y-2">
                                {classStudents.map((student) => (
                                  <div key={student.id} className="bg-gray-50 rounded-lg p-3 shadow-sm flex justify-between items-center">
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

        {/* BULK MODAL */}
        <AnimatePresence>
          {showBulkModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Manage All Allotments</h2>
                {["Block 1 (Slots 1-6)", "Block 2 (Slots 7-9)", "Block 3 (Slots 10-11)", "Block 4 (Slots 12-14)", "Block 5 (Slots 15-16)", "Block 6 (Slot 145)"].map(
                  (blockTitle, blockIndex) => (
                    <div key={blockIndex} className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">{blockTitle}</h3>
                      <div className="grid grid-cols-12 gap-4 mb-6">
                        <div className="col-span-2 font-medium text-gray-700">Slot ID</div>
                        <div className="col-span-6 font-medium text-gray-700">Slot Name</div>
                        <div className="col-span-4 font-medium text-gray-700">TOD Allotment</div>
                      </div>
                      {slots
                        .filter((slot) => {
                          if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                          if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                          if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                          if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                          if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                          if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
                          return false;
                        })
                        .map((slot) => (
                          <div key={slot.id} className="grid grid-cols-12 gap-4 items-center mb-4">
                            <div className="col-span-2 text-gray-700">Slot {slot.id}</div>
                            <div className="col-span-6 text-gray-700">{slot.name}</div>
                            <select
                              value={bulkAssignments[slot.id] || ""}
                              onChange={(e) =>
                                setBulkAssignments((prev) => ({
                                  ...prev,
                                  [slot.id]: e.target.value ? parseInt(e.target.value) : null,
                                }))
                              }
                              className="col-span-4 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                            >
                              <option value="">Unassigned</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                    </div>
                  )
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <motion.button onClick={() => setShowBulkModal(false)} className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={saving.slots}
                  >
                    {saving.slots ? "Saving..." : "Bulk Allot TODs"}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONFIRM BULK */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-4">Confirm TOD Allotments</h2>
                <p className="text-gray-600 mb-4">Are you sure you want to apply these TOD assignments?</p>
                <div className="flex justify-end gap-2">
                  <motion.button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={saveBulkAssignments}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={saving.slots}
                  >
                    {saving.slots ? "Confirming..." : "Confirm"}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MANAGE TIMINGS */}
        <AnimatePresence>
          {showManageTimingsModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Manage Slot Timings</h2>
                {["Block 1 (Slots 1-6)", "Block 2 (Slots 7-9)", "Block 3 (Slots 10-11)", "Block 4 (Slots 12-14)", "Block 5 (Slots 15-16)", "Block 6 (Slot 145)"].map(
                  (blockTitle, blockIndex) => (
                    <div key={blockIndex} className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">{blockTitle}</h3>
                      <div className="grid grid-cols-12 gap-4 mb-6">
                        <div className="col-span-2 font-medium text-gray-700">Slot ID</div>
                        <div className="col-span-4 font-medium text-gray-700">Slot Name</div>
                        <div className="col-span-3 font-medium text-gray-700">Start Time</div>
                        <div className="col-span-3 font-medium text-gray-700">End Time</div>
                      </div>
                      {slots
                        .filter((slot) => {
                          if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                          if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                          if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                          if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                          if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                          if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
                          return false;
                        })
                        .map((slot) => (
                          <div key={slot.id} className="grid grid-cols-12 gap-4 items-center mb-4">
                            <div className="col-span-2 text-gray-700">Slot {slot.id}</div>
                            <div className="col-span-4 text-gray-700">{slot.name}</div>
                            <input
                              type="time"
                              value={editTimingsSlot === slot.id ? slots.find((s) => s.id === slot.id).startTime || "" : slot.startTime}
                              onChange={(e) => {
                                setEditTimingsSlot(slot.id);
                                setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, startTime: e.target.value } : s)));
                              }}
                              className="col-span-3 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                            />
                            <input
                              type="time"
                              value={editTimingsSlot === slot.id ? slots.find((s) => s.id === slot.id).endTime || "" : slot.endTime}
                              onChange={(e) => {
                                setEditTimingsSlot(slot.id);
                                setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, endTime: e.target.value } : s)));
                              }}
                              className="col-span-3 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                            />
                          </div>
                        ))}
                    </div>
                  )
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <motion.button onClick={() => setShowManageTimingsModal(false)} className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      slots.forEach((slot) => {
                        if (slot.startTime && slot.endTime) {
                          saveSlotTimings(slot.id, slot.startTime, slot.endTime);
                        }
                      });
                    }}
                    className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={saving.slots}
                  >
                    {saving.slots ? "Saving..." : "Save Timings"}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CALENDAR SECTION */}
        <AnimatePresence>
          {activeSection === "calendar" && (
            <motion.div key="calendar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="w-full h-full flex flex-col gap-4">
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* DELETE USER CONFIRMATION */}
        <AnimatePresence>
          {confirmDeleteUser && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
                    onClick={deleteUser}
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
