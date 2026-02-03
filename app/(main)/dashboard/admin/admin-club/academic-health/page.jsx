"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { CalendarDays, FileText, RefreshCw, ShieldCheck, Eye } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDays = (dateStr, delta) => {
  const base = new Date(`${dateStr}T00:00:00`);
  base.setDate(base.getDate() + delta);
  return base.toISOString().slice(0, 10);
};

const formatPercent = (value) => (Number.isFinite(value) ? `${value}%` : "—");

const formatDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const StatusPill = ({ label, tone }) => {
  const styles = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[tone] || styles.neutral}`}>
      {label}
    </span>
  );
};

export default function AdminClubAcademicHealthPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const defaultEnd = todayIso();
  const defaultStart = addDays(defaultEnd, -6);

  const [filters, setFilters] = useState({
    startDate: defaultStart,
    endDate: defaultEnd,
    assignedToUserId: "",
    siteId: "",
  });

  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    dedupingInterval: 60_000,
  });

  const teamOptions = useMemo(() => {
    const rows = teamData?.users || [];
    return rows
      .map((user) => ({
        value: String(user.id),
        label: user.name || `User #${user.id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teamData?.users]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.assignedToUserId) params.set("assignedToUserId", filters.assignedToUserId);
    if (filters.siteId) params.set("siteId", filters.siteId);
    return params.toString();
  }, [filters]);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/admin-club/academic-health?${query}`,
    fetcher,
    { dedupingInterval: 30_000 }
  );

  const [selectedReportId, setSelectedReportId] = useState(null);
  const {
    data: reportDetail,
    error: reportError,
    isLoading: reportLoading,
  } = useSWR(
    selectedReportId ? `/api/reports/academic-health/${selectedReportId}` : null,
    fetcher,
    { dedupingInterval: 0 }
  );

  const {
    data: supportingDetail,
    isLoading: supportingLoading,
  } = useSWR(
    selectedReportId && reportDetail?.report?.reportDate
      ? `/api/reports/academic-health?mode=supporting&reportDate=${reportDetail.report.reportDate}&assignedToUserId=${reportDetail.report.assignedToUserId}`
      : null,
    fetcher,
    { dedupingInterval: 0 }
  );

  const totals = data?.totals || {};
  const flags = data?.flags || {};
  const averages = data?.averages || {};

  const selectedAssigneeName = useMemo(() => {
    if (!selectedReportId) return null;
    const fromList = (data?.reports || []).find((r) => r.id === selectedReportId)?.assignedName;
    if (fromList) return fromList;
    const fromTeam = teamOptions.find(
      (opt) => String(opt.value) === String(reportDetail?.report?.assignedToUserId)
    );
    return fromTeam?.label || null;
  }, [data?.reports, selectedReportId, teamOptions, reportDetail?.report?.assignedToUserId]);

  const studentNameMap = useMemo(() => {
    const map = new Map();
    const rows = supportingDetail?.teachers && supportingDetail?.students ? supportingDetail.students : [];
    rows.forEach((row) => {
      if (row?.id) map.set(Number(row.id), row.name || `Student #${row.id}`);
    });
    return map;
  }, [supportingDetail?.students, supportingDetail?.teachers]);

  const classNameMap = useMemo(() => {
    const map = new Map();
    const rows = supportingDetail?.classes || [];
    rows.forEach((row) => {
      if (row?.id) {
        const label = row.label || row.name || `Class #${row.id}`;
        map.set(Number(row.id), label);
      }
    });
    return map;
  }, [supportingDetail?.classes]);

  const applyQuickRange = (days) => {
    const end = todayIso();
    const start = addDays(end, -Math.max(days - 1, 0));
    setFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
  };

  const summaryCards = [
    {
      title: "Expected",
      value: totals.expected ?? 0,
      helper: `${data?.range?.days || 0} days`,
    },
    {
      title: "Submitted",
      value: totals.submitted ?? 0,
      helper: `Completion ${formatPercent(totals.completionRate)}`,
    },
    {
      title: "Missing",
      value: totals.missing ?? 0,
      helper: "Reports not found",
    },
    {
      title: "Avg MHCP-2 Present",
      value: averages.mhcp2PresentAvg ?? "—",
      helper: "Across reports",
    },
  ];

  if (role !== "admin" && role !== "team_manager") {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">You do not have access to Admin Club.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
              <ShieldCheck size={16} />
              Admin Club
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Academic Health Report (AHR) Pulse</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track daily completion, spot missing reports, and review health signals from submitted AHRs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => mutate()}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button onClick={() => window.open("/dashboard/admin/manageMeedian/daily-reports/academic-health", "_blank", "noopener")}
>
              <FileText size={16} className="mr-2" />
              Open AHR Console
            </Button>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Filters</h2>
            <p className="text-xs text-slate-500">Defaults to the last 7 days.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => applyQuickRange(7)}>
              Last 7 days
            </Button>
            <Button variant="ghost" onClick={() => applyQuickRange(14)}>
              Last 14 days
            </Button>
            <Button variant="ghost" onClick={() => applyQuickRange(30)}>
              Last 30 days
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              label="Start date"
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            />
            <Input
              label="End date"
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            />
            <Select
              label="Assigned to"
              value={filters.assignedToUserId}
              onChange={(event) => setFilters((prev) => ({ ...prev, assignedToUserId: event.target.value }))}
            >
              <option value="">All assignees</option>
              {teamOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Site ID"
              type="number"
              placeholder="All"
              value={filters.siteId}
              onChange={(event) => setFilters((prev) => ({ ...prev, siteId: event.target.value }))}
            />
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error.message}</p>}
          {data?.range && (
            <p className="mt-3 text-xs text-slate-500">
              Range: {formatDate(data.range.startDate)} → {formatDate(data.range.endDate)} ({data.range.days} days)
            </p>
          )}
        </CardBody>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{isLoading ? "…" : card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Daily completion</h2>
              <p className="text-xs text-slate-500">Expected vs submitted AHRs per day.</p>
            </div>
            <CalendarDays size={18} className="text-slate-400" />
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Expected</th>
                    <th className="pb-2">Submitted</th>
                    <th className="pb-2">Approved</th>
                    <th className="pb-2">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.perDay || []).map((row) => (
                    <tr key={row.date}>
                      <td className="py-2 font-medium text-slate-700">{formatDate(row.date)}</td>
                      <td className="py-2 text-slate-600">{row.expected}</td>
                      <td className="py-2 text-slate-600">{row.submitted}</td>
                      <td className="py-2 text-slate-600">{row.approved}</td>
                      <td className="py-2">
                        <StatusPill label={row.missing} tone={row.missing ? "danger" : "ok"} />
                      </td>
                    </tr>
                  ))}
                  {!data?.perDay?.length && !isLoading && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                        No data for this range.
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
            <h2 className="text-base font-semibold text-gray-900">Signals needing attention</h2>
            <p className="text-xs text-slate-500">Count of AHRs with flagged issues.</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Attendance not confirmed</span>
              <StatusPill label={flags.attendanceMissing ?? 0} tone={flags.attendanceMissing ? "danger" : "ok"} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Slot-12 transition issues</span>
              <StatusPill label={flags.transitionIssues ?? 0} tone={flags.transitionIssues ? "warn" : "ok"} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>NMRI not moderated</span>
              <StatusPill label={flags.nmriNotModerated ?? 0} tone={flags.nmriNotModerated ? "warn" : "ok"} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Teachers absent (MHCP-2)</span>
              <StatusPill label={flags.mhcpTeachersMissing ?? 0} tone={flags.mhcpTeachersMissing ? "warn" : "ok"} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Missing signature</span>
              <StatusPill label={flags.missingSignature ?? 0} tone={flags.missingSignature ? "danger" : "ok"} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Self day close unchecked</span>
              <StatusPill label={flags.selfDayCloseMissing ?? 0} tone={flags.selfDayCloseMissing ? "warn" : "ok"} />
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">Assignee compliance</h2>
            <p className="text-xs text-slate-500">Check who is keeping AHRs on track.</p>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-2">Assignee</th>
                    <th className="pb-2">Expected</th>
                    <th className="pb-2">Submitted</th>
                    <th className="pb-2">Missing</th>
                    <th className="pb-2">Latest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.perAssignee || []).map((row) => (
                    <tr key={row.userId}>
                      <td className="py-2 font-medium text-slate-700">{row.userName}</td>
                      <td className="py-2 text-slate-600">{row.expected}</td>
                      <td className="py-2 text-slate-600">{row.submitted}</td>
                      <td className="py-2">
                        <StatusPill label={row.missing} tone={row.missing ? "danger" : "ok"} />
                      </td>
                      <td className="py-2 text-slate-600">{formatDate(row.latestReportDate)}</td>
                    </tr>
                  ))}
                  {!data?.perAssignee?.length && !isLoading && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                        No assignees found for this range.
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
            <h2 className="text-base font-semibold text-gray-900">Defaulter types</h2>
            <p className="text-xs text-slate-500">Common defaulter categories from AHR logs.</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              {(data?.defaulterTypes || []).map((row) => (
                <div key={row.type} className="flex items-center justify-between">
                  <span className="text-slate-700">{row.type.replace(/_/g, " ")}</span>
                  <StatusPill label={row.count} tone={row.count > 5 ? "danger" : row.count ? "warn" : "ok"} />
                </div>
              ))}
              {!data?.defaulterTypes?.length && !isLoading && (
                <p className="text-sm text-slate-500">No defaulter entries in this range.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Recent AHR submissions</h2>
          <p className="text-xs text-slate-500">Latest reports in the selected range.</p>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Assignee</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Attendance</th>
                  <th className="pb-2">Transition</th>
                  <th className="pb-2">MHCP Present</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.reports || []).slice(0, 10).map((report) => (
                  <tr key={report.id}>
                    <td className="py-2 text-slate-600">{formatDate(report.reportDate)}</td>
                    <td className="py-2 text-slate-700">{report.assignedName}</td>
                    <td className="py-2">
                      <StatusPill
                        label={report.status}
                        tone={report.status === "APPROVED" ? "ok" : report.status === "SUBMITTED" ? "warn" : "neutral"}
                      />
                    </td>
                    <td className="py-2 text-slate-600">
                      {report.attendanceConfirmed ? "Confirmed" : "Missing"}
                    </td>
                    <td className="py-2 text-slate-600">{report.slot12TransitionQuality || "—"}</td>
                    <td className="py-2 text-slate-600">{toNumber(report.mhcp2PresentCount) ?? "—"}</td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReportId(report.id)}
                      >
                        <Eye size={16} className="mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {!data?.reports?.length && !isLoading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                      No reports available for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Need to edit? Open the
            {" "}
            <Link href="/dashboard/admin/manageMeedian/daily-reports/academic-health" className="text-teal-600 hover:text-teal-700">
              Academic Health console
            </Link>
            .
          </div>
        </CardBody>
      </Card>

      {selectedReportId && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Report details</h2>
              <p className="text-xs text-slate-500">Snapshot of the submitted form.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedReportId(null)}>
              Close
            </Button>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            {(reportLoading || supportingLoading) && <p className="text-slate-500">Loading report…</p>}
            {reportError && <p className="text-rose-600">Failed to load report: {reportError.message}</p>}
            {reportDetail?.report && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">
                    Loaded AHR #{reportDetail.report.id}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="light"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `/dashboard/admin/manageMeedian/daily-reports/academic-health?reportId=${selectedReportId}`,
                          "_blank",
                          "noopener"
                        )
                      }
                    >
                      Open full form
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedReportId(null)}>
                      Close
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Date</p>
                    <p className="font-medium text-slate-800">{formatDate(reportDetail.report.reportDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Assignee</p>
                    <p className="font-medium text-slate-800">
                      {selectedAssigneeName || reportDetail.report.assignedToUserId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Status</p>
                    <StatusPill
                      label={reportDetail.report.status}
                      tone={
                        reportDetail.report.status === "APPROVED"
                          ? "ok"
                          : reportDetail.report.status === "SUBMITTED"
                          ? "warn"
                          : "neutral"
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Attendance</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.attendanceConfirmed ? "Confirmed" : "Missing"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Slot-12 transition</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.slot12TransitionQuality || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">NMRI moderated</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.slot12NmriModerated ? "Yes" : "No"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">MHCP-2 present</p>
                    <p className="font-medium text-slate-800">{reportDetail.report.mhcp2PresentCount ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">All teachers present</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.mhcp2AllTeachersPresent ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Check mode</p>
                    <p className="font-medium text-slate-800">{reportDetail.report.checkMode}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Escalations handled</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.escalationsHandledIds?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Defaulters</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.defaulters?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Slot-12 ADS</p>
                    <p className="font-medium text-slate-800">{reportDetail.report.slot12Ads || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Morning coaching</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.morningCoaching?.state || "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Copy checks</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.copyChecks?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Class diary checks</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.classChecks?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Actions by category</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.actionsByCategory?.length || 0}
                    </p>
                  </div>
                </div>

                {!!reportDetail.report.copyChecks?.length && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 mb-1">Copy checks detail</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                      {reportDetail.report.copyChecks.map((row, idx) => (
                        <div key={idx} className="text-slate-800 text-sm">
                          • {studentNameMap.get(Number(row.studentId)) || `Student #${row.studentId || "?"}`} —{" "}
                          {Array.isArray(row.copyTypes) ? row.copyTypes.join(", ") : "—"}
                          {row.note ? ` (${row.note})` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!reportDetail.report.classChecks?.length && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 mb-1">Class diary checks</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                      {reportDetail.report.classChecks.map((row, idx) => (
                        <div key={idx} className="text-slate-800 text-sm">
                          • {classNameMap.get(Number(row.classId)) || `Class #${row.classId || "?"}`} — {row.diaryType || "CCD/CDD"}{" "}
                          {row.note ? ` (${row.note})` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Self day close</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.selfDayClose ? "Checked" : "Not checked"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Signature</p>
                    <p className="font-medium text-slate-800">
                      {reportDetail.report.signatureName ? reportDetail.report.signatureName : "Missing"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-500">Remarks</p>
                  <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800">
                    {reportDetail.report.finalRemarks || "No remarks"}
                  </p>
                </div>

                <div className="text-xs text-slate-500">
                  Want to edit? Open in{" "}
                  <Link
                    href={`/dashboard/admin/manageMeedian/daily-reports/academic-health?reportId=${selectedReportId}`}
                    className="text-teal-600 hover:text-teal-700"
                  >
                    AHR console
                  </Link>
                  .
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
