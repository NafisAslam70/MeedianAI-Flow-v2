"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import Bulk from "../Bulk";
import Button from "@/components/ui/Button";

const fetcher = (url) => fetch(url, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());
const ensureSeconds = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t || null);

export default function BulkPage() {
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [loading, setLoading] = useState({ slots: true, calendar: true });
  const [saving, setSaving] = useState({ slots: false, calendar: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editSlot, setEditSlot] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showManageTimingsModal, setShowManageTimingsModal] = useState(false);
  const [editTimingsSlot, setEditTimingsSlot] = useState(null);

  const { data: userData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, { dedupingInterval: 60000 });
  const { data: slotData, error: slotError } = useSWR("/api/admin/manageMeedian?section=slots", fetcher, { dedupingInterval: 60000 });
  const { data: calendarData, error: calendarError } = useSWR("/api/admin/manageMeedian?section=schoolCalendar", fetcher, { dedupingInterval: 60000 });

  useEffect(() => {
    if (userData?.users) setMembers(userData.users.filter((u) => u.role === "member" || u.role === "team_manager"));
  }, [userData]);

  useEffect(() => {
    if (slotData?.slots) {
      setSlots(slotData.slots);
      setBulkAssignments(
        (slotData.slots || []).reduce((acc, slot) => {
          acc[slot.id] = slot.assignedMemberId || null;
          return acc;
        }, {})
      );
      setLoading((p) => ({ ...p, slots: false }));
    }
    if (slotError) {
      setError(`Failed to load slots: ${slotError.message}`);
      setLoading((p) => ({ ...p, slots: false }));
    }
  }, [slotData, slotError]);

  useEffect(() => {
    if (calendarData?.calendar) {
      setCalendar(calendarData.calendar);
      setLoading((p) => ({ ...p, calendar: false }));
    }
    if (calendarError) {
      setError(`Failed to load school calendar: ${calendarError.message}`);
      setLoading((p) => ({ ...p, calendar: false }));
    }
  }, [calendarData, calendarError]);

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
    } catch (err) {
      setError(`Error saving slot assignment: ${err.message}`);
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
        body: JSON.stringify({ updates: [{ slotId, startTime: ensureSeconds(startTime), endTime: ensureSeconds(endTime) }] }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, startTime, endTime } : s)));
      setSuccess("Slot timings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(`Error saving slot timings: ${err.message}`);
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
    } catch (err) {
      setError(`Error saving calendar: ${err.message}`);
    } finally {
      setSaving((p) => ({ ...p, calendar: false }));
    }
  };

  const addCalendarEntry = async (entry) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Create failed: ${res.status}`);
      setCalendar((prev) => [...prev, responseData.entry]);
      setSuccess("Calendar entry added!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(`Error adding calendar entry: ${err.message}`);
    }
  };

  const deleteCalendarEntry = async (id) => {
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
      setCalendar((prev) => prev.filter((c) => c.id !== id));
      setSuccess("Calendar entry deleted!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(`Error deleting calendar entry: ${err.message}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Daily Slot Management</h1>
        <a href="/dashboard/admin/manageMeedian/mri-roles">
          <Button variant="light" size="sm">Back</Button>
        </a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
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
    </div>
  );
}
