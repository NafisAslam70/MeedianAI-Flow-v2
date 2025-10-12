"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatISTDate, formatISTDateTime } from "@/lib/timezone";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const toTitle = (value, fallback = "") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const DEFAULT_AMRI_PROGRAMS = [
  { key: "MSP", label: "MSP" },
  { key: "MHCP", label: "MHCP" },
  { key: "MNP", label: "MNP" },
  { key: "MAP", label: "MAP" },
  { key: "MGHP", label: "MGHP" },
];

const RESOLVED_REPORT_STATUSES = new Set(["submitted", "verified", "waived"]);

const REPORT_STATUS_STYLES = {
  pending: "bg-slate-100 text-slate-700 border border-slate-200",
  draft: "bg-amber-100 text-amber-700 border border-amber-200",
  submitted: "bg-teal-100 text-teal-700 border border-teal-200",
  verified: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  waived: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  default: "bg-slate-100 text-slate-700 border border-slate-200",
};

const PT_CDD_COLUMNS = [
  { key: "date", label: "Date", formatter: formatISTDate },
  { key: "assemblyUniformDefaulters", label: "Assembly / Uniform Defaulters" },
  { key: "languageDefaulters", label: "Language Defaulters" },
  { key: "homeworkDefaulters", label: "Homework Defaulters" },
  { key: "disciplineDefaulters", label: "Discipline Defaulters" },
  { key: "bestStudentOfDay", label: "Best Student of the Day" },
  { key: "absentStudents", label: "Absent Students" },
  { key: "teacherSigned", label: "CT Sign" },
  { key: "principalStamp", label: "Principal Stamp" },
];

const PT_CCD_COLUMNS = [
  { key: "period", label: "Period" },
  { key: "subject", label: "Subject" },
  { key: "topic", label: "Topic" },
  { key: "classwork", label: "Classwork (What happened)" },
  { key: "homework", label: "Homework (Assigned)" },
  { key: "teacherSignature", label: "Teacher Sign" },
  { key: "monitorInitials", label: "Monitor Initials" },
];

const PT_ATTENDANCE_COLUMNS = [
  { key: "session", label: "Session" },
  { key: "absentStudents", label: "Absent Students" },
  { key: "presentCount", label: "Present Count" },
  { key: "absentCount", label: "Absent Count" },
  { key: "notes", label: "Notes" },
];

const summarizeAttendanceRow = (row) => {
  const list = Array.isArray(row?.absentStudents) ? row.absentStudents : [];
  if (!list.length) return "All present";
  const details = row?.absenceDetails || {};
  return list
    .map((student) => {
      const detail = details[student] || {};
      const status = (detail.applicationSubmitted || "No").toLowerCase();
      if (status === "yes") {
        const reason = detail.reason ? ` - ${detail.reason}` : "";
        return `${student} (Yes${reason})`;
      }
      return `${student} (No - follow up)`;
    })
    .join(", ");
};

const BUILTIN_CATEGORY_FALLBACK = new Map(
  [
    ["nmri_moderator", "nmri"],
    ["msp_ele_moderator", "rmri"],
    ["msp_pre_moderator", "rmri"],
    ["mhcp1_moderator", "amri"],
    ["mhcp2_moderator", "amri"],
    ["events_moderator", "amri"],
    ["assessment_moderator", "amri"],
    ["sports_moderator", "amri"],
    ["util_moderator", "amri"],
    ["pt_moderator", "amri"],
  ].map(([key, value]) => [key.toLowerCase(), value])
);

const Tag = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200">
    {children}
  </span>
);

const formatCellLabel = (key) => {
  if (!key) return "";
  const spaced = String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ");
  return toTitle(spaced, key);
};

const looksLikeDateString = (str) => /-|\//.test(str) || /\d{2}:\d{2}/.test(str) || str.length > 10;

const formatCellValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  if (value instanceof Date) return formatISTDateTime(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "—";

  const raw = String(value).trim();
  if (!raw) return "—";

  if (looksLikeDateString(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const hasTimeComponent = /[T\s]\d/.test(raw);
      return hasTimeComponent ? formatISTDateTime(parsed) : formatISTDate(parsed);
    }
  }

  return raw;
};

const MODAL_ACCENT_STYLES = {
  teal: {
    title: "text-teal-700",
    badge: "bg-teal-100 text-teal-700",
    item: "border-teal-100 bg-teal-50/60",
    close: "hover:bg-teal-50",
  },
  rose: {
    title: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
    item: "border-rose-100 bg-rose-50/60",
    close: "hover:bg-rose-50",
  },
  amber: {
    title: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    item: "border-amber-100 bg-amber-50/60",
    close: "hover:bg-amber-50",
  },
  indigo: {
    title: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
    item: "border-indigo-100 bg-indigo-50/60",
    close: "hover:bg-indigo-50",
  },
};

