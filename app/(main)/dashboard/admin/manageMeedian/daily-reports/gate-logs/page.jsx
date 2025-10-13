"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Copy, RefreshCw } from "lucide-react";
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

export default function GateLogsAdminPage() {
  const [origin, setOrigin] = useState("");
  const [staffDate, setStaffDate] = useState(() => todayKey());
  const [selectedGuardians, setSelectedGuardians] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const staffKey = staffDate ? `/api/admin/manageMeedian?section=campusGateStaff&date=${staffDate}` : null;
  const { data: staffData, isLoading: staffLoading, mutate: mutateStaff } = useSWR(staffKey, fetcher, {
    dedupingInterval: 15000,
  });

  const { data: guardianAssignmentsData, isLoading: guardianAssignmentsLoading, mutate: mutateAssignments } = useSWR(
    "/api/admin/manageMeedian?section=guardianGateAssignments",
    fetcher,
    { dedupingInterval: 30000 }
  );

  const staffRows = useMemo(() => buildStaffRows(staffData?.logs || []), [staffData?.logs]);

  const managers = guardianAssignmentsData?.managers || [];
  const grantedIds = guardianAssignmentsData?.granted || [];

  useEffect(() => {
    setSelectedGuardians(grantedIds);
  }, [grantedIds.join(",")]);

  const campusHubUrl = origin ? `${origin}/dashboard/member/gate` : "/dashboard/member/gate";
  const campusOutUrl = origin ? `${origin}/dashboard/member/gate/out` : "/dashboard/member/gate/out";
  const campusInUrl = origin ? `${origin}/dashboard/member/gate/in` : "/dashboard/member/gate/in";

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setAssignmentMessage("Copied link to clipboard.");
      setTimeout(() => setAssignmentMessage(""), 2000);
    } catch {
      setAssignmentMessage("Clipboard copy failed. Copy manually if needed.");
      setTimeout(() => setAssignmentMessage(""), 2500);
    }
  };

  const refreshStaff = () => mutateStaff();

  const toggleGuardian = (userId) => {
    setSelectedGuardians((prev) => {
      const exists = prev.includes(userId);
      if (exists) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleSaveAssignments = async () => {
    setSavingAssignments(true);
    setAssignmentMessage("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=guardianGateAssignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedGuardians }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      setAssignmentMessage("Assignments updated.");
      await mutateAssignments();
    } catch (error) {
      console.error(error);
      setAssignmentMessage(error.message || "Failed to save assignments.");
    } finally {
      setSavingAssignments(false);
      setTimeout(() => setAssignmentMessage(""), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900">Daily Gate Logs</h1>
        <p className="text-sm text-gray-600">
          Share QR codes for team member scans and manage who can fill the Guardian & Visitor Register from the Managerial Club.
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
                onChange={(event) => setStaffDate(event.target.value)}
              />
            </div>
            {assignmentMessage && <span className="text-xs text-indigo-600">{assignmentMessage}</span>}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Staff</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Purpose</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Out at</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Back in at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">
                      No staff movements recorded for {staffDate || "—"}.
                    </td>
                  </tr>
                ) : (
                  staffRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{row.userName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{row.purpose || "—"}</td>
                      <td className="px-3 py-2 text-sm text-amber-600">{formatTime(row.outAt)}</td>
                      <td className="px-3 py-2 text-sm text-emerald-600">{formatTime(row.inAt)}</td>
                    </tr>
                  ))
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
              <h2 className="text-base font-semibold text-gray-900">Guardian & Visitor Register – Access</h2>
              <p className="text-sm text-gray-600">
                Choose which team managers can fill the Guardian & Visitor Register from the Managerial Club. They will use
                the new Guardian Register tool under managersCommon.
              </p>
            </div>
            <Button onClick={handleSaveAssignments} disabled={savingAssignments || guardianAssignmentsLoading}>
              {savingAssignments ? "Saving…" : "Save Access"}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {guardianAssignmentsLoading ? (
            <p className="text-sm text-gray-600">Loading team managers…</p>
          ) : managers.length === 0 ? (
            <p className="text-sm text-gray-600">No team managers found yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {managers.map((manager) => {
                const isChecked = selectedGuardians.includes(manager.id);
                return (
                  <label
                    key={manager.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                      isChecked ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-200"
                    }`}
                  >
                    <span>
                      <span className="font-medium text-gray-900">{manager.name || `Manager #${manager.id}`}</span>
                      {manager.email ? <span className="block text-xs text-gray-500">{manager.email}</span> : null}
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={isChecked}
                      onChange={() => toggleGuardian(manager.id)}
                    />
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-gray-500">
            Selected managers can now access the register at <code className="rounded bg-gray-100 px-2 py-0.5 text-[0.75rem]">
              /dashboard/managersCommon/guardian-register
            </code> via the Managerial Club.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
