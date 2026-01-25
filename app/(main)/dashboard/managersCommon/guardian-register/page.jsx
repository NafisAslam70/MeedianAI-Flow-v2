"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { RefreshCw, Trash2 } from "lucide-react";

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (res.status === 401) {
    const payload = await res.json().catch(() => ({}));
    const error = new Error(payload?.error || "unauthorized");
    error.status = 401;
    throw error;
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatTime = (value) => {
  if (!value) return "—";
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatToken = (value) => {
  if (!value || Number.isNaN(Number(value))) return "—";
  return `G-${String(value).padStart(3, "0")}`;
};

const purposeOptions = [
  "Sat/Sun meet student",
  "Random day meet",
  "Report after holiday",
  "Regular school (DS/DB)",
  "Other",
];

const normalizeKey = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const initialForm = {
  guardianName: "",
  studentName: "",
  className: "",
  purpose: "",
  purposeNote: "",
  assignToken: true,
  feesSubmitted: false,
  satisfactionIslamic: "",
  satisfactionAcademic: "",
  inTime: "",
  outTime: "",
};

export default function GuardianRegisterPage() {
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [queueMessage, setQueueMessage] = useState("");
  const [callingNext, setCallingNext] = useState(false);

  const key = selectedDate ? `/api/managersCommon/guardian-register?date=${selectedDate}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { dedupingInterval: 15000 });
  const queueKey = selectedDate ? `/api/managersCommon/guardian-register?section=queue&date=${selectedDate}` : null;
  const { data: queueData, error: queueError, mutate: mutateQueue, isLoading: queueLoading } = useSWR(queueKey, fetcher, {
    refreshInterval: 5000,
    dedupingInterval: 1500,
  });
  const { data: optionsData } = useSWR("/api/managersCommon/guardian-register?section=options", fetcher, {
    dedupingInterval: 60000,
  });

  const entries = useMemo(() => data?.entries || [], [data?.entries]);
  const students = useMemo(() => optionsData?.students || [], [optionsData?.students]);
  const nowServing = queueData?.nowServing || null;
  const nextUp = queueData?.nextUp || [];

  const studentLookup = useMemo(() => {
    const map = new Map();
    for (const student of students) {
      const name = student?.name ? student.name.trim() : "";
      if (!name) continue;
      const key = normalizeKey(name);
      if (!key || map.has(key)) continue;
      map.set(key, {
        studentName: name,
        guardianName: student.guardianName ? student.guardianName.trim() : "",
        className: student.className || "",
      });
    }
    return map;
  }, [students]);

  const guardianLookup = useMemo(() => {
    const map = new Map();
    for (const student of students) {
      const guardianName = student?.guardianName ? student.guardianName.trim() : "";
      const studentName = student?.name ? student.name.trim() : "";
      if (!guardianName || !studentName) continue;
      const key = normalizeKey(guardianName);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { guardianName, students: [] });
      }
      map.get(key).students.push({ name: studentName, className: student.className || "" });
    }
    return map;
  }, [students]);

  const guardianOptions = useMemo(() => {
    const seen = new Map();
    for (const student of students) {
      const name = student?.guardianName ? student.guardianName.trim() : "";
      if (!name) continue;
      seen.set(normalizeKey(name), name);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const unauthorized = error?.status === 401;

  const updateFormField = (field) => (event) => {
    const { type, value, checked } = event.target;
    setForm((prev) => ({ ...prev, [field]: type === "checkbox" ? checked : value }));
  };

  const handleGuardianChange = (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const next = { ...prev, guardianName: value };
      const match = guardianLookup.get(normalizeKey(value));
      if (match && match.students.length === 1) {
        const [student] = match.students;
        next.studentName = student.name;
        if (student.className) next.className = student.className;
      }
      return next;
    });
  };

  const handleStudentChange = (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const next = { ...prev, studentName: value };
      const match = studentLookup.get(normalizeKey(value));
      if (match) {
        next.guardianName = match.guardianName || "";
        if (match.className) next.className = match.className;
      }
      return next;
    });
  };

  const handlePurposeChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      purpose: value,
      purposeNote: value === "Other" ? prev.purposeNote : "",
    }));
  };

  const resetForm = () => setForm(initialForm);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setMessage("");

    if (!form.guardianName.trim() || !form.studentName.trim() || !form.className.trim() || !form.purpose.trim()) {
      setMessage("Guardian, student, class, and purpose are required.");
      return;
    }
    if (form.purpose === "Other" && !form.purposeNote.trim()) {
      setMessage("Add a note for Other purpose.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/managersCommon/guardian-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate: selectedDate,
          ...form,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      const tokenLabel = payload?.tokenNumber ? formatToken(payload.tokenNumber) : null;
      setMessage(tokenLabel ? `Entry saved. Token ${tokenLabel}.` : "Entry saved.");
      resetForm();
      await mutate();
      await mutateQueue();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  const handleCallNext = async () => {
    if (callingNext) return;
    setQueueMessage("");
    setCallingNext(true);
    try {
      const res = await fetch("/api/managersCommon/guardian-register?section=call-next", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitDate: selectedDate }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      const tokenLabel = payload?.called?.tokenNumber ? formatToken(payload.called.tokenNumber) : "—";
      setQueueMessage(`Now serving ${tokenLabel}.`);
      await mutateQueue();
    } catch (err) {
      console.error(err);
      setQueueMessage(err.message || "Unable to call next token.");
    } finally {
      setCallingNext(false);
      setTimeout(() => setQueueMessage(""), 2500);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const confirm = window.confirm("Delete this entry?");
    if (!confirm) return;
    try {
      const res = await fetch("/api/managersCommon/guardian-register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      await mutate();
      await mutateQueue();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to delete entry");
    }
  };

  if (unauthorized) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <h1 className="text-lg font-semibold text-gray-900">Guardian & Visitor Register</h1>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              You do not currently have access to this register. Please contact the admin team to be added under Daily Gate Logs → Guardian & Visitor Register access.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900">Guardian & Visitor Register</h1>
        <p className="text-sm text-gray-600">
          Record guardian or visitor entries digitally. Choose the date, add entries, and maintain a clear ledger for audits.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Token desk</h2>
              <p className="text-sm text-gray-600">
                Issue tokens and call the next guardian from the queue display.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="light" size="sm" onClick={() => mutateQueue()} disabled={queueLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open("/dashboard/managersCommon/guardian-register/display", "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Open TV display
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Now serving</p>
              <div className="mt-2 text-4xl font-bold text-gray-900">
                {formatToken(nowServing?.tokenNumber)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {nowServing?.guardianName ? `${nowServing.guardianName}` : "Waiting for next call"}
              </p>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next up</p>
                <p className="text-xs text-gray-500">
                  {queueData?.waitingCount ? `${queueData.waitingCount} waiting` : "No waiting tokens"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {nextUp.length === 0 ? (
                  <span className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500">
                    Queue is clear
                  </span>
                ) : (
                  nextUp.map((entry) => (
                    <span
                      key={entry.id}
                      className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200"
                    >
                      {formatToken(entry.tokenNumber)}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={handleCallNext} disabled={callingNext || queueLoading}>
                  {callingNext ? "Calling…" : "Call next"}
                </Button>
                {queueMessage && <span className="text-sm text-indigo-600">{queueMessage}</span>}
                {queueError && !queueMessage && (
                  <span className="text-sm text-rose-600">{queueError.message || "Queue unavailable."}</span>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Add register entry</h2>
              <p className="text-sm text-gray-600">
                Fields mirror the paper register. Use 24-hour time format for accuracy.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="register-date">
                Register date
              </label>
              <input
                id="register-date"
                type="date"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={selectedDate}
                max={todayKey()}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit}>
            <div className="min-w-[200px] flex-1">
              <label htmlFor="guardian-name" className="block text-sm font-medium text-gray-700">
                Guardian name
              </label>
              <input
                id="guardian-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                list="guardian-options"
                value={form.guardianName}
                onChange={handleGuardianChange}
                placeholder="Visitor / Guardian"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700">
                Student name
              </label>
              <input
                id="student-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                list="student-options"
                value={form.studentName}
                onChange={handleStudentChange}
                placeholder="Student"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label htmlFor="class-name" className="block text-sm font-medium text-gray-700">
                Class / Section
              </label>
              <input
                id="class-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.className}
                onChange={updateFormField("className")}
                placeholder="e.g. MSP - Grade 3"
              />
            </div>
            <div className="min-w-[240px] flex-[2]">
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
                Purpose of visit
              </label>
              <select
                id="purpose"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                value={form.purpose}
                onChange={handlePurposeChange}
              >
                <option value="">Select reason</option>
                {purposeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                </option>
              ))}
              </select>
            </div>
            {form.purpose === "Other" && (
              <div className="min-w-[240px] flex-[2]">
                <label htmlFor="purpose-note" className="block text-sm font-medium text-gray-700">
                  Other purpose note
                </label>
                <input
                  id="purpose-note"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  value={form.purposeNote}
                  onChange={updateFormField("purposeNote")}
                  placeholder="Add a short note"
                />
              </div>
            )}
            <div className="min-w-[160px]">
              <span className="block text-sm font-medium text-gray-700">Queue token</span>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700" htmlFor="assign-token">
                <input
                  id="assign-token"
                  type="checkbox"
                  className="h-4 w-4 rounded border border-gray-300"
                  checked={form.assignToken}
                  onChange={updateFormField("assignToken")}
                />
                Issue token
              </label>
            </div>
            <div className="min-w-[160px]">
              <span className="block text-sm font-medium text-gray-700">Fees submitted</span>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700" htmlFor="fees-submitted">
                <input
                  id="fees-submitted"
                  type="checkbox"
                  className="h-4 w-4 rounded border border-gray-300"
                  checked={form.feesSubmitted}
                  onChange={updateFormField("feesSubmitted")}
                />
                Yes
              </label>
            </div>
            <div className="min-w-[180px]">
              <label htmlFor="satisfaction-islamic" className="block text-sm font-medium text-gray-700">
                Islamic satisfaction
              </label>
              <select
                id="satisfaction-islamic"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                value={form.satisfactionIslamic}
                onChange={updateFormField("satisfactionIslamic")}
              >
                <option value="">Not captured</option>
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Okay</option>
                <option value="2">2 - Needs work</option>
                <option value="1">1 - Poor</option>
              </select>
            </div>
            <div className="min-w-[180px]">
              <label htmlFor="satisfaction-academic" className="block text-sm font-medium text-gray-700">
                Academic satisfaction
              </label>
              <select
                id="satisfaction-academic"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                value={form.satisfactionAcademic}
                onChange={updateFormField("satisfactionAcademic")}
              >
                <option value="">Not captured</option>
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Okay</option>
                <option value="2">2 - Needs work</option>
                <option value="1">1 - Poor</option>
              </select>
            </div>
            <div className="min-w-[140px]">
              <label htmlFor="in-time" className="block text-sm font-medium text-gray-700">
                In time
              </label>
              <input
                id="in-time"
                type="time"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.inTime}
                onChange={updateFormField("inTime")}
              />
            </div>
            <div className="min-w-[140px]">
              <label htmlFor="out-time" className="block text-sm font-medium text-gray-700">
                Out time
              </label>
              <input
                id="out-time"
                type="time"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.outTime}
                onChange={updateFormField("outTime")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1 w-full">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add entry"}
              </Button>
              {message && <span className="text-sm text-indigo-600">{message}</span>}
              <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                Reset
              </Button>
            </div>
            <datalist id="guardian-options">
              {guardianOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="student-options">
              {students.map((student) => (
                <option
                  key={student.id}
                  value={student.name}
                  label={student.className ? `${student.className}${student.guardianName ? ` - ${student.guardianName}` : ""}` : undefined}
                />
              ))}
            </datalist>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Entries for {selectedDate || "—"}</h2>
              <p className="text-sm text-gray-600">
                Delete an entry if it was logged by mistake. All actions are attributed to your account.
              </p>
            </div>
            <Button variant="light" size="sm" onClick={() => mutate()} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Guardian</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Student</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Class</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Purpose</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Token</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Queue</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Fees submitted</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Islamic</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Academic</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">In</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Out</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-4 text-center text-sm text-gray-500">
                      Loading entries…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-4 text-center text-sm text-gray-500">
                      No entries captured for this date yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{entry.guardianName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.studentName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.className || "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {entry.purpose === "Other" && entry.purposeNote ? (
                          <div>
                            <div className="text-sm text-gray-700">Other</div>
                            <div className="text-xs text-gray-400">{entry.purposeNote}</div>
                          </div>
                        ) : (
                          entry.purpose || "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">{formatToken(entry.tokenNumber)}</td>
                      <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {entry.queueStatus || "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.feesSubmitted ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {entry.satisfactionIslamic ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {entry.satisfactionAcademic ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-emerald-600">{formatTime(entry.inAt)}</td>
                      <td className="px-3 py-2 text-sm text-amber-600">{formatTime(entry.outAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