export default function MRIStep({ handleNextStep, onMriClearedChange, onMriPayloadChange }) {
  const { data, error, isLoading } = useSWR("/api/member/mris/role-tasks", fetcher);
  const roleTaskBundles = Array.isArray(data?.roles) ? data.roles : [];

  const [activeAmriProgramKey, setActiveAmriProgramKey] = useState(null);
  const [modalData, setModalData] = useState(null);
  const router = useRouter();
  const todayIso = useMemo(() => formatISTDate(new Date()), []);
  const {
    data: reportsData,
    error: reportsError,
    isLoading: isReportsLoading,
    mutate: mutateReports,
  } = useSWR(`/api/member/mri-reports?date=${todayIso}`, fetcher);

  const [activeReport, setActiveReport] = useState(null);
  const [ptActiveSection, setPtActiveSection] = useState("cdd");
  const [reportNote, setReportNote] = useState("");
  const [reportError, setReportError] = useState("");
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [showConfirmationNote, setShowConfirmationNote] = useState(false);

  const { amriRoleBundles, rmriRoleBundles, omriRoleBundles, otherRoleBundles } = useMemo(() => {
    const amri = [];
    const rmri = [];
    const omri = [];
    const other = [];
    const normalizeCategory = (value) => {
      if (!value) return "";
      const raw = String(value).trim().toLowerCase();
      if (!raw) return "";
      const positiveMatches = [
        { tokens: ["amri", "academic", "academics", "acad"], result: "amri" },
        { tokens: ["rmri", "role-based", "role based", "rolebased"], result: "rmri" },
        { tokens: ["omri", "operational", "operations", "ops"], result: "omri" },
        { tokens: ["nmri"], result: "nmri" },
      ];
      for (const { tokens, result } of positiveMatches) {
        if (tokens.some((token) => raw.includes(token))) return result;
      }
      const stripped = raw.replace(/[^a-z]/g, "");
      if (["amri", "rmri", "omri", "nmri"].includes(stripped)) return stripped;
      if (stripped.endsWith("s")) {
        const singular = stripped.slice(0, -1);
        if (["amri", "rmri", "omri", "nmri"].includes(singular)) return singular;
      }
      return stripped;
    };

    for (const bundle of roleTaskBundles) {
      const rawCategory = bundle?.category;
      let cat = normalizeCategory(rawCategory);
      if (!cat) {
        if (bundle?.program) {
          cat = "amri";
        } else {
          const fallback = BUILTIN_CATEGORY_FALLBACK.get(String(bundle?.roleKey || "").toLowerCase());
          cat = fallback || "rmri";
        }
      }

      if (cat === "amri") {
        amri.push(bundle);
        continue;
      }
      if (cat === "rmri") {
        rmri.push(bundle);
        continue;
      }
      if (cat === "omri") {
        omri.push(bundle);
        continue;
      }
      if (cat === "nmri") {
        other.push({ ...bundle, category: "nmri" });
        continue;
      }
      other.push(bundle);
    }
    return { amriRoleBundles: amri, rmriRoleBundles: rmri, omriRoleBundles: omri, otherRoleBundles: other };
  }, [roleTaskBundles]);

  const mriReports = useMemo(() => {
    if (!reportsData || !Array.isArray(reportsData.reports)) return [];
    return reportsData.reports;
  }, [reportsData]);

  const pendingReportCount = useMemo(
    () => mriReports.filter((report) => !RESOLVED_REPORT_STATUSES.has(String(report?.status || "").toLowerCase())).length,
    [mriReports]
  );

  const reportSnapshot = useMemo(
    () =>
      mriReports.map((report) => ({
        instanceId: report?.instanceId ?? null,
        templateKey: report?.templateKey || null,
        templateName: report?.templateName || null,
        status: report?.status || "pending",
        class: report?.class || null,
        targetLabel: report?.targetLabel || null,
      })),
    [mriReports]
  );

  const openReportModal = (report) => {
    if (!report || !report.instanceId) return;
    setActiveReport(report);
    setReportNote(report.confirmationNote || "");
    setReportError("");
    setShowConfirmationNote(Boolean(report.confirmationNote));
  };

  const closeReportModal = () => {
    setActiveReport(null);
    setReportNote("");
    setReportError("");
    setShowConfirmationNote(false);
  };

  const handleReportAction = async (action) => {
    if (!activeReport || !activeReport.instanceId) return;
    setIsSavingReport(true);
    setReportError("");
    try {
      const res = await fetch("/api/member/mri-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: activeReport.instanceId,
          action,
          confirmationNote: reportNote || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update report");
      }
      await mutateReports();
      if (action === "submit") {
        closeReportModal();
      }
    } catch (err) {
      setReportError(err.message || "Failed to update report");
    } finally {
      setIsSavingReport(false);
    }
  };

  const activeReportPayload = useMemo(() => {
    if (!activeReport) return null;
    const payload = activeReport.payload;
    if (payload && typeof payload === "object") return payload;
    try {
      return payload ? JSON.parse(payload) : null;
    } catch {
      return null;
    }
  }, [activeReport]);

  const activeReportCddRows = useMemo(() => {
    if (!activeReportPayload) return [];
    const rows = activeReportPayload.cddRows;
    return Array.isArray(rows) ? rows : [];
  }, [activeReportPayload]);

  const activeReportCcdRows = useMemo(() => {
    if (!activeReportPayload) return [];
    const rows = activeReportPayload.ccdRows;
    return Array.isArray(rows) ? rows : [];
  }, [activeReportPayload]);
  const activeReportAttendanceRows = useMemo(() => {
    if (!activeReportPayload) return [];
    const rows = activeReportPayload.attendanceRows;
    return Array.isArray(rows) ? rows : [];
  }, [activeReportPayload]);

  const activeReportExtraEntries = useMemo(() => {
    if (!activeReportPayload) return [];
    const exclude = new Set(["cddRows", "ccdRows", "attendanceRows"]);
    return Object.entries(activeReportPayload).filter(([key]) => !exclude.has(key));
  }, [activeReportPayload]);

  const isPtReport = useMemo(() => activeReport?.templateKey === "pt_daily_report", [activeReport?.templateKey]);

  useEffect(() => {
    if (isPtReport) {
      setPtActiveSection("cdd");
    }
  }, [isPtReport, activeReport?.instanceId]);

  const renderAdditionalDetails = () => {
    if (activeReportExtraEntries.length === 0) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-700">Additional Details</h4>
        <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          {activeReportExtraEntries.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-[0.7rem] text-slate-600">
              <span className="w-44 font-semibold text-slate-700">{formatCellLabel(key)}</span>
              <span className="flex-1">{formatCellValue(value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNoDigitalEntriesNotice = () => {
    if (activeReportPayload) return null;
    return (
      <pre className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
        No digital entries yet. Please review the physical register before confirming.
      </pre>
    );
  };

  const renderPtCddTable = () => {
    if (!activeReportCddRows.length) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          No CDD entries captured yet.
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto">
        <table className="min-w-[1100px] table-fixed text-xs text-slate-700">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">#</th>
              {PT_CDD_COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-2 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeReportCddRows.map((row, rowIndex) => (
              <tr key={`pt-cdd-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 align-top font-semibold text-slate-500">{rowIndex + 1}</td>
                {PT_CDD_COLUMNS.map((column) => {
                  const rawValue = row?.[column.key];
                  const displayValue = column.formatter
                    ? column.formatter(rawValue)
                    : formatCellValue(rawValue);
                  return (
                    <td key={`${column.key}-${rowIndex}`} className="px-4 py-3 align-top">
                      {displayValue || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPtCcdTable = () => {
    if (!activeReportCcdRows.length) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          No CCD entries captured yet.
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto">
        <table className="min-w-[1100px] table-fixed text-xs text-slate-700">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">#</th>
              {PT_CCD_COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-2 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeReportCcdRows.map((row, rowIndex) => (
              <tr key={`pt-ccd-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 align-top font-semibold text-slate-500">{rowIndex + 1}</td>
                {PT_CCD_COLUMNS.map((column) => {
                  const rawValue = row?.[column.key];
                  const displayValue = column.formatter
                    ? column.formatter(rawValue)
                    : formatCellValue(rawValue);
                  return (
                    <td key={`${column.key}-${rowIndex}`} className="px-4 py-3 align-top">
                      {displayValue || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPtAttendanceTable = () => {
    if (!activeReportAttendanceRows.length) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          No attendance entries captured yet.
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto">
        <table className="min-w-[900px] table-fixed text-xs text-slate-700">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">#</th>
              {PT_ATTENDANCE_COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-2 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeReportAttendanceRows.map((row, rowIndex) => (
              <tr key={`pt-attendance-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 align-top font-semibold text-slate-500">{rowIndex + 1}</td>
                {PT_ATTENDANCE_COLUMNS.map((column) => {
                  let displayValue;
                  if (column.key === "absentStudents") {
                    displayValue = summarizeAttendanceRow(row);
                  } else {
                    const rawValue = row?.[column.key];
                    displayValue = formatCellValue(rawValue) || "—";
                  }
                  return (
                    <td key={`${column.key}-${rowIndex}`} className="px-4 py-3 align-top">
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const activeReportStatus = useMemo(() => {
    if (!activeReport) return "pending";
    return String(activeReport.status || "pending").toLowerCase();
  }, [activeReport]);

  const activeReportBadgeClass = useMemo(
    () => REPORT_STATUS_STYLES[activeReportStatus] || REPORT_STATUS_STYLES.default,
    [activeReportStatus]
  );

  const activeReportClassLabel = useMemo(() => {
    if (!activeReport) return "";
    if (activeReport?.class?.name) {
      return `Class ${activeReport.class.name}${activeReport.class.section ? ` ${activeReport.class.section}` : ""}`;
    }
    return activeReport?.targetLabel || activeReport?.templateName || "Assigned Report";
  }, [activeReport]);

  const amriProgramOptions = useMemo(() => {
    const map = new Map();
    for (const bundle of amriRoleBundles) {
      const subKey = String(bundle?.subCategory || "").trim().toUpperCase();
      const programKey = String(bundle?.program?.programKey || "").trim().toUpperCase();
      const key = subKey || programKey || "GENERAL";
      const label =
        bundle?.program?.name ||
        (subKey && subKey !== "GENERAL"
          ? subKey
          : programKey
          ? programKey
          : key === "GENERAL"
          ? "General"
          : key);
      if (!map.has(key)) {
        map.set(key, { key, label, roles: [] });
      }
      map.get(key).roles.push(bundle);
    }

    const ordered = DEFAULT_AMRI_PROGRAMS.map((preset) => {
      const existing = map.get(preset.key);
      return existing ? { ...existing, label: existing.label || preset.label } : { key: preset.key, label: preset.label, roles: [] };
    });

    const extras = Array.from(map.values())
      .filter((program) => !DEFAULT_AMRI_PROGRAMS.some((preset) => preset.key === program.key))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...ordered, ...extras];
  }, [amriRoleBundles]);

  const rmriGroupList = useMemo(() => {
    const map = new Map();
    rmriRoleBundles.forEach((bundle) => {
      const key = (bundle?.subCategory || "General").trim() || "General";
      const norm = key.toUpperCase();
      if (!map.has(norm)) {
        map.set(norm, { key: norm, label: toTitle(key, "General"), roles: [] });
      }
      map.get(norm).roles.push(bundle);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rmriRoleBundles]);

  const omriGroupList = useMemo(() => {
    const map = new Map();
    omriRoleBundles.forEach((bundle) => {
      const subKey = (bundle?.subCategory || "Ops").trim() || "Ops";
      const norm = subKey.toUpperCase();
      if (!map.has(norm)) {
        map.set(norm, { key: norm, label: toTitle(subKey, "Ops"), roles: [] });
      }
      map.get(norm).roles.push(bundle);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [omriRoleBundles]);

  const otherCategorySections = useMemo(() => {
    const categoryMap = new Map();
    otherRoleBundles.forEach((bundle) => {
      const catKey = "other";
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, {
          key: catKey,
          label: "Other Roles",
          groups: new Map(),
        });
      }
      const container = categoryMap.get(catKey);
      const subKeyRaw = (bundle?.subCategory || "General").trim();
      const subKey = subKeyRaw ? subKeyRaw : "General";
      const subNorm = subKey.toUpperCase();
      if (!container.groups.has(subNorm)) {
        container.groups.set(subNorm, {
          key: subNorm,
          label: toTitle(subKey, "General"),
          roles: [],
        });
      }
      container.groups.get(subNorm).roles.push(bundle);
    });

    return Array.from(categoryMap.values())
      .map((section) => ({
        ...section,
        groups: Array.from(section.groups.values()).sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [otherRoleBundles]);

  useEffect(() => {
    if (!amriProgramOptions.length) {
      if (activeAmriProgramKey !== null) setActiveAmriProgramKey(null);
      return;
    }
    const exists = amriProgramOptions.some((program) => program.key === activeAmriProgramKey);
    if (!exists) {
      const firstWithRoles = amriProgramOptions.find((program) => program.roles.length > 0);
      setActiveAmriProgramKey((firstWithRoles || amriProgramOptions[0]).key);
    }
  }, [amriProgramOptions, activeAmriProgramKey]);

  useEffect(() => {
    if (isLoading || isReportsLoading) return;
    const cleared = reportsError ? false : pendingReportCount === 0;
    onMriClearedChange?.(cleared);
    onMriPayloadChange?.({
      groupedRoles: roleTaskBundles.length,
      reports: reportSnapshot,
      reportError: reportsError ? reportsError.message || "Failed to load MRI reports" : null,
    });
  }, [
    isLoading,
    isReportsLoading,
    pendingReportCount,
    reportsError,
    roleTaskBundles.length,
    onMriClearedChange,
    onMriPayloadChange,
    reportSnapshot,
  ]);

  const openRolesModal = (config) => {
    setModalData({
      accent: "teal",
      emptyMessage: "No roles assigned yet.",
      ...config,
    });
  };

  const closeModal = () => setModalData(null);

  const modalAccent = MODAL_ACCENT_STYLES[modalData?.accent] || MODAL_ACCENT_STYLES.teal;
  const { data: todayMRIsData, error: todayMRIsError } = useSWR(
    "/api/member/myMRIs?section=today",
    fetcher
  );
  const { data: weeklyMRIsData, error: weeklyMRIsError } = useSWR(
    "/api/member/myMRIs?section=weekly",
    fetcher
  );
  const todayNMRIs = todayMRIsData?.nMRIs || [];
  const weeklyNMRIs = weeklyMRIsData?.nMRIs || [];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        MRI Clearance
      </h3>

      {error && (
        <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} /> {error.message}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading your MRI roles…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* MRI Reports Card */}
          <motion.div
            className="lg:col-span-3 h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-indigo-100/60"
            whileHover={{ scale: 1.005 }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-indigo-600" />
                  <h4 className="text-base font-bold text-gray-800">PT Daily MRI Reports</h4>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Office assistants capture the Class Discipline &amp; Curriculum Diaries here. Review and confirm before closing the day.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tag>PT Report</Tag>
                {pendingReportCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
                    {pendingReportCount} pending
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4">
              {isReportsLoading ? (
                <p className="text-sm text-gray-600">Checking today&apos;s report assignments…</p>
              ) : reportsError ? (
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle size={16} /> {reportsError.message || "Failed to load PT reports."}
                </p>
              ) : mriReports.length === 0 ? (
                <p className="text-sm text-gray-600">No PT daily reports assigned to you right now.</p>
              ) : (
                <div className="space-y-3">
                  {mriReports.map((report) => {
                    const status = String(report?.status || "pending").toLowerCase();
                    const hasSubmittedStatus = ["submitted", "verified", "waived"].includes(status);
                    const hasPayload = Boolean(report?.payload);
                    const showDataCaptured = hasPayload || hasSubmittedStatus;
                    const badgeClass = REPORT_STATUS_STYLES[status] || REPORT_STATUS_STYLES.default;
                    const classLabel = report?.class?.name
                      ? `Class ${report.class.name}${report.class.section ? ` ${report.class.section}` : ""}`
                      : report?.targetLabel || report?.templateName || "Assigned Report";
                    return (
                      <div
                        key={report?.instanceId || report?.assignmentId}
                        className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-indigo-800">{classLabel}</p>
                            <p className="text-xs text-indigo-700/80">{report?.templateName || "PT Daily Report"}</p>
                            {report?.confirmationNote ? (
                              <p className="mt-2 text-[0.7rem] text-indigo-700/80">
                                Teacher note: {report.confirmationNote}
                              </p>
                            ) : null}
                          </div>
                          <span className={`px-2 py-0.5 text-[0.65rem] font-semibold rounded-full ${badgeClass}`}>
                            {toTitle(status, "Pending")}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => openReportModal(report)}
                            disabled={!report?.instanceId}
                          >
                            Review &amp; Confirm
                          </button>
                          {showDataCaptured ? (
                            <span className="text-[0.65rem] text-indigo-700/70">
                              {hasSubmittedStatus ? toTitle(status, "Submitted") : "Data captured"}
                            </span>
                          ) : (
                            <span className="text-[0.65rem] text-slate-500">Awaiting data entry</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Academic MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-teal-100/50"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                <h4 className="text-base font-bold text-gray-800">A-MRIs (Academic)</h4>
              </div>
              <div className="flex gap-2">
                <Tag>MSP</Tag>
                <Tag>MHCP</Tag>
              </div>
            </div>

            {amriProgramOptions.length === 0 ? (
              <p className="text-sm text-gray-600">No academic MRIs assigned to you right now.</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Tap a program below to review the roles you carry before continuing.
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {amriProgramOptions.map((program, index) => {
                    const isActive = program.key === activeAmriProgramKey;
                    const hasRoles = program.roles.length > 0;
                    return (
                      <motion.button
                        type="button"
                        key={program.key}
                        className={`rounded-lg px-3 py-2 flex flex-col items-center justify-center text-xs font-semibold transition-all duration-300 text-center ${
                          isActive ? "bg-teal-600 text-white shadow" : "bg-teal-50/80 text-teal-800 hover:bg-teal-100"
                        }`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => {
                          setActiveAmriProgramKey(program.key);
                          openRolesModal({
                            title: `${program.label} • Academic MRIs`,
                            subtitle: hasRoles
                              ? `${program.roles.length} role${program.roles.length > 1 ? "s" : ""} assigned`
                              : "No roles assigned",
                            roles: program.roles,
                            emptyMessage: `No AMRI roles assigned for ${program.label}.`,
                            accent: "teal",
                          });
                        }}
                      >
                        <span className="text-sm">{program.label}</span>
                        <span className={`mt-1 text-[0.6rem] font-medium ${isActive ? "text-teal-100" : "text-teal-600/70"}`}>
                          {hasRoles ? `${program.roles.length} role${program.roles.length > 1 ? "s" : ""}` : "No roles"}
                        </span>
                        <span className={`mt-1 text-[0.55rem] ${isActive ? "text-teal-100/80" : "text-teal-600/60"}`}>
                          View details
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* N-MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-green-100/60"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h4 className="text-base font-bold text-gray-800">N-MRIs (Non-Academic)</h4>
              </div>
              <Tag>Non-Academic</Tag>
            </div>
            {/* Show today's N-MRIs */}
            <div className="mb-2">
              <span className="text-xs font-semibold text-green-700">Today's N-MRIs:</span>
              {todayNMRIs.length === 0 ? (
                <p className="text-sm text-gray-600">No N-MRIs for today.</p>
              ) : (
                <ul className="list-disc ml-4 mt-1">
                  {todayNMRIs.map((n, i) => (
                    <li key={i} className="text-xs text-slate-600">{n.name || n.title || n}</li>
                  ))}
                </ul>
              )}
            </div>
            {/* Show weekly N-MRIs */}
            <div className="mb-2">
              <span className="text-xs font-semibold text-green-700">Weekly N-MRIs:</span>
              {weeklyNMRIs.length === 0 ? (
                <p className="text-sm text-gray-600">No N-MRIs for this week.</p>
              ) : (
                <ul className="list-disc ml-4 mt-1">
                  {weeklyNMRIs.map((n, i) => (
                    <li key={i} className="text-xs text-slate-600">{n.name || n.title || n}</li>
                  ))}
                </ul>
              )}
            </div>
            {/* Show N-MRI roles as before */}
            {otherRoleBundles.filter(r => r.category === "nmri").length === 0 ? (
              <p className="text-sm text-gray-600">No N-MRIs assigned to you right now.</p>
            ) : (
              <div className="space-y-3">
                {otherRoleBundles.filter(r => r.category === "nmri").map((role, idx) => (
                  <motion.button
                    type="button"
                    key={role.roleKey || role.id || idx}
                    className="w-full rounded-xl border border-green-100 bg-green-50/80 p-3 text-left shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      openRolesModal({
                        title: `${role.roleName || role.roleKey || "N-MRI Role"} • Non-Academic MRI`,
                        subtitle: role.tasks?.length ? `${role.tasks.length} task${role.tasks.length > 1 ? "s" : ""}` : "No tasks assigned",
                        roles: [role],
                        emptyMessage: `No tasks assigned for this N-MRI role.`,
                        accent: "green",
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-700">{role.roleName || role.roleKey || "N-MRI Role"}</span>
                      <span className="text-[0.65rem] text-green-600/80 font-medium">
                        {role.tasks?.length ? `${role.tasks.length} task${role.tasks.length > 1 ? "s" : ""}` : "No tasks"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-green-600/80">Tap to view tasks.</p>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Role-Based MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-rose-100/60"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-rose-500" />
                <h4 className="text-base font-bold text-gray-800">R-MRIs (Role-Based)</h4>
              </div>
              <Tag>Roles</Tag>
            </div>
            {rmriGroupList.length === 0 ? (
              <p className="text-sm text-gray-600">No role-based MRIs assigned to you right now.</p>
            ) : (
              <div className="space-y-3">
                {rmriGroupList.map((group) => (
                  <motion.button
                    type="button"
                    key={group.key}
                    className="w-full rounded-xl border border-rose-100 bg-rose-50/80 p-3 text-left shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      openRolesModal({
                        title: `${group.label} • Role-Based MRIs`,
                        subtitle: `${group.roles.length} role${group.roles.length > 1 ? "s" : ""} assigned`,
                        roles: group.roles,
                        emptyMessage: `No role-based MRIs assigned for ${group.label}.`,
                        accent: "rose",
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-rose-700">{group.label}</span>
                      <span className="text-[0.65rem] text-rose-600/80 font-medium">
                        {group.roles.length} role{group.roles.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-rose-600/80">Tap to view assigned roles.</p>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Office MRIs Card */}
          <motion.div
            className="h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-amber-100/60"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-amber-500" />
                <h4 className="text-base font-bold text-gray-800">O-MRIs (Office)</h4>
              </div>
              <Tag>Office</Tag>
            </div>
            {omriGroupList.length === 0 ? (
              <p className="text-sm text-gray-600">No office MRIs assigned to you right now.</p>
            ) : (
              <div className="space-y-3">
                {omriGroupList.map((group) => (
                  <motion.button
                    type="button"
                    key={group.key}
                    className="w-full rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-left shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      openRolesModal({
                        title: `${group.label} • Office MRIs`,
                        subtitle: `${group.roles.length} role${group.roles.length > 1 ? "s" : ""} assigned`,
                        roles: group.roles,
                        emptyMessage: `No office MRIs assigned for ${group.label}.`,
                        accent: "amber",
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-amber-700">{group.label}</span>
                      <span className="text-[0.65rem] text-amber-600/80 font-medium">
                        {group.roles.length} role{group.roles.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-amber-600/80">Tap to view assigned roles.</p>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Other MRI Roles Card */}
          {otherCategorySections.length > 0 && (
            <motion.div
              className="lg:col-span-3 h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-indigo-100/60"
              whileHover={{ scale: 1.01 }}
            >
              <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-indigo-500" /> Other MRI Roles
              </h4>
              <div className="space-y-4">
                {otherCategorySections.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                    <p className="text-sm font-semibold text-indigo-700 mb-2">{section.label}</p>
                    <div className="space-y-3">
                      {section.groups.map((group) => (
                        <motion.button
                          type="button"
                          key={`${section.key}-${group.key}`}
                          className="w-full rounded-xl bg-white/90 p-3 text-left shadow-sm border border-indigo-100"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            openRolesModal({
                              title: `${group.label} • ${section.label}`,
                              subtitle: `${group.roles.length} role${group.roles.length > 1 ? "s" : ""} assigned`,
                              roles: group.roles,
                              emptyMessage: `No MRI roles recorded for ${group.label}.`,
                              accent: "indigo",
                            })
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-800">{group.label}</span>
                            <span className="text-[0.65rem] text-indigo-600/80 font-medium">
                              {group.roles.length} role{group.roles.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-indigo-600/80">Tap to view assigned roles.</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      <div className="flex justify-center fixed bottom-6 left-0 w-full z-40">
        <motion.button
          onClick={handleNextStep}
          className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:bg-blue-700 shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>

      <AnimatePresence>
        {activeReport && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeReportModal}
          >
            <motion.div
              className="relative w-full max-w-5xl lg:max-w-6xl rounded-3xl bg-white p-6 shadow-2xl md:p-8 lg:p-10"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeReportModal}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-2 pr-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {activeReport?.templateName || "PT Daily Report"}
                    </h3>
                    <p className="text-sm text-slate-600">{activeReportClassLabel || "Assigned Report"}</p>
                  </div>
                  <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${activeReportBadgeClass}`}>
                    {toTitle(activeReportStatus, "Pending")}
                  </span>
                </div>
                {activeReport?.templateDescription ? (
                  <p className="text-xs text-slate-500">{activeReport.templateDescription}</p>
                ) : null}
              </div>

              <div className="mt-5 flex max-h-[65vh] flex-col gap-4 overflow-hidden pr-2">
                {isPtReport ? (
                  <div className="flex h-full flex-col gap-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setPtActiveSection("cdd")}
                        className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          ptActiveSection === "cdd"
                            ? "border-indigo-400 bg-indigo-600 text-white shadow"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-sm font-semibold">Class Discipline Diary (CDD)</span>
                        <span className="mt-1 block text-xs opacity-80">
                          {activeReportCddRows.length
                            ? `${activeReportCddRows.length} entr${activeReportCddRows.length > 1 ? "ies" : "y"}`
                            : "No entries yet"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPtActiveSection("ccd")}
                        className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          ptActiveSection === "ccd"
                            ? "border-indigo-400 bg-indigo-600 text-white shadow"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-sm font-semibold">Class Curriculum Diary (CCD)</span>
                        <span className="mt-1 block text-xs opacity-80">
                          {activeReportCcdRows.length
                            ? `${activeReportCcdRows.length} entr${activeReportCcdRows.length > 1 ? "ies" : "y"}`
                            : "No entries yet"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPtActiveSection("attendance")}
                        className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          ptActiveSection === "attendance"
                            ? "border-indigo-400 bg-indigo-600 text-white shadow"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-sm font-semibold">Attendance Snapshot</span>
                        <span className="mt-1 block text-xs opacity-80">
                          {activeReportAttendanceRows.length
                            ? `${activeReportAttendanceRows.length} entr${activeReportAttendanceRows.length > 1 ? "ies" : "y"}`
                            : "No entries yet"}
                        </span>
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {ptActiveSection === "cdd"
                        ? renderPtCddTable()
                        : ptActiveSection === "ccd"
                        ? renderPtCcdTable()
                        : renderPtAttendanceTable()}
                    </div>

                    {renderAdditionalDetails()}
                    {renderNoDigitalEntriesNotice()}
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700">Class Discipline Diary (CDD)</h4>
                      {activeReportCddRows.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-500">No CDD entries captured yet.</p>
                      ) : (
                        <div className="mt-2 space-y-3">
                          {activeReportCddRows.map((row, idx) => (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                              <p className="text-xs font-semibold text-slate-700 mb-2">
                                {row?.date ? `Date: ${formatCellValue(row.date)}` : `Entry ${idx + 1}`}
                              </p>
                              <div className="space-y-1">
                                {Object.entries(row || {}).map(([key, value]) => (
                                  <div key={key} className="flex gap-2 text-[0.7rem] text-slate-600">
                                    <span className="w-44 font-semibold text-slate-700">{formatCellLabel(key)}</span>
                                    <span className="flex-1">{formatCellValue(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700">Class Curriculum Diary (CCD)</h4>
                      {activeReportCcdRows.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-500">No CCD entries captured yet.</p>
                      ) : (
                        <div className="mt-2 space-y-3">
                          {activeReportCcdRows.map((row, idx) => (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold text-slate-700 mb-2">
                                {row?.period ? `Period: ${formatCellValue(row.period)}` : `Entry ${idx + 1}`}
                              </p>
                              <div className="space-y-1">
                                {Object.entries(row || {}).map(([key, value]) => (
                                  <div key={key} className="flex gap-2 text-[0.7rem] text-slate-600">
                                    <span className="w-44 font-semibold text-slate-700">{formatCellLabel(key)}</span>
                                    <span className="flex-1">{formatCellValue(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {renderAdditionalDetails()}
                    {renderNoDigitalEntriesNotice()}
                  </>
                )}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
                  onClick={() => setShowConfirmationNote((prev) => !prev)}
                  disabled={isSavingReport}
                >
                  {showConfirmationNote ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showConfirmationNote ? "Hide Confirmation Note" : "Add Confirmation Note"}
                </button>
                {!showConfirmationNote && reportNote && (
                  <p className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[0.7rem] text-indigo-700">
                    Current note: {reportNote}
                  </p>
                )}
                {showConfirmationNote && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Confirmation Note (optional)
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      rows={3}
                      value={reportNote}
                      onChange={(event) => setReportNote(event.target.value)}
                      placeholder="Add clarifications, follow-up items or acknowledgements before confirming."
                      disabled={isSavingReport}
                    />
                    {reportError && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={14} /> {reportError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleReportAction("draft")}
                  disabled={isSavingReport}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleReportAction("submit")}
                  disabled={isSavingReport}
                >
                  Confirm &amp; Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalData && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl md:p-8"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className={`absolute right-4 top-4 rounded-full p-2 text-slate-500 transition ${modalAccent.close}`}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-3 pr-6">
                <h3 className={`text-lg font-semibold leading-tight ${modalAccent.title}`}>
                  {modalData.title}
                </h3>
                {modalData.subtitle && (
                  <span className={`inline-flex w-max items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${modalAccent.badge}`}>
                    {modalData.subtitle}
                  </span>
                )}
                {modalData.description && (
                  <p className="text-sm text-slate-600">{modalData.description}</p>
                )}
              </div>

              {modalData.roles && modalData.roles.length > 0 ? (
                <div className="mt-5 grid grid-cols-1 gap-2">
                  {modalData.roles.map((role, index) => {
                    const roleKey = role?.roleKey || role?.id || `${modalData.title}-role-${index}`;
                    return (
                      <button
                        key={roleKey}
                        className={`w-full text-left rounded-xl border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 ${modalAccent.item}`}
                        onClick={() => setModalData({
                          title: role?.roleName || role?.roleKey || "Role",
                          subtitle: role?.program?.name ? `Program: ${role.program.name}` : undefined,
                          description: role?.subCategory ? `Category: ${toTitle(role.subCategory)}` : undefined,
                          tasks: Array.isArray(role.tasks) ? role.tasks : [],
                          accent: modalData.accent,
                          isTaskModal: true,
                          emptyMessage: "No tasks assigned to this role."
                        })}
                      >
                        <span>{role?.roleName || role?.roleKey || "Role"}</span>
                        {role?.program?.name && (
                          <p className="mt-1 text-[0.7rem] text-slate-500">Program: {role.program.name}</p>
                        )}
                        {role?.subCategory && (
                          <p className="text-[0.7rem] text-slate-500">Category: {toTitle(role.subCategory)}</p>
                        )}
                        <span className="block mt-1 text-xs text-blue-600 underline">View tasks</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">{modalData.emptyMessage}</p>
              )}

              {/* Show tasks modal if opened */}
              {modalData?.isTaskModal && (
                <AnimatePresence>
                  <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeModal}
                  >
                    <motion.div
                      className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl md:p-6"
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 40, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={closeModal}
                        className={`absolute right-3 top-3 rounded-full p-1 text-slate-500 transition ${modalAccent.close}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <h3 className={`text-base font-semibold leading-tight ${modalAccent.title}`}>{modalData.title}</h3>
                      {modalData.subtitle && (
                        <span className={`inline-flex w-max items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold ${modalAccent.badge}`}>{modalData.subtitle}</span>
                      )}
                      {modalData.description && (
                        <p className="text-xs text-slate-600">{modalData.description}</p>
                      )}
                      {modalData.tasks && modalData.tasks.length > 0 ? (
                        <div className="mt-4 grid grid-cols-1 gap-2">
                          {modalData.tasks.map((task, i) => (
                            <div key={i} className="rounded-lg border border-blue-100 bg-blue-50/60 p-2 shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="w-3 h-3 text-blue-600" />
                                <span className="text-sm font-bold text-blue-800">{task.title || task.name || `Task ${i + 1}`}</span>
                              </div>
                              {task.description && (
                                <p className="text-xs text-blue-700 mb-1">{task.description}</p>
                              )}
                              {task.status && (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[0.6rem] font-semibold ${task.status === "completed" ? "bg-green-100 text-green-700" : task.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>
                                  {toTitle(task.status)}
                                </span>
                              )}
                              {task.time && (
                                <div className="mt-1 text-[0.7rem] text-blue-500">Time: {task.time}</div>
                              )}
                              {task.details && (
                                <div className="mt-1 text-[0.7rem] text-blue-500">Details: {task.details}</div>
                              )}
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  className="bg-blue-600 text-white px-3 py-1 rounded-md font-semibold text-[0.7rem] shadow hover:bg-blue-700 transition"
                                  onClick={() => {
                                    if (typeof window !== "undefined") {
                                      localStorage.setItem("mri:executeTask", JSON.stringify(task));
                                    }
                                    router.push("/dashboard/member/myMeedRituals?executeTask=1");
                                  }}
                                >
                                  Execute
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-xs text-slate-500">{modalData.emptyMessage}</p>
                      )}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
