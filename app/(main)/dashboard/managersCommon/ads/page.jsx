"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { AlertTriangle, RefreshCw, ShieldAlert, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

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

const AD_CATEGORIES = [
  { key: "punctuality", label: "Punctuality" },
  { key: "academics", label: "Academics" },
  { key: "obedienceDiscipline", label: "Obedience & Discipline" },
  { key: "languagePersonality", label: "Language & Personality" },
  { key: "willSkill", label: "Will Skill" },
];
const IPR_METRICS = [
  { key: "punctuality", label: "Punctuality" },
  { key: "academics", label: "Academics" },
  { key: "obedienceDiscipline", label: "Obedience & Discipline" },
  { key: "languagePersonality", label: "Language & Personality" },
  { key: "willSkill", label: "Will Skill" },
];
const DATE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_week", label: "Last week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];
const TAB_OPTIONS = [
  { key: "raise", label: "Raise AD" },
  { key: "scores", label: "AD Scores" },
  { key: "ledger", label: "AD Ledger" },
  { key: "ipr", label: "AD Report" },
  { key: "her", label: "IPR Report" },
];
const REPORT_RANGE_OPTIONS = [
  { key: "last_1_week", label: "Last 1 week", days: 7, maxMarks: 250 },
  { key: "last_2_weeks", label: "Last 2 weeks", days: 14, maxMarks: 500 },
  { key: "last_3_weeks", label: "Last 3 weeks", days: 21, maxMarks: 750 },
  { key: "last_1_month", label: "Last 1 month", days: 30, maxMarks: 1000 },
];
const STATUS_BANDS = [
  { minRatio: 1.0, label: "Perfect", cls: "bg-indigo-100 text-indigo-800" }, // 250/250
  { minRatio: 0.96, label: "Excellent", cls: "bg-emerald-100 text-emerald-800" }, // ≥240/250
  { minRatio: 0.94, label: "Very Good", cls: "bg-teal-100 text-teal-800" },       // ≥235/250
  { minRatio: 0.9, label: "Good", cls: "bg-amber-100 text-amber-800" },           // ≥225/250
  { minRatio: 0.85, label: "Satisfactory", cls: "bg-yellow-100 text-yellow-800" },// ≥212.5/250
  { minRatio: 0.8, label: "Needs Improvement", cls: "bg-orange-100 text-orange-800" }, // ≥200/250
  { minRatio: 0, label: "Critical", cls: "bg-rose-100 text-rose-800" },
];

const CATEGORY_LABELS = AD_CATEGORIES.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

const POINTS_PER_AD = 5;

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalInput = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const toMonthInput = (date = new Date()) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const parseMonthValue = (value) => {
  const parts = String(value || "").split("-");
  if (parts.length !== 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, monthIndex: month - 1 };
};

const rangeFromMonth = (year, monthIndex) => ({
  start: new Date(year, monthIndex, 1),
  end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
});

