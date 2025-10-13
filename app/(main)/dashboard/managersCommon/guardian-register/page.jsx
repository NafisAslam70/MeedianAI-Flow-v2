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

const initialForm = {
  guardianName: "",
  studentName: "",
  className: "",
  purpose: "",
  inTime: "",
  outTime: "",
  signature: "",
};

export default function GuardianRegisterPage() {
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const key = selectedDate ? `/api/managersCommon/guardian-register?date=${selectedDate}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { dedupingInterval: 15000 });

  const entries = useMemo(() => data?.entries || [], [data?.entries]);

  const unauthorized = error?.status === 401;

  const updateFormField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
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
      setMessage("Entry saved.");
      resetForm();
      await mutate();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2500);
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
          <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSubmit}>
            <div className="md:col-span-1">
              <label htmlFor="guardian-name" className="block text-sm font-medium text-gray-700">
                Guardian name
              </label>
              <input
                id="guardian-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.guardianName}
                onChange={updateFormField("guardianName")}
                placeholder="Visitor / Guardian"
              />
            </div>
            <div className="md:col-span-1">
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700">
                Student name
              </label>
              <input
                id="student-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.studentName}
                onChange={updateFormField("studentName")}
                placeholder="Student"
              />
            </div>
            <div className="md:col-span-1">
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
            <div className="md:col-span-2">
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
                Purpose of visit
              </label>
              <input
                id="purpose"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.purpose}
                onChange={updateFormField("purpose")}
                placeholder="Reason noted in register"
              />
            </div>
            <div>
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
            <div>
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
            <div>
              <label htmlFor="signature" className="block text-sm font-medium text-gray-700">
                Signature / Notes
              </label>
              <input
                id="signature"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={form.signature}
                onChange={updateFormField("signature")}
                placeholder="Initials or remarks"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add entry"}
              </Button>
              {message && <span className="text-sm text-indigo-600">{message}</span>}
              <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                Reset
              </Button>
            </div>
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
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">In</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Out</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Signature / Notes</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">
                      Loading entries…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">
                      No entries captured for this date yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{entry.guardianName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.studentName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.className || "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.purpose || "—"}</td>
                      <td className="px-3 py-2 text-sm text-emerald-600">{formatTime(entry.inAt)}</td>
                      <td className="px-3 py-2 text-sm text-amber-600">{formatTime(entry.outAt)}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{entry.signature || "—"}</td>
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
