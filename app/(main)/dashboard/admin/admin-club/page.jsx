"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarDays, Download, ExternalLink, ShieldCheck, UserCheck, UserX } from "lucide-react";
import Select from "@/components/ui/Select";

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
};

const formatCount = (value) => (Number.isFinite(value) ? value : 0);

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (value) => {
  const date = parseDateValue(value);
  return date
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
};

const computeDurationMinutes = (startValue, endValue) => {
  const start = parseDateValue(startValue);
  if (!start) return 0;
  const end = parseDateValue(endValue) || new Date();
  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.round(diff / 60000));
};

const formatDuration = (minutes) => {
  if (!minutes || !Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
};

const formatDateLabel = (value) => {
  const date = parseDateValue(value);
  return date
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : value || "—";
};

const StatusBadge = ({ label, tone = "default" }) => {
  const toneMap = {
    critical: "border-red-200 bg-red-50 text-red-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    default: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneMap[tone] || toneMap.default}`}>
      {label}
    </span>
  );
};

function usePtSummary(enabled, date) {
  const { data, error, isLoading } = useSWR(
    enabled ? `/api/managersCommon/pt-assist?date=${date}` : null,
    fetcher,
    { dedupingInterval: 60_000 }
  );

  const summary = useMemo(() => {
    const assignments = Array.isArray(data?.assignments) ? data.assignments : [];
    if (!assignments.length) {
      return {
        total: 0,
        statuses: new Map(),
        pendingLike: 0,
        resolved: 0,
        latestUpdate: null,
      };
    }
    const counts = new Map();
    let pending = 0;
    let resolved = 0;
    let latestUpdate = null;
    for (const row of assignments) {
      const status = String(row?.status || "pending").toLowerCase();
      counts.set(status, (counts.get(status) || 0) + 1);
      if (status === "verified" || status === "waived") {
        resolved += 1;
      } else if (status === "submitted") {
        // Submitted but not verified yet
        // count separately to highlight follow-ups
      } else {
        pending += 1;
      }
      const updated = row?.updatedAt ? new Date(row.updatedAt) : null;
      if (updated && !Number.isNaN(updated.getTime())) {
        if (!latestUpdate || updated > latestUpdate) {
          latestUpdate = updated;
        }
      }
    }
    return {
      total: assignments.length,
      statuses: counts,
      pendingLike: pending,
      resolved,
      latestUpdate,
    };
  }, [data]);

  return {
    summary,
    isLoading,
    error,
  };
}

function useGateSummary(enabled, date) {
  const { data, error, isLoading } = useSWR(
    enabled ? `/api/admin/manageMeedian?section=campusGateStaff&date=${date}` : null,
    fetcher,
    { dedupingInterval: 30_000 }
  );

  const summary = useMemo(() => {
    const logs = Array.isArray(data?.logs) ? data.logs : [];
    const totals = logs.reduce(
      (acc, item) => {
        const dir = String(item?.direction || "").toLowerCase();
        if (dir === "out") acc.out += 1;
        else if (dir === "in") acc.in += 1;
        else acc.other += 1;
        return acc;
      },
      { in: 0, out: 0, other: 0 }
    );
    const latest = logs
      .slice()
      .sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0))
      .slice(0, 5);
    return { totals, latest, count: logs.length };
  }, [data]);

  return {
    summary,
    isLoading,
    error,
    warning: data?.warning || null,
  };
}

