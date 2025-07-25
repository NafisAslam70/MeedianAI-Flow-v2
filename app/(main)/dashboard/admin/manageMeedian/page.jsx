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

export default function ManageTeamPage() {
  const [users, setUsers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState({ team: true, slots: true, calendar: true, students: true });
  const [saving, setSaving] = useState({ team: false, slots: false, calendar: false });
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
  const userTypes = ["residential", "non_residential", "semi_residential"];
  const roleTypes = ["member", "admin", "team_manager"];

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
  const { data: calendarData, error: calendarError } = useSWR(
    "/api/admin/manageMeedian?section=schoolCalendar",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

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
      console.log("Fetched users:", userData.users); // Debug: Log fetched users
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
      console.log("Fetched slots:", slotData.slots); // Debug: Log fetched slots
      setSlots(slotData.slots || []);
      // Initialize bulkAssignments with current assignments
      setBulkAssignments(
        slotData.slots.reduce((acc, slot) => ({
          ...acc,
          [slot.id]: slot.assignedMemberId || null,
        }), {})
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
      console.log("Fetched calendar:", calendarData.calendar); // Debug: Log fetched calendar
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
      console.log("Fetched students:", studentData.students); // Debug: Log fetched students
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
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };

  const saveTeamChanges = async () => {
    setSaving((prev) => ({ ...prev, team: true }));
    setError("");
    setSuccess("");
    try {
      console.log("Saving team changes:", users); // Debug: Log team updates
      const res = await fetch("/api/admin/manageMeedian?section=team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: users }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Team save response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }
      console.log("Team save response:", responseData); // Debug: Log success response
      setSuccess("Team changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=team"); // Refresh team data
    } catch (err) {
      console.error("Save team error:", err);
      setError(`Error saving team: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, team: false }));
    }
  };

  const saveSlotAssignment = async (slotId, memberId) => {
    setSaving((prev) => ({ ...prev, slots: true }));
    setError("");
    setSuccess("");
    try {
      console.log("Saving slot assignment:", { slotId, memberId }); // Debug: Log assignment
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ slotId, memberId }] }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Slot assignment save response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }
      console.log("Slot assignment save response:", responseData); // Debug: Log success response
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, assignedMemberId: memberId } : slot
        )
      );
      setBulkAssignments((prev) => ({ ...prev, [slotId]: memberId }));
      setSuccess("Slot assignment saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true }); // Force revalidation
    } catch (err) {
      console.error("Save slot assignment error:", err);
      setError(`Error saving slot assignment: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((prev) => ({ ...prev, slots: false }));
      setEditSlot(null);
    }
  };

  const deleteSlotAssignment = async (slotId) => {
    setSaving((prev) => ({ ...prev, slots: true }));
    setError("");
    setSuccess("");
    try {
      console.log("Deleting slot assignment for slotId:", slotId); // Debug: Log deletion
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Delete slot assignment response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Delete failed: ${res.status}`);
      }
      console.log("Delete slot assignment response:", responseData); // Debug: Log success response
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, assignedMemberId: null } : slot
        )
      );
      setBulkAssignments((prev) => ({ ...prev, [slotId]: null }));
      setSuccess("Slot assignment deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
    } catch (err) {
      console.error("Delete slot assignment error:", err);
      setError(`Error deleting slot assignment: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, slots: false }));
      setEditSlot(null);
    }
  };

  const saveBulkAssignments = async () => {
    setSaving((prev) => ({ ...prev, slots: true }));
    setError("");
    setSuccess("");
    try {
      const updates = Object.entries(bulkAssignments)
        .filter(([_, memberId]) => memberId !== null)
        .map(([slotId, memberId]) => ({
          slotId: parseInt(slotId),
          memberId,
        }));
      console.log("Saving bulk assignments:", updates); // Debug: Log bulk assignments
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Bulk assignment save response error:", responseData);
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }
      console.log("Bulk assignment save response:", responseData);
      setSlots((prev) =>
        prev.map((slot) => ({
          ...slot,
          assignedMemberId: bulkAssignments[slot.id] || null,
        }))
      );
      setSuccess("Bulk TOD assignments saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
      setShowBulkModal(false);
      setShowConfirmModal(false);
    } catch (err) {
      console.error("Save bulk assignments error:", err);
      setError(`Error saving bulk assignments: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((prev) => ({ ...prev, slots: false }));
    }
  };

  const saveSlotTimings = async (slotId, startTime, endTime) => {
    setSaving((prev) => ({ ...prev, slots: true }));
    setError("");
    setSuccess("");
    try {
      console.log("Saving slot timings:", { slotId, startTime, endTime }); // Debug: Log timings
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ slotId, startTime: startTime + ":00", endTime: endTime + ":00" }] }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Slot timings save response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }
      console.log("Slot timings save response:", responseData); // Debug: Log success response
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, startTime, endTime } : slot
        )
      );
      setSuccess("Slot timings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=slots", undefined, { revalidate: true });
    } catch (err) {
      console.error("Save slot timings error:", err);
      setError(`Error saving slot timings: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((prev) => ({ ...prev, slots: false }));
      setEditTimingsSlot(null);
    }
  };

  const handleCalendarChange = (id, field, value) => {
    setCalendar((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const saveCalendarChanges = async () => {
    setSaving((prev) => ({ ...prev, calendar: true }));
    setError("");
    setSuccess("");
    try {
      console.log("Saving calendar changes:", calendar); // Debug: Log calendar updates
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: calendar }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Calendar save response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }
      console.log("Calendar save response:", responseData); // Debug: Log success response
      setSuccess("School calendar saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=schoolCalendar");
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
      console.log("Adding calendar entry:", entry); // Debug: Log new entry
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Add calendar entry response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Save failed: ${res.status}`);
      }
      console.log("Add calendar entry response:", responseData); // Debug: Log success response
      setCalendar((prev) => [...prev, responseData.entry]);
      setSuccess("Calendar entry added successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=schoolCalendar");
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
      console.log("Deleting calendar entry with id:", id); // Debug: Log deletion
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        console.error("Delete calendar entry response error:", responseData); // Debug: Log error response
        throw new Error(responseData.error || `Delete failed: ${res.status}`);
      }
      console.log("Delete calendar entry response:", responseData); // Debug: Log success response
      setCalendar((prev) => prev.filter((entry) => entry.id !== id));
      setSuccess("Calendar entry deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutate("/api/admin/manageMeedian?section=schoolCalendar");
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
    setShowBulkModal(false);
    setShowViewAssignments(false);
    setShowManageTimingsModal(false);
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
              activeSection === "mspr" || activeSection === "mspr-pre" || activeSection === "mspr-primary"
                ? "bg-teal-700 text-white"
                : "hover:bg-teal-100"
            }`}
            whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0, 128, 128, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-xl font-semibold text-center text-gray-700">MSPR</h2>
          </motion.div>
          <motion.div
            onClick={() => setActiveSection("mhcp")}
            className={`flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6 flex flex-col justify-between cursor-pointer ${
             activeSection === "mhcp" || activeSection === "mhcp1" || activeSection === "mhcp2"
                ? "bg-teal-700 text-white"
                : "hover:bg-teal-100"
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

        {/* Manage All Allotments Button */}
        {activeSection === "n-mris" && (
          <motion.button
            onClick={() => setShowBulkModal(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-semibold text-lg bg-purple-600 hover:bg-purple-700 transition-all duration-200"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            Manage All Allotments
          </motion.button>
        )}

        {/* View All Allotted TODs */}
        {activeSection === "n-mris" && (
          <div className="space-y-4 mt-4">
            <h3 className="text-xl font-semibold text-gray-700 text-center">Current Allotted TODs</h3>
            {["Block 1 (Slots 1-6)", "Block 2 (Slots 7-9)", "Block 3 (Slots 10-11)", "Block 4 (Slots 12-14)", "Block 5 (Slots 15-16)", "Block 6 (Slot 145)"].map((blockTitle, blockIndex) => (
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
            ))}
          </div>
        )}

        {/* Manage Slot Timings Button */}
        {activeSection === "n-mris" && (
          <motion.button
            onClick={() => setShowManageTimingsModal(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-semibold text-lg bg-green-600 hover:bg-green-700 transition-all duration-200"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
          >
            Manage Slot Timings
          </motion.button>
        )}

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
                    <svg
                      className="w-12 h-12 sm:w-16 sm:h-16 text-teal-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2">Manage Meedian Team</h2>
                  <p className="text-base sm:text-lg text-gray-600">
                    Update team member details such as name, email, role, and type.
                  </p>
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
                    <svg
                      className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
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
                    <svg
                      className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2">Manage Meedian Students</h2>
                  <p className="text-base sm:text-lg text-gray-600">
                    View and manage student details, grouped by hostel and day scholars.
                  </p>
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
                    <svg
                      className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
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
                        <p className="text-gray-600 text-center text-lg">
                          No users found. Please check the database or authentication.
                        </p>
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
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSection === "mhcp1" ? "bg-teal-700 text-white" : "bg-teal-600 text-white hover:bg-teal-700"
                      }`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Manage MSPR
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveSection("mhcp2")}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        activeSection === "mhcp2" ? "bg-teal-700 text-white" : "bg-teal-600 text-white hover:bg-teal-700"
                      }`}
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
                        )
                          .sort()
                          .map(([className, classStudents]) => (
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
                        )
                          .sort()
                          .map(([className, classStudents]) => (
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

        {/* Bulk Allotment Modal */}
        <AnimatePresence>
          {showBulkModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Manage All Allotments</h2>
                {["Block 1 (Slots 1-6)", "Block 2 (Slots 7-9)", "Block 3 (Slots 10-11)", "Block 4 (Slots 12-14)", "Block 5 (Slots 15-16)", "Block 6 (Slot 145)"].map((blockTitle, blockIndex) => (
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
                            className="col-span-4 p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
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
                ))}
                <div className="mt-6 flex justify-end gap-2">
                  <motion.button
                    onClick={() => setShowBulkModal(false)}
                    className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                    whileHover={{ scale: 1.03 }}
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

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
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
                  <motion.button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={saveBulkAssignments}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                    whileHover={{ scale: 1.03 }}
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
      </div>
    </motion.div>
  );
}