const resolveReportRangeStatic = (key) => {
  const option = REPORT_RANGE_OPTIONS.find((item) => item.key === key) || REPORT_RANGE_OPTIONS[0];
  const today = new Date();
  const end = endOfDay(today);
  const start = startOfDay(new Date(today));
  start.setDate(start.getDate() - (option.days - 1));
  return { start, end, maxMarks: option.maxMarks, label: option.label };
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [form, setForm] = useState({
    memberId: "",
    category: "punctuality",
    occurredAt: toLocalInput(),
    evidence: "",
    notes: "",
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const evidenceInputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(toMonthInput());
  const [dateFilter, setDateFilter] = useState("this_month");
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertForm, setConvertForm] = useState({ title: "", note: "", l1AssigneeId: "" });
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [showIprModal, setShowIprModal] = useState(false);
  const [iprDate, setIprDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportRangeKey, setReportRangeKey] = useState("last_1_week");
  const [minApprovedDayCloses, setMinApprovedDayCloses] = useState(0);
  const [minApprovedDayClosesDraft, setMinApprovedDayClosesDraft] = useState(0);
  const [excludedMemberIds, setExcludedMemberIds] = useState([]);
  const [exceptionMemberIds, setExceptionMemberIds] = useState([]);
  const [showMemberDetail, setShowMemberDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("raise");
  const [notesTarget, setNotesTarget] = useState(null);
  const [evidenceTarget, setEvidenceTarget] = useState(null);

  const { data, error: loadError, isLoading, mutate } = useSWR("/api/managersCommon/ads", fetcher);
  const { data: usersData } = useSWR("/api/member/users", fetcher, { dedupingInterval: 60000 });
  const reportRange = useMemo(() => resolveReportRangeStatic(reportRangeKey), [reportRangeKey]);
  const { data: dayCloseSummary } = useSWR(
    reportRange && activeTab === "ipr"
      ? `/api/managersCommon/dayClose/summary?start=${reportRange.start.toISOString()}&end=${reportRange.end.toISOString()}`
      : null,
    fetcher
  );
  const {
    data: iprData,
    error: iprError,
    isLoading: iprLoading,
    mutate: mutateIpr,
  } = useSWR(showIprModal ? `/api/member/ipr?date=${iprDate}&summary=all` : null, fetcher);

  const entries = useMemo(() => data?.entries || [], [data?.entries]);
  const canWrite = isAdmin || data?.canWrite === true;
  const canWriteResolved = isAdmin || typeof data?.canWrite === "boolean";
  const users = useMemo(() => usersData?.users || [], [usersData?.users]);
  const members = useMemo(
    () =>
      users
        .filter((user) => user.active !== false && user.role !== "admin")
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [users]
  );
  const assigners = useMemo(
    () =>
      users
        .filter((user) => ["admin", "team_manager"].includes(user.role))
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [users]
  );

  const unauthorized = loadError?.status === 401;

  const applyDateFilter = (key) => {
    setDateFilter(key);
    if (key === "this_month") {
      setMonthFilter(toMonthInput());
    }
    if (key === "last_month") {
      const prev = new Date();
      prev.setMonth(prev.getMonth() - 1);
      setMonthFilter(toMonthInput(prev));
    }
  };

  const resolveDateRange = (filterKey) => {
    const today = new Date();
    if (filterKey === "today") {
      return { start: startOfDay(today), end: endOfDay(today) };
    }
    if (filterKey === "yesterday") {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
    if (filterKey === "last_week") {
      const end = endOfDay(today);
      const start = startOfDay(today);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }
    if (filterKey === "this_month") {
      return rangeFromMonth(today.getFullYear(), today.getMonth());
    }
    if (filterKey === "last_month") {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return rangeFromMonth(d.getFullYear(), d.getMonth());
    }
    if (filterKey === "custom") {
      const parsed = parseMonthValue(monthFilter);
      return parsed ? rangeFromMonth(parsed.year, parsed.monthIndex) : null;
    }
    return null;
  };

  const resolveReportRange = (key) => {
    const option = REPORT_RANGE_OPTIONS.find((item) => item.key === key) || REPORT_RANGE_OPTIONS[0];
    const today = new Date();
    const end = endOfDay(today);
    const start = startOfDay(new Date(today));
    start.setDate(start.getDate() - (option.days - 1));
    return { start, end, maxMarks: option.maxMarks, label: option.label };
  };

  const filteredEntries = useMemo(() => {
    const queryText = query.trim().toLowerCase();
    const monthValue = monthFilter ? monthFilter.split("-") : [];
    const filterYear = monthValue.length === 2 ? Number(monthValue[0]) : null;
    const filterMonth = monthValue.length === 2 ? Number(monthValue[1]) : null;
    return entries.filter((entry) => {
      if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
      if (queryText) {
        const haystack = [
          entry.memberName,
          entry.createdByName,
          entry.evidence,
          entry.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(queryText)) return false;
      }
      if (filterYear && filterMonth) {
        const baseDate = entry.occurredAt || entry.createdAt;
        const parsed = baseDate ? new Date(baseDate) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) return false;
        if (parsed.getFullYear() !== filterYear || parsed.getMonth() + 1 !== filterMonth) {
          return false;
        }
      }
      return true;
    });
  }, [entries, categoryFilter, query, monthFilter]);

  const ledgerEntries = useMemo(() => {
    const queryText = query.trim().toLowerCase();
    const range = resolveDateRange(dateFilter);
    return entries.filter((entry) => {
      if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
      if (queryText) {
        const haystack = [
          entry.memberName,
          entry.createdByName,
          entry.evidence,
          entry.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(queryText)) return false;
      }
      if (range) {
        const baseDate = entry.occurredAt || entry.createdAt;
        const parsed = baseDate ? new Date(baseDate) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) return false;
        if (parsed < range.start || parsed > range.end) return false;
      }
      return true;
    });
  }, [entries, categoryFilter, query, dateFilter, monthFilter]);

  const reportSummary = useMemo(() => {
    const range = reportRange;
    const map = new Map();
    const dayCountMap = new Map();
    const approvedMap = new Map(
      (dayCloseSummary?.counts || []).map((row) => [row.userId, row.count || 0])
    );
    // Preload all active non-admin members so they appear even with zero ADs
    members.forEach((member) => {
      map.set(member.id || `m-${member.name}`, {
        memberId: member.id,
        memberName: member.name || `User #${member.id}`,
        ads: 0,
        points: 0,
        daysWithActivity: 0,
      });
      dayCountMap.set(member.id, new Set());
    });
    entries.forEach((entry) => {
      const baseDate = entry.occurredAt || entry.createdAt;
      const parsed = baseDate ? new Date(baseDate) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return;
      if (parsed < range.start || parsed > range.end) return;
      const key = entry.memberId || "unknown";
      const points = Number.isFinite(entry.points) ? entry.points : POINTS_PER_AD;
      if (!map.has(key)) {
        map.set(key, {
          memberId: entry.memberId,
          memberName: entry.memberName || `User #${entry.memberId}`,
          ads: 0,
          points: 0,
          daysWithActivity: 0,
        });
      }
      const current = map.get(key);
      current.ads += 1;
      current.points += points;
      const dayKey = parsed.toISOString().slice(0, 10);
      if (!dayCountMap.has(key)) dayCountMap.set(key, new Set());
      dayCountMap.get(key).add(dayKey);
      current.daysWithActivity = dayCountMap.get(key).size;
    });

    const rows = Array.from(map.values())
      .filter((row) => {
        if (excludedMemberIds.includes(row.memberId)) return false;
        if (!exceptionMemberIds.includes(row.memberId)) {
          const hasSummary = !!dayCloseSummary;
          if (minApprovedDayCloses > 0 && hasSummary) {
            const approvedCount = approvedMap.get(row.memberId) ?? 0; // default 0 once summary is loaded
            if (approvedCount < minApprovedDayCloses) return false;
          }
        }
        return true;
      })
      .map((row) => {
        const pointsDeducted = Math.abs(row.points);
        const iprScore = Math.max(range.maxMarks - pointsDeducted, 0);
        const approvedDayCloses =
          approvedMap.has(row.memberId) || dayCloseSummary
            ? approvedMap.get(row.memberId) ?? 0
            : null;
        return { ...row, pointsDeducted, iprScore, approvedDayCloses };
      })
      .sort((a, b) => (a.memberName || "").localeCompare(b.memberName || ""));

    const totalPoints = rows.reduce((sum, row) => sum + row.pointsDeducted, 0);
    return { rows, range, totalPoints };
  }, [entries, reportRange, members, excludedMemberIds, minApprovedDayCloses, dayCloseSummary, exceptionMemberIds]);

  const topPerformers = useMemo(() => {
    if (!reportSummary.rows.length) return [];
    return reportSummary.rows
      .slice()
      .sort((a, b) => b.iprScore - a.iprScore || (a.memberName || "").localeCompare(b.memberName || ""))
      .slice(0, 3);
  }, [reportSummary]);

  const resolveStatus = (score, max) => {
    if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) {
      return { label: "Unknown", cls: "bg-gray-100 text-gray-700" };
    }
    const ratio = score / max;
    const band = STATUS_BANDS.find((item) => ratio >= item.minRatio) || STATUS_BANDS[STATUS_BANDS.length - 1];
    return band;
  };

  const memberTotals = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const key = entry.memberId || "unknown";
      const points = Number.isFinite(entry.points) ? entry.points : POINTS_PER_AD;
      if (!map.has(key)) {
        map.set(key, {
          memberId: entry.memberId,
          memberName: entry.memberName || `User #${entry.memberId}`,
          ads: 0,
          points: 0,
        });
      }
      const current = map.get(key);
      current.ads += 1;
      current.points += points;
    });
    return Array.from(map.values()).sort((a, b) => (a.memberName || "").localeCompare(b.memberName || ""));
  }, [filteredEntries]);

  const resetForm = () =>
    setForm((prev) => ({
      ...prev,
      memberId: "",
      occurredAt: toLocalInput(),
      evidence: "",
      notes: "",
    }));

  const handlePrintReport = () => {
    if (!reportSummary.rows.length) {
      setError("No ADs in the selected window to print.");
      setTimeout(() => setError(""), 2500);
      return;
    }
    window.print();
  };

  const handleOpenPdfView = () => {
    if (!reportSummary.rows.length) {
      setError("No ADs in the selected window to print.");
      setTimeout(() => setError(""), 2500);
      return;
    }

    const fmtDate = (d) => new Date(d).toLocaleDateString();
    const legendHtml = STATUS_BANDS.map((band, index) => {
      const next = STATUS_BANDS[index - 1];
      const max = reportSummary.range.maxMarks;
      const minScore = Math.round(band.minRatio * max);
      const maxScore = next ? Math.round(next.minRatio * max) - 1 : max;
      return `<div class="legend-item"><span class="pill ${band.cls}">${band.label}</span><div class="range">${minScore} – ${maxScore} marks</div></div>`;
    }).join("");

    const toppersHtml = topPerformers.map((row, idx) => {
      const band = resolveStatus(row.iprScore, reportSummary.range.maxMarks);
      return `<div class="topper-item">
        <div class="rank">#${idx + 1}</div>
        <div class="name">${row.memberName}</div>
        <div class="score">${row.iprScore} / ${reportSummary.range.maxMarks}</div>
        <div class="meta">${row.ads} ADs · -${row.pointsDeducted} pts</div>
        <span class="pill ${band.cls}">${band.label}</span>
      </div>`;
    }).join("");

    const rowsHtml = reportSummary.rows.map((row) => {
      const band = resolveStatus(row.iprScore, reportSummary.range.maxMarks);
      return `<tr>
        <td>${row.memberName}</td>
        <td>${row.ads}</td>
        <td>-${row.pointsDeducted}</td>
        <td>${row.iprScore} / ${reportSummary.range.maxMarks}</td>
        <td><span class="pill ${band.cls}">${band.label}</span></td>
      </tr>`;
    }).join("");

    const html = `
      <div class="card">
        <div class="header">
          <div>
            <div class="title">AD Report</div>
            <div class="subtitle">Member-wise AD deductions and marks</div>
          </div>
          <div class="pills">
            <span class="pill">Range: ${reportSummary.range.label}</span>
            <span class="pill">${fmtDate(reportSummary.range.start)} – ${fmtDate(reportSummary.range.end)}</span>
            <span class="pill">Cap: ${reportSummary.range.maxMarks}</span>
            <span class="pill">Generated: ${new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
      ${topPerformers.length ? `
      <div class="card topper">
        <div class="section-title">Top performers</div>
        <div class="topper-grid">${toppersHtml}</div>
      </div>` : ""}
      <div class="card">
        <div class="section-title">Status legend</div>
        <div class="legend">${legendHtml}</div>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Member</th><th>ADs</th><th>Points deducted</th><th>Marks</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td><strong>Totals</strong></td>
              <td><strong>${reportSummary.rows.reduce((s, r) => s + r.ads, 0)}</strong></td>
              <td><strong>-${reportSummary.totalPoints}</strong></td>
              <td colspan="2">Scaled to cap</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    const popup = window.open("", "ad-report-print", "width=1024,height=768");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>AD Report</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #fff; color: #0f172a; }
            .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
            .header { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
            .title { font-size: 18px; font-weight: 700; color: #0f172a; }
            .subtitle { font-size: 13px; color: #475569; }
            .pills { display: flex; flex-wrap: wrap; gap: 8px; }
            .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th, td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { text-transform: uppercase; letter-spacing: .04em; font-size: 11px; color: #475569; }
            tfoot td { border-top: 1px solid #cbd5e1; font-weight: 700; }
            .legend { display: grid; grid-template-columns: repeat(auto-fill,minmax(140px,1fr)); gap: 10px; }
            .legend-item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; font-size: 12px; background:#f8fafc; }
            .range { color: #475569; margin-top: 4px; }
            .topper { border: 1px solid #d1fae5; background: #ecfdf3; }
            .section-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
            .topper-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 10px; }
            .topper-item { border: 1px solid #bbf7d0; background: #fff; border-radius: 10px; padding: 10px; }
            .rank { font-weight: 700; color: #16a34a; }
            .name { font-weight: 700; color: #0f172a; margin: 4px 0; }
            .score { font-weight: 700; color: #0f172a; }
            .meta { font-size: 12px; color: #047857; margin-bottom: 4px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setMessage("");

    if (!canWrite) {
      setError("You are not allowed to log ADs.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!form.memberId || !form.category || !form.occurredAt || (!form.evidence.trim() && !evidenceFile)) {
      setError("Member, category, time, and evidence text or photo are required.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setSaving(true);
    try {
      const formPayload = new FormData();
      formPayload.append("memberId", String(form.memberId));
      formPayload.append("category", form.category);
      formPayload.append("occurredAt", form.occurredAt);
      formPayload.append("evidence", form.evidence.trim());
      formPayload.append("notes", form.notes.trim());
      formPayload.append("points", String(POINTS_PER_AD));
      if (evidenceFile) formPayload.append("evidenceFile", evidenceFile);

      const res = await fetch("/api/managersCommon/ads", {
        method: "POST",
        body: formPayload,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save AD.");
      setMessage("AD logged successfully.");
      resetForm();
      setEvidenceFile(null);
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
      await mutate();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to log AD.");
    } finally {
      setSaving(false);
      setTimeout(() => {
        setMessage("");
        setError("");
      }, 2500);
    }
  };

  const openConvert = (entry) => {
    if (!entry) return;
    setConvertTarget(entry);
    setConvertForm({
      title: `AD: ${entry.memberName || "Member"} - ${CATEGORY_LABELS[entry.category] || entry.category}`,
      note: entry.evidence ? `Evidence: ${entry.evidence}` : "",
      l1AssigneeId: "",
    });
    setConvertError("");
  };

  const closeConvert = () => {
    if (convertBusy) return;
    setConvertTarget(null);
    setConvertError("");
  };

  const closeIprModal = () => setShowIprModal(false);

  const closeNotes = () => setNotesTarget(null);
  const closeEvidence = () => setEvidenceTarget(null);

  const handleToggleHidden = async (entry) => {
    if (!entry || !isAdmin) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/managersCommon/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: entry.id, hidden: !entry.isHidden }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update visibility.");
      setMessage(entry.isHidden ? "AD is now visible." : "AD is now hidden.");
      await mutate();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update AD visibility.");
    } finally {
      setTimeout(() => {
        setMessage("");
        setError("");
      }, 2500);
    }
  };

  const handleConvert = async () => {
    if (!convertTarget) return;
    if (!convertForm.title.trim()) {
      setConvertError("Escalation title is required.");
      return;
    }
    if (!convertForm.l1AssigneeId) {
      setConvertError("Select an L1 escalation owner.");
      return;
    }

    setConvertBusy(true);
    setConvertError("");
    try {
      const involvedUserIds = Array.from(
        new Set([convertTarget.memberId, convertTarget.createdBy].filter(Boolean))
      );
      const res = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: convertForm.title.trim(),
          description: convertForm.note.trim() || null,
          l1AssigneeId: Number(convertForm.l1AssigneeId),
          involvedUserIds,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create escalation.");

      const linkRes = await fetch("/api/managersCommon/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: convertTarget.id, matterId: payload.id }),
      });
      const linkPayload = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) throw new Error(linkPayload?.error || "Failed to link escalation.");

      setMessage("Escalation created and linked.");
      await mutate();
      closeConvert();
    } catch (err) {
      console.error(err);
      setConvertError(err.message || "Failed to convert AD to escalation.");
    } finally {
      setConvertBusy(false);
      setTimeout(() => {
        setMessage("");
        setConvertError("");
      }, 2500);
    }
  };

  if (unauthorized) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <h1 className="text-lg font-semibold text-gray-900">AD Tracker</h1>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              You do not have access to AD tracking. Please contact the admin team for access.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2 print-hide">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">AD Tracker</h1>
          </div>
          <Button variant="light" size="sm" onClick={() => setShowIprModal(true)}>
            Show IPR
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Log discrepancies or deviations from plan against IPR categories, attach evidence, and convert to escalation when needed.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/70 p-2 shadow-sm print-hide">
        {TAB_OPTIONS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition print:hidden ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "ipr" && (
        <Card id="ad-print-area" className="ad-print-block">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">AD Report (Printable)</h2>
                <p className="text-sm text-gray-600">
                  Choose a window and print member-wise AD deductions with marks (250 per week, up to 1000 per month).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={reportRangeKey}
                onChange={(event) => setReportRangeKey(event.target.value)}
              >
                {REPORT_RANGE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button onClick={handleOpenPdfView} variant="secondary">
                PDF / Print
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Min approved day closes</span>
                <input
                  type="number"
                  min={0}
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1"
                  value={minApprovedDayClosesDraft}
                  onChange={(e) => setMinApprovedDayClosesDraft(Math.max(0, Number(e.target.value)))}
                />
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setMinApprovedDayCloses(minApprovedDayClosesDraft)}
                >
                  Apply
                </Button>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Hide member</span>
                <select
                  className="rounded-lg border border-gray-300 px-2 py-1"
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (!id) return;
                    setExcludedMemberIds((prev) =>
                      prev.includes(id) ? prev : [...prev, id]
                    );
                  }}
                >
                  <option value="">Select</option>
                  {members
                    .filter((m) => !excludedMemberIds.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || `User #${m.id}`}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Allow exception</span>
                <select
                  className="rounded-lg border border-gray-300 px-2 py-1"
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (!id) return;
                    setExceptionMemberIds((prev) =>
                      prev.includes(id) ? prev : [...prev, id]
                    );
                  }}
                >
                  <option value="">Select</option>
                  {members
                    .filter((m) => !exceptionMemberIds.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || `User #${m.id}`}
                      </option>
                    ))}
                </select>
              </label>
              {excludedMemberIds.length > 0 && (
                <button
                  type="button"
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                  onClick={() => setExcludedMemberIds([])}
                >
                  Clear hidden ({excludedMemberIds.length})
                </button>
              )}
              {exceptionMemberIds.length > 0 && (
                <button
                  type="button"
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                  onClick={() => setExceptionMemberIds([])}
                >
                  Clear exceptions ({exceptionMemberIds.length})
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between text-sm text-gray-700 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 print:shadow-none print:border">
            <div className="space-x-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                Range: {reportSummary.range.label}
              </span>
              <span className="text-xs text-slate-500">
                {reportSummary.range.start.toLocaleDateString()} – {reportSummary.range.end.toLocaleDateString()}
              </span>
            </div>
            <div className="space-x-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold shadow-sm">
                IPR cap: {reportSummary.range.maxMarks.toLocaleString()}
              </span>
              <span>Generated: {new Date().toLocaleString()}</span>
            </div>
          </div>
          {reportSummary.rows.length > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 print:shadow-none print:border">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-emerald-800">Top performers</div>
                <div className="text-xs text-emerald-700">Highest IPR in window</div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {topPerformers.map((row, idx) => (
                  <div
                    key={row.memberId || row.memberName}
                    className="rounded-lg border border-emerald-100 bg-white/80 px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-emerald-700">
                      <span className="font-semibold">#{idx + 1}</span>
                      <span className="font-mono">{row.iprScore} / {reportSummary.range.maxMarks}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-emerald-900">{row.memberName}</div>
                    <div className="text-xs text-emerald-700">{row.ads} ADs · -{row.pointsDeducted} pts</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {reportSummary.rows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:shadow-none print:border">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status legend</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-6">
                {STATUS_BANDS.map((band, index) => {
                  const next = STATUS_BANDS[index - 1];
                  const max = reportSummary.range.maxMarks;
                  const minScore = Math.round(band.minRatio * max);
                  const maxScore = next ? Math.round(next.minRatio * max) - 1 : max;
                  return (
                    <div
                      key={band.label}
                      className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className={`inline-flex w-fit rounded-full px-2 py-1 font-semibold ${band.cls}`}>
                        {band.label}
                      </span>
                      <span className="text-slate-600">
                        {minScore} – {maxScore} marks
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {reportSummary.rows.length === 0 ? (
            <p className="text-sm text-gray-600">No ADs found in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">ADs</th>
                    <th className="px-3 py-2">Points deducted</th>
                    <th className="px-3 py-2">IPR marks</th>
                    <th className="px-3 py-2">Day closes (approved)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportSummary.rows.map((row) => (
                    <tr key={row.memberId || row.memberName}>
                      <td className="px-3 py-2 text-gray-900">{row.memberName}</td>
                      <td className="px-3 py-2 text-gray-700">{row.ads}</td>
                      <td className="px-3 py-2 text-gray-700">-{row.pointsDeducted}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">
                        {row.iprScore} / {reportSummary.range.maxMarks}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.approvedDayCloses ?? "–"}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const band = resolveStatus(row.iprScore, reportSummary.range.maxMarks);
                          return (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${band.cls}`}>
                              {band.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t text-xs text-gray-600">
                    <td className="px-3 py-2 font-semibold">Totals</td>
                    <td className="px-3 py-2 font-semibold">
                      {reportSummary.rows.reduce((sum, row) => sum + row.ads, 0)}
                    </td>
                    <td className="px-3 py-2 font-semibold">-{reportSummary.totalPoints}</td>
                    <td className="px-3 py-2 text-gray-500">Scaled to range cap</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
      )}

      {activeTab === "raise" && (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] print-hide">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Raise an AD</h2>
                <p className="text-sm text-gray-600">Each AD deducts {POINTS_PER_AD} marks from the IPR scorecard.</p>
              </div>
              <Button
                variant="light"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
              {!canWrite && canWriteResolved && (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Only selected managers can log ADs. Contact the admin team for access.
                </div>
              )}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-member">
                  Member
                </label>
                <select
                  id="ad-member"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.memberId}
                  onChange={(event) => setForm((prev) => ({ ...prev, memberId: event.target.value }))}
                  disabled={!canWrite}
                >
                  <option value="">Select member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || `User #${member.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-category">
                  Category
                </label>
                <select
                  id="ad-category"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  disabled={!canWrite}
                >
                  {AD_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-occurred">
                  When
                </label>
                <input
                  id="ad-occurred"
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.occurredAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-evidence">
                  Evidence
                </label>
                <input
                  id="ad-evidence"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.evidence}
                  onChange={(event) => setForm((prev) => ({ ...prev, evidence: event.target.value }))}
                  placeholder="CCTV link, attendance log, or witness note"
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-evidence-file">
                  Evidence photo
                </label>
                <input
                  id="ad-evidence-file"
                  ref={evidenceInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setEvidenceFile(file);
                  }}
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="ad-notes">
                  Notes (optional)
                </label>
                <textarea
                  id="ad-notes"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Context, follow-up, or IS remarks"
                  disabled={!canWrite}
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving || !canWrite}>
                  {saving ? "Saving..." : "Log AD"}
                </Button>
                {(message || error) && (
                  <span className={`text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>
                    {error || message}
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-rose-100 p-2 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">AD scoring guidance</h2>
                <p className="text-sm text-gray-600">
                  ADs flag deviations from plan. Each AD deducts 5 marks from the member it is raised against; IPR totals are tracked at 250 per week and 1000 per month.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Active month</span>
              <input
                type="month"
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                value={monthFilter}
                onChange={(event) => {
                  setMonthFilter(event.target.value);
                  setDateFilter("custom");
                }}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span>Member totals</span>
                <span>Ads / Points</span>
              </div>
              {memberTotals.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No ADs logged for this month.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {memberTotals.map((row) => (
                    <div key={row.memberId || row.memberName} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{row.memberName}</span>
                      <span className="font-semibold text-gray-900">
                        {row.ads} / -{Math.abs(row.points)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Use the ledger below to audit repeated deviations and convert serious matters into escalations.
            </p>
          </CardBody>
        </Card>
      </div>
      )}

      {activeTab === "scores" && (
        <Card className="print-hide">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">AD Scores (Month view)</h2>
                <p className="text-sm text-gray-600">Monthly AD counts and point deductions per member.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Active month</span>
                <input
                  type="month"
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  value={monthFilter}
                  onChange={(event) => {
                    setMonthFilter(event.target.value);
                    setDateFilter("custom");
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {memberTotals.length === 0 ? (
              <p className="text-sm text-gray-600">No ADs logged for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Member</th>
                      <th className="px-3 py-2">ADs</th>
                      <th className="px-3 py-2">Points deducted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {memberTotals.map((row) => (
                      <tr key={row.memberId || row.memberName}>
                        <td className="px-3 py-2 text-gray-900">{row.memberName}</td>
                        <td className="px-3 py-2 text-gray-700">{row.ads}</td>
                        <td className="px-3 py-2 text-gray-700">-{Math.abs(row.points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === "ledger" && (
      <Card className="print-hide">
        <CardHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">AD ledger</h2>
                <p className="text-sm text-gray-600">Filter, review evidence, and escalate recurring deviations.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Search name or evidence"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {AD_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {DATE_FILTERS.map((filter) => {
                const active = dateFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => applyDateFilter(filter.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-slate-300 hover:text-slate-800"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <p className="text-sm text-gray-600">Loading ADs...</p>
          ) : ledgerEntries.length === 0 ? (
            <p className="text-sm text-gray-600">No ADs logged for the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Evidence</th>
                    <th className="px-3 py-2">Points deducted</th>
                    <th className="px-3 py-2">Raised by</th>
                    <th className="px-3 py-2">Escalation</th>
                    {isAdmin && <th className="px-3 py-2">Visibility</th>}
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-2 text-gray-900">{entry.memberName || `User #${entry.memberId}`}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {CATEGORY_LABELS[entry.category] || entry.category || "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{formatDateTime(entry.occurredAt)}</td>
                      <td className="px-3 py-2 text-gray-600">
                        <span className="block max-w-[220px] truncate">
                          {entry.evidence || (entry.evidenceUrl ? "Photo evidence" : "-")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">-{Math.abs(entry.points ?? POINTS_PER_AD)}</td>
                      <td className="px-3 py-2 text-gray-600">{entry.createdByName || "-"}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {entry.escalationMatterId ? (
                          <span className="text-emerald-700">
                            Matter #{entry.escalationMatterId}
                            {entry.escalationStatus ? ` - ${entry.escalationStatus}` : ""}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not linked</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-gray-600">
                          {entry.isHidden ? (
                            <span className="text-rose-600">Hidden</span>
                          ) : (
                            <span className="text-emerald-700">Visible</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEvidenceTarget(entry)}
                            disabled={!entry.evidenceUrl}
                          >
                            Evidence
                          </Button>
                          {entry.escalationMatterId ? (
                            <span className="text-xs text-gray-500">-</span>
                          ) : (
                            <Button size="xs" variant="light" onClick={() => openConvert(entry)}>
                              Convert
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setNotesTarget(entry)}
                            disabled={!entry.notes?.trim()}
                          >
                            Notes
                          </Button>
                          {isAdmin && (
                            <Button size="xs" variant="light" onClick={() => handleToggleHidden(entry)}>
                              {entry.isHidden ? "Unhide" : "Hide"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
      )}

      {activeTab === "her" && (
        <Card className="print-hide">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">IPR Report (Holistic)</h2>
                <p className="text-sm text-gray-600">
                  One place to review day open/close times, attendance, PT submissions, subject reports, and AD/IPR context.
                </p>
              </div>
              <div className="text-xs text-gray-500">Alpha — data wiring in progress</div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Day Open / Day Close</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Target: show first check-in (day open) and last check-out (day close) times for the selected window.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc list-inside">
                  <li>Earliest open: —</li>
                  <li>Latest close: —</li>
                  <li>Average span: —</li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Attendance timeline</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Will show per-day attendance status and first/last punch times; ties into campus attendance feed.
                </p>
                <div className="mt-2 text-sm text-slate-500 italic">No attendance feed connected yet.</div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <h3 className="text-sm font-semibold text-emerald-900">PT / Subject submissions</h3>
                <p className="mt-1 text-xs text-emerald-700">
                  Hook here to list latest PT reports, subject reports, and marks per member for the window.
                </p>
                <div className="mt-2 text-sm text-emerald-800">Pending API hookup.</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                <h3 className="text-sm font-semibold text-amber-900">AD/IPR context</h3>
                <p className="mt-1 text-xs text-amber-700">
                  Surface latest ADs, IPR marks, and statuses for quick coaching conversations.
                </p>
                <div className="mt-2 text-sm text-amber-800">
                  Use the IPR tab to print; this card will pull the same data automatically once wired.
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Coming next</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc list-inside">
                <li>Connect attendance/day-open/close API and plot timeline.</li>
                <li>Ingest PT/subject report summaries per member.</li>
                <li>Add export/print for holistic view (HER).</li>
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      {convertTarget && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print-hide">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Convert AD to escalation</h3>
                <p className="text-xs text-gray-500">
                  {convertTarget.memberName || `User #${convertTarget.memberId}`} -{" "}
                  {CATEGORY_LABELS[convertTarget.category] || convertTarget.category}
                </p>
              </div>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={closeConvert}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Escalation title</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={convertForm.title}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">L1 owner</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={convertForm.l1AssigneeId}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, l1AssigneeId: event.target.value }))}
                >
                  <option value="">Select owner</option>
                  {assigners.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || `User #${user.id}`} ({user.role?.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Escalation note</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={convertForm.note}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Summary for escalation owners"
                />
              </div>
              {convertError && <p className="text-sm text-red-600">{convertError}</p>}
              <div className="flex items-center justify-end gap-3">
                <Button variant="light" onClick={closeConvert} disabled={convertBusy}>
                  Cancel
                </Button>
                <Button onClick={handleConvert} disabled={convertBusy}>
                  {convertBusy ? "Converting..." : "Create escalation"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIprModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print-hide">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">IPR Overview</h3>
                <p className="text-xs text-gray-500">Existing IPR scores for the selected date.</p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={closeIprModal}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Date</span>
                  <input
                    type="date"
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    value={iprDate}
                    onChange={(event) => setIprDate(event.target.value)}
                  />
                </div>
                <Button variant="light" size="sm" onClick={() => mutateIpr()} disabled={iprLoading}>
                  <RefreshCw className={`h-4 w-4 ${iprLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {iprError ? (
                <p className="text-sm text-red-600">{iprError.message || "Failed to load IPR."}</p>
              ) : iprLoading ? (
                <p className="text-sm text-gray-600">Loading IPR...</p>
              ) : !iprData?.scores?.length ? (
                <p className="text-sm text-gray-600">No IPR scores found for this date.</p>
              ) : (
                <div className="overflow-auto border border-amber-100 rounded-xl max-h-[60vh]">
                  <table className="min-w-full text-xs">
                    <thead className="bg-amber-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-amber-800">Member</th>
                        {IPR_METRICS.map((metric) => (
                          <th key={metric.key} className="px-3 py-2 text-center font-semibold text-amber-800">
                            {metric.label}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-amber-800">Total</th>
                        <th className="px-3 py-2 text-left font-semibold text-amber-800">Evaluator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iprData.scores.map((entry) => (
                        <tr key={entry.userId} className="odd:bg-white even:bg-amber-50/40">
                          <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                            {entry.userName || `Member #${entry.userId}`}
                          </td>
                          {IPR_METRICS.map((metric) => (
                            <td key={metric.key} className="px-3 py-2 text-center text-gray-700">
                              {entry.metrics?.[metric.key] ?? 0}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold text-amber-700">
                            {entry.total ?? 0} / 50
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {entry.evaluator?.name || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {notesTarget && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print-hide">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AD Notes</h3>
                <p className="text-xs text-gray-500">
                  {notesTarget.memberName || `User #${notesTarget.memberId}`} -{" "}
                  {CATEGORY_LABELS[notesTarget.category] || notesTarget.category}
                </p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={closeNotes}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                {notesTarget.notes?.trim() || "No notes added."}
              </div>
            </div>
          </div>
        </div>
      )}

      {evidenceTarget && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print-hide">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AD Evidence</h3>
                <p className="text-xs text-gray-500">
                  {evidenceTarget.memberName || `User #${evidenceTarget.memberId}`} -{" "}
                  {CATEGORY_LABELS[evidenceTarget.category] || evidenceTarget.category}
                </p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={closeEvidence}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {evidenceTarget.evidenceUrl ? (
                <div className="space-y-3">
                  <img
                    src={evidenceTarget.evidenceUrl}
                    alt="AD evidence"
                    className="w-full max-h-[65vh] object-contain rounded-lg border border-gray-200"
                  />
                  <a
                    href={evidenceTarget.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:text-teal-700 underline"
                  >
                    Open full image
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No evidence image attached.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @media print {
          :root {
            color-scheme: light;
          }
          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* hide common shell chrome */
          header, nav, aside, footer, .print-hide {
            display: none !important;
          }
          /* isolate the report as an overlay */
          #ad-print-area {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: #ffffff;
            color: #0f172a;
            padding: 16px;
            page-break-after: auto;
            display: block !important;
            width: 100%;
            max-width: 100%;
            overflow: visible;
          }
          table {
            page-break-inside: auto;
          }
          #ad-print-area table th,
          #ad-print-area table td {
            font-size: 12px;
            padding: 6px 8px;
          }
          #ad-print-area .ad-print-block {
            box-shadow: none;
            border: 0;
          }
          #ad-print-area .rounded-xl,
          #ad-print-area .rounded-lg {
            border-radius: 6px;
          }
        }
      `}</style>
    </div>
  );
}
