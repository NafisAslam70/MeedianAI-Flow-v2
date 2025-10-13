"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CalendarDays, PhoneCall, RefreshCw } from "lucide-react";

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const error = new Error(payload?.error || res.statusText);
    error.status = res.status;
    throw error;
  }
  return res.json();
};

const todayKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const initialForm = () => ({
  classId: "",
  studentId: "",
  programId: "",
  callDate: todayKey(),
  report: "",
  followUpNeeded: false,
  followUpDate: "",
  guardianName: "",
  guardianPhone: "",
});

const initialFilters = {
  classId: "",
  studentId: "",
  programId: "",
  callDate: "",
  search: "",
};

const formatDisplayDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

export default function GuardianCallsPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState(() => initialForm());
  const [filters, setFilters] = useState(initialFilters);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const {
    data: optionsData,
    error: optionsError,
    isLoading: optionsLoading,
  } = useSWR("/api/managersCommon/guardian-calls?section=options", fetcher, { dedupingInterval: 60000 });

  const classes = useMemo(() => optionsData?.classes || [], [optionsData?.classes]);
  const programs = useMemo(() => optionsData?.programs || [], [optionsData?.programs]);

  const studentsKey = form.classId
    ? `/api/managersCommon/guardian-calls?section=students&classId=${form.classId}`
    : null;
  const {
    data: studentsData,
    isLoading: studentsLoading,
  } = useSWR(studentsKey, fetcher, { dedupingInterval: 15000 });
  const students = useMemo(() => studentsData?.students || [], [studentsData?.students]);

  const filterStudentsKey = filters.classId
    ? `/api/managersCommon/guardian-calls?section=students&classId=${filters.classId}`
    : null;
  const {
    data: filterStudentsData,
    isLoading: filterStudentsLoading,
  } = useSWR(filterStudentsKey, fetcher, { dedupingInterval: 15000 });
  const filterStudents = useMemo(
    () => filterStudentsData?.students || [],
    [filterStudentsData?.students]
  );

  const callsKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("section", "logs");
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.studentId) params.set("studentId", filters.studentId);
    if (filters.programId) params.set("programId", filters.programId);
    if (filters.callDate) params.set("callDate", filters.callDate);
    if (filters.search && filters.search.trim()) params.set("q", filters.search.trim());
    return `/api/managersCommon/guardian-calls?${params.toString()}`;
  }, [filters]);

  const {
    data: callsData,
    error: callsError,
    isLoading: callsLoading,
    mutate: mutateCalls,
  } = useSWR(callsKey, fetcher, { keepPreviousData: true, dedupingInterval: 15000 });

  const calls = useMemo(() => callsData?.calls || [], [callsData?.calls]);

  useEffect(() => {
    if (form.classId && !filters.classId) {
      setFilters((prev) => ({
        ...prev,
        classId: form.classId,
      }));
    }
  }, [form.classId, filters.classId]);

  const updateForm = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClassChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      classId: value,
      studentId: "",
      guardianName: "",
      guardianPhone: "",
    }));
  };

  const handleStudentChange = (event) => {
    const value = event.target.value;
    const selected = students.find((row) => String(row.id) === value);
    setForm((prev) => ({
      ...prev,
      studentId: value,
      guardianName: selected?.guardianName || "",
      guardianPhone: selected?.guardianPhone || "",
    }));
  };

  const handleProgramChange = (event) => {
    setForm((prev) => ({
      ...prev,
      programId: event.target.value,
    }));
  };

  const handleFollowUpToggle = (event) => {
    const checked = event.target.checked;
    setForm((prev) => ({
      ...prev,
      followUpNeeded: checked,
      followUpDate: checked ? prev.followUpDate : "",
    }));
  };

  const handleFiltersChange = (field) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "classId" ? { studentId: "" } : {}),
    }));
  };

  const resetForm = () => {
    setForm((prev) => ({
      ...initialForm(),
      classId: prev.classId,
    }));
  };

  const setMessage = (type, text) => {
    setStatusMessage({ type, text });
    if (text) {
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!form.classId || !form.studentId || !form.callDate || !form.report.trim()) {
      setMessage("error", "Class, student, call date, and report are required.");
      return;
    }
    if (form.followUpNeeded && !form.followUpDate) {
      setMessage("error", "Please choose a follow-up date.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/managersCommon/guardian-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: Number(form.classId),
          studentId: Number(form.studentId),
          programId: form.programId ? Number(form.programId) : null,
          callDate: form.callDate,
          report: form.report.trim(),
          followUpNeeded: form.followUpNeeded,
          followUpDate: form.followUpDate || null,
          guardianName: form.guardianName?.trim() || null,
          guardianPhone: form.guardianPhone?.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      setMessage("success", "Call report saved.");
      resetForm();
      await mutateCalls();
    } catch (error) {
      console.error("Failed to save guardian call", error);
      setMessage("error", error.message || "Failed to save call report.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Guardian Call Reports</h1>
        <p className="text-sm text-slate-600">
          Track outreach to guardians, capture call notes, and plan follow-ups for each student.
        </p>
        {optionsError && (
          <p className="text-sm text-red-600">
            Failed to load class and program options. Refresh the page or contact Admin.
          </p>
        )}
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Log guardian call</h2>
              <p className="text-sm text-gray-600">
                Choose the class and student. Guardian contact details will auto-fill from the student record.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays className="h-4 w-4" />
              <span>Today: {formatDisplayDate(todayKey())}</span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form className="grid gap-4 lg:grid-cols-12" onSubmit={handleSubmit}>
            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-classId">
                Class
              </label>
              <select
                id="gc-classId"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.classId}
                onChange={handleClassChange}
                disabled={optionsLoading}
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                    {cls.section ? ` - ${cls.section}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-studentId">
                Student
              </label>
              <select
                id="gc-studentId"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.studentId}
                onChange={handleStudentChange}
                disabled={!form.classId || studentsLoading}
              >
                <option value="">
                  {form.classId ? (studentsLoading ? "Loading students..." : "Select student") : "Select class first"}
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-programId">
                Call for (MRI program)
              </label>
              <select
                id="gc-programId"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.programId}
                onChange={handleProgramChange}
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.programKey} — {program.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-callDate">
                Call date
              </label>
              <input
                id="gc-callDate"
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                max={todayKey()}
                value={form.callDate}
                onChange={updateForm("callDate")}
              />
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-guardianName">
                Guardian name
              </label>
              <input
                id="gc-guardianName"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.guardianName}
                onChange={updateForm("guardianName")}
                placeholder="Auto-filled from student record"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-guardianPhone">
                Guardian phone
              </label>
              <input
                id="gc-guardianPhone"
                type="tel"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.guardianPhone}
                onChange={updateForm("guardianPhone")}
                placeholder="e.g. 91234 56789"
              />
            </div>

            <div className="lg:col-span-6">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-report">
                Report / summary
              </label>
              <textarea
                id="gc-report"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={4}
                value={form.report}
                onChange={updateForm("report")}
                placeholder="Summarise the conversation, commitments, or concerns."
              />
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700">Follow-up needed?</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="gc-followUp"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  checked={form.followUpNeeded}
                  onChange={handleFollowUpToggle}
                />
                <label htmlFor="gc-followUp" className="text-sm text-gray-700">
                  Yes, schedule follow-up
                </label>
              </div>
              {form.followUpNeeded && (
                <input
                  type="date"
                  className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.followUpDate}
                  onChange={updateForm("followUpDate")}
                  min={form.callDate || todayKey()}
                />
              )}
            </div>

            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700">Called by</label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <PhoneCall className="h-4 w-4 text-teal-600" />
                <span>{session?.user?.name || "You"}</span>
              </div>
            </div>

            <div className="lg:col-span-12 flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-[1.5rem] text-sm">
                {statusMessage && (
                  <span
                    className={statusMessage.type === "success" ? "text-teal-600" : "text-red-600"}
                  >
                    {statusMessage.text}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                  Clear
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save call report"}
                </Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Recent guardian calls</h2>
              <p className="text-sm text-gray-600">
                Use filters to review past conversations and follow-ups for any student.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => mutateCalls()}
                disabled={callsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${callsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-class">
                Class filter
              </label>
              <select
                id="gc-filter-class"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={filters.classId}
                onChange={handleFiltersChange("classId")}
              >
                <option value="">All classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                    {cls.section ? ` - ${cls.section}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-student">
                Student filter
              </label>
              <select
                id="gc-filter-student"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={filters.studentId}
                onChange={handleFiltersChange("studentId")}
                disabled={!filters.classId || filterStudentsLoading}
              >
                <option value="">
                  {filters.classId
                    ? filterStudentsLoading
                      ? "Loading students..."
                      : "All students"
                    : "Select class first"}
                </option>
                {filterStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-date">
                Call date
              </label>
              <input
                id="gc-filter-date"
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={filters.callDate}
                onChange={handleFiltersChange("callDate")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-program">
                Program filter
              </label>
              <select
                id="gc-filter-program"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={filters.programId}
                onChange={handleFiltersChange("programId")}
              >
                <option value="">All programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.programKey} — {program.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-search">
                Search
              </label>
              <input
                id="gc-filter-search"
                type="text"
                placeholder="Type guardian, student, program, or notes"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={filters.search}
                onChange={handleFiltersChange("search")}
              />
            </div>
          </div>

          {callsError && (
            <p className="mt-4 text-sm text-red-600">Failed to load guardian calls. Try refreshing.</p>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Call date</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Guardian</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Report</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Called by</th>
                  <th className="px-4 py-3">Logged at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calls.length === 0 && !callsLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={10}>
                      No guardian calls logged yet. Once you add reports they will appear here.
                    </td>
                  </tr>
                )}
                {callsLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={10}>
                      Loading call reports…
                    </td>
                  </tr>
                )}
                {calls.map((call) => (
                  <tr key={call.id} className="bg-white">
                    <td className="px-4 py-3 text-gray-900">{formatDisplayDate(call.callDate)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {call.class?.name}
                      {call.class?.section ? ` - ${call.class.section}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{call.student?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{call.guardian?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {call.guardian?.phone ? (
                        <a href={`tel:${call.guardian.phone}`} className="text-teal-600 hover:underline">
                          {call.guardian.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {call.program ? `${call.program.key} — ${call.program.name}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-pre-line">
                      {call.report}
                    </td>
                    <td className="px-4 py-3">
                      {call.followUpNeeded ? (
                        <div className="space-y-1">
                          <Badge color="teal">Follow-up</Badge>
                          <div className="text-xs text-gray-600">
                            {call.followUpDate ? formatDisplayDate(call.followUpDate) : "Date pending"}
                          </div>
                        </div>
                      ) : (
                        <Badge color="gray">No follow-up</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{call.calledBy?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {call.createdAt ? new Date(call.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
