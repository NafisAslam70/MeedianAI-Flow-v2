"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import QrCode from "@/components/QrCode";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

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

const buildStaffRows = (logs = []) => {
  const sorted = logs
    .map((log) => {
      const ts = log.recordedAt ? new Date(log.recordedAt) : null;
      if (!ts || Number.isNaN(ts.getTime())) return null;
      const dateKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}`;
      return {
        ...log,
        recordedAtDate: ts,
        dateKey,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.recordedAtDate.getTime() - b.recordedAtDate.getTime());

  const pending = new Map();
  const rows = [];

  for (const log of sorted) {
    const key = `${log.userId}-${log.dateKey}`;
    const name = log.userName || `User #${log.userId}`;
    const current = pending.get(key);

    if (log.direction === "out") {
      if (current && !current.inAt) {
        rows.push({
          id: `${key}-${current.outAt?.getTime() || Date.now()}-pending`,
          ...current,
          inAt: null,
        });
      }
      pending.set(key, {
        userId: log.userId,
        userName: name,
        dateKey: log.dateKey,
        purpose: log.purpose || "",
        outAt: log.recordedAtDate,
      });
      continue;
    }

    if (current && !current.inAt) {
      const completed = {
        id: `${key}-${current.outAt?.getTime() || Date.now()}-${log.recordedAtDate.getTime()}`,
        ...current,
        inAt: log.recordedAtDate,
      };
      rows.push(completed);
      pending.set(key, null);
    } else {
      rows.push({
        id: `${key}-in-${log.recordedAtDate.getTime()}`,
        userId: log.userId,
        userName: name,
        dateKey: log.dateKey,
        purpose: "",
        outAt: null,
        inAt: log.recordedAtDate,
      });
    }
  }

  for (const [key, current] of pending.entries()) {
    if (current && !current.inAt) {
      rows.push({
        id: `${key}-${current.outAt?.getTime() || Date.now()}-pending-final`,
        ...current,
        inAt: null,
      });
    }
  }

  return rows.sort((a, b) => {
    const aTime = a.outAt?.getTime() ?? a.inAt?.getTime() ?? 0;
    const bTime = b.outAt?.getTime() ?? b.inAt?.getTime() ?? 0;
    return bTime - aTime;
  });
};

const initialGuardianForm = {
  guardianName: "",
  studentName: "",
  className: "",
  purpose: "",
  inTime: "",
  outTime: "",
  signature: "",
};