function AttendanceSummaryCard({ date, program }) {
  const programKey = String(program?.programKey || "").toUpperCase();
  const programName = program?.name || programKey || "Program";
  const { data, error, isLoading } = useSWR(
    programKey ? `/api/attendance?section=report&date=${date}&programKey=${programKey}` : null,
    fetcher,
    { dedupingInterval: 60_000 }
  );

  const totals = data?.totals || {};
  const present = formatCount(totals.present);
  const absent = formatCount(totals.absent);
  const attendanceRate = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;
  const badgeTone =
    attendanceRate === null
      ? "default"
      : attendanceRate >= 95
      ? "success"
      : attendanceRate >= 85
      ? "info"
      : "warn";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{programName}</h3>
        </div>
        <StatusBadge label={attendanceRate !== null ? `${attendanceRate}%` : "—"} tone={badgeTone} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <UserCheck size={16} />
            <span className="font-medium">Present</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-emerald-900">{isLoading ? "…" : present}</p>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3">
          <div className="flex items-center gap-2 text-rose-700">
            <UserX size={16} />
            <span className="font-medium">Absent</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-rose-900">{isLoading ? "…" : absent}</p>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-xs text-rose-600">Failed to load attendance: {error.message}</p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{isLoading ? "Loading…" : `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span>
        <Link href="/dashboard/managersCommon/attendance-report" className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700">
          Open view
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  );
}

export default function AdminClubPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayIso);
  const [journalDate, setJournalDate] = useState(todayIso);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin";

  const { data: managerGrants } = useSWR(
    role === "team_manager" ? "/api/admin/manageMeedian?section=controlsShareSelf" : null,
    fetcher,
    { dedupingInterval: 60_000 }
  );

  const managerAdminClubGrant = useMemo(() => {
    if (role !== "team_manager") return false;
    if (!managerGrants) return null;
    return (managerGrants.grants || []).some((grant) => grant.section === "adminClub" && grant.canWrite !== false);
  }, [role, managerGrants]);

  const canView = isAdmin || managerAdminClubGrant === true;
  const accessLoading = status === "loading" || (role === "team_manager" && managerAdminClubGrant === null);

  const { summary: ptSummary, error: ptError, isLoading: ptLoading } = usePtSummary(canView, date);
  const { summary: gateSummary, error: gateError, isLoading: gateLoading, warning: gateWarning } = useGateSummary(canView, date);
  const { data: programsData, error: programsError, isLoading: programsLoading } = useSWR(
    canView ? "/api/admin/manageMeedian?section=metaPrograms" : null,
    fetcher,
    { dedupingInterval: 5 * 60_000 }
  );
  const { data: teamData, error: teamError, isLoading: teamLoading } = useSWR(
    canView ? "/api/admin/manageMeedian?section=team" : null,
    fetcher,
    { dedupingInterval: 5 * 60_000 }
  );

  const memberOptions = useMemo(() => {
    const rows = Array.isArray(teamData?.users) ? teamData.users : [];
    return rows
      .filter((row) => row && Number.isFinite(Number(row.id)) && row.role !== "admin")
      .map((row) => ({
        id: String(row.id),
        name: row.name || row.email || `Member #${row.id}`,
        role: row.role || "member",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teamData]);

  useEffect(() => {
    if (!canView) {
      if (selectedMemberId) setSelectedMemberId("");
      return;
    }
    if (!memberOptions.length) {
      return;
    }
    const exists = selectedMemberId
      ? memberOptions.some((member) => member.id === selectedMemberId)
      : false;
    if (!selectedMemberId || !exists) {
      setSelectedMemberId(memberOptions[0].id);
    }
  }, [canView, memberOptions, selectedMemberId]);

  const selectedMember = useMemo(
    () => memberOptions.find((member) => member.id === selectedMemberId) || null,
    [memberOptions, selectedMemberId]
  );

  const journalKey =
    canView && selectedMemberId
      ? `/api/member/meRightNow/journal?date=${journalDate}&userId=${selectedMemberId}`
      : null;

  const {
    data: journalData,
    error: journalError,
    isLoading: journalLoading,
    mutate: refreshJournal,
  } = useSWR(journalKey, fetcher, { keepPreviousData: true });

  const journalSessions = useMemo(
    () => (Array.isArray(journalData?.sessions) ? journalData.sessions : []),
    [journalData]
  );

  const totalJournalMinutes = useMemo(
    () =>
      journalSessions.reduce(
        (sum, session) => sum + computeDurationMinutes(session.startedAt, session.endedAt),
        0
      ),
    [journalSessions]
  );

  const programs = useMemo(() => {
    const rows = Array.isArray(programsData?.programs) ? programsData.programs : [];
    return rows
      .filter((row) => row && row.active !== false)
      .sort((a, b) => String(a.programKey || a.name).localeCompare(String(b.programKey || b.name)));
  }, [programsData]);

  const pendingPt = ptSummary.pendingLike;
  const pendingTone = pendingPt > 0 ? (pendingPt > 3 ? "critical" : "warn") : "success";
  const lastPtUpdate = ptSummary.latestUpdate
    ? ptSummary.latestUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const journalBadgeTone = journalSessions.length ? "info" : "default";
  const journalDateLabel = formatDateLabel(journalDate);
  const selectedMemberName = selectedMember?.name || "Member";
  const totalJournalDurationLabel = formatDuration(totalJournalMinutes);

  if (accessLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    );
  }

  if (!canView) {
    const message = role === "team_manager"
      ? "Leadership has not shared the Admin Club with you yet. Please connect with an admin to request access."
      : "Admin access required. Please sign in with an admin account.";
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-6 md:space-y-0">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
            <ShieldCheck size={16} />
            {isAdmin ? "Admin Only" : "Shared Access"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Admin Club</h1>
          <p className="mt-1 text-sm text-slate-600">
            Daily control room for leadership. Review critical reports and jump into detailed tools.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <CalendarDays size={16} className="text-slate-500" />
            <span className="sr-only">Select date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="border-0 bg-transparent text-sm text-slate-700 outline-none"
            />
          </label>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">PT Daily Report</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <StatusBadge label={`${pendingPt} pending`} tone={pendingTone} />
            {lastPtUpdate && <span>Last update {lastPtUpdate}</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {ptLoading ? (
            <p className="text-sm text-slate-500">Loading PT report summary…</p>
          ) : ptError ? (
            <p className="text-sm text-rose-600">Failed to load PT report summary: {ptError.message}</p>
          ) : ptSummary.total === 0 ? (
            <p className="text-sm text-slate-500">No active PT assignments for the selected date.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Assignments</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{ptSummary.total}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-600">Resolved</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-900">{ptSummary.resolved}</p>
