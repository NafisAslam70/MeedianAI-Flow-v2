"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import ManageCalendar from "@/components/manageMeedian/ManageCalendar";

const fetcher = (url) => fetch(url, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function CalendarPage() {
  const { data, error } = useSWR("/api/admin/manageMeedian?section=schoolCalendar", fetcher, { dedupingInterval: 60000 });
  const [calendar, setCalendar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (data?.calendar) {
      setCalendar(data.calendar);
      setLoading(false);
    }
    if (error) {
      setErrMsg(`Failed to load calendar: ${error.message}`);
      setLoading(false);
    }
  }, [data, error]);

  const handleCalendarChange = (id, field, value) => {
    setCalendar((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const onSaveCalendar = async () => {
    setErrMsg("");
    setOkMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: calendar }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setOkMsg("Calendar saved successfully!");
      setTimeout(() => setOkMsg(""), 2500);
    } catch (e) {
      setErrMsg(e.message);
    }
  };

  const onAddEntry = async (entry) => {
    setErrMsg("");
    setOkMsg("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=schoolCalendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setCalendar((prev) => [...prev, j.entry]);
      setOkMsg("Week added!");
      setTimeout(() => setOkMsg(""), 2000);
    } catch (e) {
      setErrMsg(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Calendar</h1>
        {errMsg && <p className="text-sm text-red-600 mt-1">{errMsg}</p>}
        {okMsg && <p className="text-sm text-emerald-600 mt-1">{okMsg}</p>}
      </div>
      <ManageCalendar
        calendar={calendar}
        loading={loading}
        isAdmin={true}
        onCalendarChange={handleCalendarChange}
        onSaveCalendar={onSaveCalendar}
        onAddEntry={onAddEntry}
        error={errMsg}
        success={okMsg}
        setError={setErrMsg}
        setSuccess={setOkMsg}
      />
    </div>
  );
}