export default function GateLogsAdminPage() {
  const [origin, setOrigin] = useState("");
  const [staffDate, setStaffDate] = useState(() => todayKey());
  const [guardianDate, setGuardianDate] = useState(() => todayKey());
  const [guardianForm, setGuardianForm] = useState(initialGuardianForm);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const staffKey = staffDate ? `/api/admin/manageMeedian?section=campusGateStaff&date=${staffDate}` : null;
  const guardianKey = guardianDate ? `/api/admin/manageMeedian?section=guardianGateLogs&date=${guardianDate}` : null;

  const {
    data: staffData,
    isLoading: staffLoading,
    mutate: mutateStaff,
    error: staffError,
  } = useSWR(staffKey, fetcher, {
    dedupingInterval: 15000,
  });
  const {
    data: guardianData,
    isLoading: guardianLoading,
    mutate: mutateGuardian,
    error: guardianError,
  } = useSWR(
    guardianKey,
    fetcher,
    { dedupingInterval: 15000 }
  );

  const staffRows = useMemo(() => buildStaffRows(staffData?.logs || []), [staffData?.logs]);
  const guardianEntries = guardianData?.entries || [];

  const campusHubUrl = origin ? `${origin}/dashboard/member/gate` : "/dashboard/member/gate";
  const campusOutUrl = origin ? `${origin}/dashboard/member/gate/out` : "/dashboard/member/gate/out";
  const campusInUrl = origin ? `${origin}/dashboard/member/gate/in` : "/dashboard/member/gate/in";

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setFormSuccess("Copied link to clipboard.");
      setTimeout(() => setFormSuccess(""), 2000);
    } catch {
      setFormError("Clipboard copy failed. Copy manually if needed.");
      setTimeout(() => setFormError(""), 2500);
    }
  };

  const updateGuardianField = (field) => (event) => {
    setGuardianForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const resetGuardianForm = () => {
    setGuardianForm(initialGuardianForm);
  };

  const submitGuardian = async (event) => {
    event.preventDefault();
    if (formBusy) return;
    setFormError("");
    setFormSuccess("");

    if (!guardianForm.guardianName.trim() || !guardianForm.studentName.trim() || !guardianForm.className.trim() || !guardianForm.purpose.trim()) {
      setFormError("Fill in guardian, student, class, and purpose.");
      return;
    }

    setFormBusy(true);
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=guardianGateLogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate: guardianDate,
          guardianName: guardianForm.guardianName,
          studentName: guardianForm.studentName,
          className: guardianForm.className,
          purpose: guardianForm.purpose,
          inTime: guardianForm.inTime,
          outTime: guardianForm.outTime,
          signature: guardianForm.signature,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      setFormSuccess("Entry saved.");
      resetGuardianForm();
      await mutateGuardian();
    } catch (error) {
      console.error(error);
      setFormError(error.message || "Failed to save entry.");
    } finally {
      setFormBusy(false);
    }
  };

  const deleteGuardian = async (id) => {
    if (!id) return;
    const yes = window.confirm("Delete this entry?");
    if (!yes) return;
    try {
      const res = await fetch(`/api/admin/manageMeedian?section=guardianGateLogs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      await mutateGuardian();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete entry");
    }
  };

  const refreshStaff = () => mutateStaff();
  const refreshGuardian = () => mutateGuardian();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900">Daily Gate Logs</h1>
        <p className="text-sm text-gray-600">
          Track campus in/out records for team members via QR scans and maintain the guardian/visitor register digitally.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Team Members — QR Scan Activity</h2>
              <p className="text-sm text-gray-600">
                Share these URLs to generate the fixed QR codes for gate entry/exit. Staff scan OUT to log purpose, and scan IN when they return.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="light" size="sm" onClick={refreshStaff} disabled={staffLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/60 p-4">
              <div className="text-xs uppercase text-teal-700">Campus In/Out page</div>
              <p className="mt-1 text-sm text-teal-900/80">
                Print this link on staff posters or share via chat. Members open it in the app to access the scanner.
              </p>
              <div className="mt-2 break-all rounded-lg bg-white px-3 py-2 text-xs font-semibold text-teal-900 shadow-inner">
                {campusHubUrl}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(campusHubUrl)}>
                  <Copy className="mr-1 h-4 w-4" /> Copy link
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase font-semibold text-amber-700">Campus Out QR</div>
              <QrCode value={campusOutUrl} size={180} className="rounded-xl border border-amber-200 bg-white p-2 shadow" />
              <p className="text-center text-xs text-amber-700/80">
                Stick this at the exit gate. Members scan it from the Campus In/Out page before leaving campus.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase font-semibold text-emerald-700">Campus In QR</div>
              <QrCode value={campusInUrl} size={180} className="rounded-xl border border-emerald-200 bg-white p-2 shadow" />
              <p className="text-center text-xs text-emerald-700/80">
                Place near the entry checkpoint so returning members can scan it and mark that they are back in campus.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="staff-date">
                View date
              </label>
              <input
                id="staff-date"
                type="date"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={staffDate}
                max={todayKey()}
                onChange={(event) => {
                  setStaffDate(event.target.value);
                }}
              />
            </div>
            <div className="text-sm text-gray-500">
              {staffRows.length} record{staffRows.length === 1 ? "" : "s"} for {staffDate || "—"}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Team Member</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Purpose</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Out</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">In</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {staffError ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-red-500">
                      {staffError.message || "Failed to load gate activity."}
                    </td>
                  </tr>
                ) : staffLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Loading gate activity…
                    </td>
                  </tr>
                ) : staffRows.length ? (
                  staffRows.map((row) => {
                    const awaitingReturn = !!row.outAt && !row.inAt;
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.userName}</td>
                        <td className="px-3 py-2 text-gray-700">{row.purpose || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{formatTime(row.outAt)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatTime(row.inAt)}</td>
                        <td className="px-3 py-2">
                          {awaitingReturn ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              Awaiting return
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      No gate scans logged for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Guardian & Visitor Register</h2>
              <p className="text-sm text-gray-600">
                Digitise the physical register. Copy entries from the hard log into the system to maintain a searchable archive.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="light" size="sm" onClick={refreshGuardian} disabled={guardianLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={submitGuardian}>
            <div className="md:col-span-1">
              <label htmlFor="guardian-date" className="block text-sm font-medium text-gray-700">
                Register date
              </label>
              <input
                id="guardian-date"
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={guardianDate}
                onChange={(event) => setGuardianDate(event.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label htmlFor="guardian-name" className="block text-sm font-medium text-gray-700">
                Guardian name
              </label>
              <input
                id="guardian-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                value={guardianForm.guardianName}
                onChange={updateGuardianField("guardianName")}
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
                value={guardianForm.studentName}
                onChange={updateGuardianField("studentName")}
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
                value={guardianForm.className}
                onChange={updateGuardianField("className")}
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
                value={guardianForm.purpose}
                onChange={updateGuardianField("purpose")}
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
                value={guardianForm.inTime}
                onChange={updateGuardianField("inTime")}
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
                value={guardianForm.outTime}
                onChange={updateGuardianField("outTime")}
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
                value={guardianForm.signature}
                onChange={updateGuardianField("signature")}
                placeholder="Initials or remarks"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
              <Button type="submit" disabled={formBusy}>
                {formBusy ? "Saving…" : "Add entry"}
              </Button>
              {formError && <span className="text-sm text-red-600">{formError}</span>}
              {formSuccess && !formError && <span className="text-sm text-emerald-600">{formSuccess}</span>}
            </div>
          </form>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {guardianEntries.length} entr{guardianEntries.length === 1 ? "y" : "ies"} for {guardianDate || "—"}
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Guardian</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Student</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Class</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Purpose</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">In</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Out</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Signature</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Recorded by</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {guardianError ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-red-500">
                      {guardianError.message || "Failed to load guardian register."}
                    </td>
                  </tr>
                ) : guardianLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                      Loading register entries…
                    </td>
                  </tr>
                ) : guardianEntries.length ? (
                  guardianEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 font-medium text-gray-900">{entry.guardianName}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.studentName}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.className || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.purpose || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">{formatTime(entry.inAt)}</td>
                      <td className="px-3 py-2 text-gray-700">{formatTime(entry.outAt)}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.signature || "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{entry.createdByName || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGuardian(entry.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                      No guardian/visitor entries for this date yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
