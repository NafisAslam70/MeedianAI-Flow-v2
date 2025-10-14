"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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

const PT_DAILY_REPORT_KEY = "pt_daily_report";
const SUBJECT_REPORT_KEY = "subject_daily_report";

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
  { key: "teacherName", label: "Teacher" },
  { key: "classwork", label: "C.W. (what happened)" },
  { key: "homework", label: "H.W. (assigned)" },
  { key: "teacherSignature", label: "T.S." },
  { key: "monitorInitials", label: "Monitor Initials" },
];

const PT_ATTENDANCE_COLUMNS = [
  { key: "session", label: "Session" },
  { key: "absentStudents", label: "Absent Students" },
  { key: "presentCount", label: "Present Count" },
  { key: "absentCount", label: "Absent Count" },
  { key: "notes", label: "Notes" },
];

const SUBJECT_REPORT_COLUMNS = [
  { key: "classLabel", label: "Class" },
  { key: "period", label: "Period" },
  { key: "subject", label: "Subject" },
  { key: "topic", label: "Topic" },
  { key: "classwork", label: "Classwork (What happened)" },
  { key: "homework", label: "Homework (Assigned)" },
  { key: "teacherSignature", label: "Teacher Sign" },
  { key: "monitorInitials", label: "Monitor Initials" },
];

const SUBJECT_EDIT_HEADERS = [
  { id: "classLabel", label: "Class", type: "text", placeholder: "Class 5A" },
  { id: "period", label: "Period", type: "text", placeholder: "1" },
  { id: "subject", label: "Subject", type: "text", placeholder: "Math" },
  { id: "topic", label: "Topic", type: "text", placeholder: "Fractions" },
  { id: "classwork", label: "Classwork", type: "textarea", placeholder: "Covered exercise 3" },
  { id: "homework", label: "Homework", type: "textarea", placeholder: "Worksheet 4" },
  { id: "teacherSignature", label: "Teacher Sign", type: "select", options: ["Yes", "No"] },
  { id: "monitorInitials", label: "Monitor Initials", type: "select", options: ["Yes", "No"] },
];

const YES_NO_OPTIONS = ["", "Yes", "No"];
const ATTENDANCE_APPLICATION_REASONS = ["Sickness", "Family Event", "Out of Station", "Other"];
const DEFAULT_APPLICATION_FOLLOWUP = "Please collect application tomorrow.";
const PT_CDD_EDIT_HEADERS = [
  { id: "date", label: "Date", type: "date" },
  {
    id: "assemblyUniformDefaulters",
    label: "Assembly/Uniform Defaulters",
    type: "chips",
    placeholder: "Sajid, Zaki",
  },
  { id: "languageDefaulters", label: "Language Defaulters", type: "chips", placeholder: "None" },
  { id: "homeworkDefaulters", label: "Homework Defaulters", type: "chips", placeholder: "None" },
  { id: "disciplineDefaulters", label: "Discipline Defaulters", type: "chips", placeholder: "None" },
  { id: "bestStudentOfDay", label: "Best Student of the Day", type: "chips", placeholder: "Zaki; Ahmad" },
  { id: "absentStudents", label: "Absent Students", type: "chips", placeholder: "None" },
  { id: "teacherSigned", label: "CT Sign", type: "select", options: ["Yes", "No"] },
  { id: "principalStamp", label: "Principal Stamp", type: "select", options: ["Yes", "No"] },
];
const PT_CCD_EDIT_HEADERS = [
  { id: "period", label: "Period", type: "text", placeholder: "1" },
  { id: "subject", label: "Subject", type: "text", placeholder: "Math" },
  { id: "topic", label: "Topic", type: "text", placeholder: "Ch-3 Fractions" },
  { id: "teacherName", label: "Teacher", type: "teacherSelect" },
  { id: "classwork", label: "C.W. (what happened)", type: "textarea", placeholder: "Test taken" },
  { id: "homework", label: "H.W. (assigned)", type: "textarea", placeholder: "Memorise Ques/Ans" },
  { id: "teacherSignature", label: "T.S.", type: "select", options: ["Yes", "No"] },
  { id: "monitorInitials", label: "Monitor Initials", type: "select", options: ["Yes", "No"] },
];
const PT_ATTENDANCE_EDIT_HEADERS = [
  { id: "session", label: "Session", type: "text", placeholder: "Morning" },
  { id: "absentStudents", label: "Absent Students", type: "chips", placeholder: "None" },
  { id: "presentCount", label: "Present Count", type: "readonly" },
  { id: "absentCount", label: "Absent Count", type: "readonly" },
  { id: "notes", label: "Notes", type: "textarea", placeholder: "Applications submitted by..." },
];

const PT_SECTION_KEY_MAP = {
  cdd: "cddRows",
  ccd: "ccdRows",
  attendance: "attendanceRows",
};
const PT_SECTION_LABELS = {
  cdd: "Class Discipline Diary (CDD)",
  ccd: "Class Curriculum Diary (CCD)",
  attendance: "Attendance Snapshot",
};
const CDD_MULTI_FIELDS = new Set([
  "assemblyUniformDefaulters",
  "languageDefaulters",
  "homeworkDefaulters",
  "disciplineDefaulters",
  "bestStudentOfDay",
  "absentStudents",
]);
const CCD_TEXTAREA_FIELDS = new Set(["classwork", "homework"]);
const CCD_SELECT_FIELDS = new Set(["teacherSignature", "monitorInitials"]);
const CDD_SELECT_FIELDS = new Set(["teacherSigned", "principalStamp"]);
const ATTENDANCE_MULTI_FIELDS = new Set(["absentStudents"]);

const normalizeYesNo = (value) => {
  if (value === "Yes" || value === "No") return value;
  if (value === true) return "Yes";
  if (value === false) return "No";
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (["yes", "y", "1", "true"].includes(raw)) return "Yes";
  if (["no", "n", "0", "false"].includes(raw)) return "No";
  return "";
};

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 0);
  }
  if (!value) return [];
  return String(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const multiValueToString = (value) => {
  const list = ensureArray(value);
  return list.join(", ");
};

const parseMultiValueInput = (value) => {
  if (Array.isArray(value)) return ensureArray(value);
  return ensureArray(value);
};

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const sanitizePtPayload = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const result = { ...source };

  const cddRowsSource = Array.isArray(source.cddRows) ? source.cddRows : [];
  result.cddRows = cddRowsSource.map((row) => {
    const nextRow = { ...(row || {}) };
    nextRow.date = row?.date ? toDateInputValue(row.date) || String(row.date) : "";
    nextRow.assemblyUniformDefaulters = ensureArray(row?.assemblyUniformDefaulters);
    nextRow.languageDefaulters = ensureArray(row?.languageDefaulters);
    nextRow.homeworkDefaulters = ensureArray(row?.homeworkDefaulters);
    nextRow.disciplineDefaulters = ensureArray(row?.disciplineDefaulters);
    nextRow.bestStudentOfDay = ensureArray(row?.bestStudentOfDay);
    nextRow.absentStudents = ensureArray(row?.absentStudents);
    nextRow.teacherSigned = normalizeYesNo(row?.teacherSigned);
    nextRow.principalStamp = normalizeYesNo(row?.principalStamp);
    return nextRow;
  });

  const ccdRowsSource = Array.isArray(source.ccdRows) ? source.ccdRows : [];
  result.ccdRows = ccdRowsSource.map((row) => {
    const nextRow = { ...(row || {}) };
    nextRow.period = row?.period != null ? String(row.period) : "";
    nextRow.subject = row?.subject != null ? String(row.subject) : "";
    nextRow.topic = row?.topic != null ? String(row.topic) : "";
    nextRow.teacherName = row?.teacherName != null ? String(row.teacherName) : "";
    nextRow.classwork = row?.classwork != null ? String(row.classwork) : "";
    nextRow.homework = row?.homework != null ? String(row.homework) : "";
    nextRow.teacherSignature = normalizeYesNo(row?.teacherSignature);
    nextRow.monitorInitials = normalizeYesNo(row?.monitorInitials);
    return nextRow;
  });

  const attendanceRowsSource = Array.isArray(source.attendanceRows) ? source.attendanceRows : [];
  result.attendanceRows = attendanceRowsSource.map((row) => {
    const nextRow = { ...(row || {}) };
    const absentList = ensureArray(row?.absentStudents);
    const rawDetails = row?.absenceDetails && typeof row.absenceDetails === "object" ? row.absenceDetails : {};
    const filteredDetails = {};
    absentList.forEach((student) => {
      filteredDetails[student] = { ...getDefaultAttendanceDetail(), ...(rawDetails[student] || {}) };
    });
    nextRow.session = row?.session != null ? String(row.session) : "";
    nextRow.absentStudents = absentList;
    nextRow.presentCount = row?.presentCount != null ? String(row.presentCount) : "";
    nextRow.absentCount = row?.absentCount != null ? String(row.absentCount) : "";
    nextRow.notes = row?.notes != null ? String(row.notes) : "";
    nextRow.absenceDetails = filteredDetails;
    return nextRow;
  });

  return result;
};

const toCleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const createEmptySubjectLesson = () => ({
  classLabel: "",
  period: "",
  subject: "",
  topic: "",
  classwork: "",
  homework: "",
  teacherSignature: "",
  monitorInitials: "",
});

const sortLessonPeriods = (values) => {
  const unique = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => toCleanString(value))
        .filter((value) => value.length > 0)
    )
  );
  return unique.sort((a, b) => {
    const numA = extractNumericPeriod(a);
    const numB = extractNumericPeriod(b);
    if (numA === null && numB === null) return a.localeCompare(b);
    if (numA === null) return 1;
    if (numB === null) return -1;
    return numA - numB;
  });
};

const computeSubjectSummaryFromLessons = (lessons) => {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return {
      totalLessons: 0,
      classes: [],
    };
  }

  const classMap = new Map();
  let total = 0;

  lessons.forEach((lesson) => {
    const classLabel = toCleanString(lesson?.classLabel);
    const period = toCleanString(lesson?.period);
    const subject = toCleanString(lesson?.subject);
    const topic = toCleanString(lesson?.topic);
    const classwork = toCleanString(lesson?.classwork);
    const homework = toCleanString(lesson?.homework);

    const hasContent = classLabel || period || subject || topic || classwork || homework;
    if (!hasContent) return;
    total += 1;

    const key = classLabel || "Class";
    if (!classMap.has(key)) {
      classMap.set(key, {
        classLabel: key,
        totalPeriods: 0,
        periods: [],
      });
    }
    const entry = classMap.get(key);
    entry.totalPeriods += 1;
    if (period) entry.periods.push(period);
  });

  const classes = Array.from(classMap.values()).map((entry) => ({
    ...entry,
    periods: sortLessonPeriods(entry.periods),
  }));

  return {
    totalLessons: total,
    classes,
  };
};

const sanitizeSubjectPayload = (payload, { markManual = false } = {}) => {
  const base = payload && typeof payload === "object" ? payload : {};
  const lessonsSource = Array.isArray(base.lessons) ? base.lessons : [];
  const lessons = lessonsSource.map((lesson) => ({
    classLabel: toCleanString(lesson?.classLabel),
    period: toCleanString(lesson?.period),
    subject: toCleanString(lesson?.subject),
    topic: toCleanString(lesson?.topic),
    classwork: toCleanString(lesson?.classwork),
    homework: toCleanString(lesson?.homework),
    teacherSignature: normalizeYesNo(lesson?.teacherSignature),
    monitorInitials: normalizeYesNo(lesson?.monitorInitials),
  }));

  const sourcesRaw = base.sources && typeof base.sources === "object" ? base.sources : {};
  const ptInstances = Array.isArray(sourcesRaw.ptInstances)
    ? Array.from(new Set(sourcesRaw.ptInstances.filter((id) => id !== null && id !== undefined)))
    : [];
  const sources = ptInstances.length ? { ptInstances } : {};

  const summary = computeSubjectSummaryFromLessons(lessons);
  const teacher =
    base.teacher && typeof base.teacher === "object" && (base.teacher.id || base.teacher.name) ? base.teacher : null;
  const date = base.date ? String(base.date) : null;
  const manual = markManual ? true : Boolean(base.subjectSourceManual);

  const sanitized = {
    lessons,
    summary,
    sources,
    subjectSourceManual: manual,
  };

  if (teacher) sanitized.teacher = teacher;
  if (date) sanitized.date = date;
  if (!ptInstances.length && !Object.keys(sources).length) {
    sanitized.sources = {};
  }

  return sanitized;
};

const buildInitialSubjectPayload = (payload) => {
  let resolved = payload;
  if (typeof resolved === "string") {
    try {
      resolved = JSON.parse(resolved);
    } catch {
      resolved = {};
    }
  }
  return sanitizeSubjectPayload(resolved);
};

const buildInitialPtPayload = (payload) => {
  let resolved = payload;
  if (typeof resolved === "string") {
    try {
      resolved = JSON.parse(resolved);
    } catch {
      resolved = {};
    }
  }
  const sanitized = sanitizePtPayload(resolved) || {};
  return {
    ...sanitized,
    cddRows: Array.isArray(sanitized.cddRows) ? sanitized.cddRows : [],
    ccdRows: Array.isArray(sanitized.ccdRows) ? sanitized.ccdRows : [],
    attendanceRows: Array.isArray(sanitized.attendanceRows) ? sanitized.attendanceRows : [],
  };
};

const createEmptyCddRow = (defaultDate = "") => ({
  date: defaultDate,
  assemblyUniformDefaulters: [],
  languageDefaulters: [],
  homeworkDefaulters: [],
  disciplineDefaulters: [],
  bestStudentOfDay: [],
  absentStudents: [],
  teacherSigned: "",
  principalStamp: "",
});

const extractNumericPeriod = (value) => {
  if (value == null) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
};

const getNextCcdPeriod = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return "1";
  const max = rows.reduce((acc, row) => {
    const current = extractNumericPeriod(row?.period);
    return Number.isFinite(current) ? Math.max(acc, current) : acc;
  }, 0);
  return String(max + 1);
};

const createEmptyCcdRow = (period = "") => ({
  period,
  subject: "",
  topic: "",
  teacherName: "",
  classwork: "",
  homework: "",
  teacherSignature: "",
  monitorInitials: "",
});

const createEmptyAttendanceRow = () => ({
  session: "",
  absentStudents: [],
  presentCount: "",
  absentCount: "",
  notes: "",
  absenceDetails: {},
});

const getDefaultAttendanceDetail = () => ({
  applicationSubmitted: "No",
  reason: "",
  note: DEFAULT_APPLICATION_FOLLOWUP,
});

const createEmptyRowForSection = (sectionKey) => {
  if (sectionKey === "cddRows") {
    return createEmptyCddRow();
  }
  if (sectionKey === "ccdRows") {
    return createEmptyCcdRow();
  }
  return createEmptyAttendanceRow();
};

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
  const [ptEditablePayload, setPtEditablePayload] = useState(null);
  const [ptEditModal, setPtEditModal] = useState(null);
  const [subjectEditablePayload, setSubjectEditablePayload] = useState(null);
  const [hasSubjectEdits, setHasSubjectEdits] = useState(false);

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

  const ptDailyReports = useMemo(
    () => mriReports.filter((report) => report?.templateKey === PT_DAILY_REPORT_KEY),
    [mriReports]
  );

  const subjectReports = useMemo(
    () => mriReports.filter((report) => report?.templateKey === SUBJECT_REPORT_KEY),
    [mriReports]
  );

  const pendingReportCount = useMemo(
    () => mriReports.filter((report) => !RESOLVED_REPORT_STATUSES.has(String(report?.status || "").toLowerCase())).length,
    [mriReports]
  );

  const pendingPtReportCount = useMemo(
    () =>
      ptDailyReports.filter(
        (report) => !RESOLVED_REPORT_STATUSES.has(String(report?.status || "").toLowerCase())
      ).length,
    [ptDailyReports]
  );

  const pendingSubjectReportCount = useMemo(
    () =>
      subjectReports.filter(
        (report) => !RESOLVED_REPORT_STATUSES.has(String(report?.status || "").toLowerCase())
      ).length,
    [subjectReports]
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
    if (report?.templateKey === PT_DAILY_REPORT_KEY) {
      setPtActiveSection("cdd");
      setPtEditablePayload(buildInitialPtPayload(report?.payload));
    } else {
      setPtEditablePayload(null);
    }
    if (report?.templateKey === SUBJECT_REPORT_KEY) {
      const initial = buildInitialSubjectPayload(report?.payload);
      setSubjectEditablePayload(initial);
      setHasSubjectEdits(false);
    } else {
      setSubjectEditablePayload(null);
      setHasSubjectEdits(false);
    }
    setPtEditModal(null);
  };

  const closeReportModal = () => {
    setActiveReport(null);
    setReportNote("");
    setReportError("");
    setShowConfirmationNote(false);
    setPtEditablePayload(null);
    setPtEditModal(null);
    setSubjectEditablePayload(null);
    setHasSubjectEdits(false);
  };

  const handleReportAction = async (action) => {
    if (!activeReport || !activeReport.instanceId) return;
    setIsSavingReport(true);
    setReportError("");
    try {
      let payloadForRequest;
      if (isPtReport) {
        const workingPayload = ptEditablePayload ?? buildInitialPtPayload(activeReportPayload);
        const sanitized = sanitizePtPayload(workingPayload);
        payloadForRequest = sanitized;
        setPtEditablePayload(sanitized);
      } else if (isSubjectReport) {
        const workingPayload = subjectEditablePayload ?? buildInitialSubjectPayload(activeReportPayload);
        const sanitized = sanitizeSubjectPayload(workingPayload, {
          markManual: hasSubjectEdits || Boolean(workingPayload?.subjectSourceManual),
        });
        payloadForRequest = sanitized;
        setSubjectEditablePayload(sanitized);
      }

      const res = await fetch("/api/member/mri-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: activeReport.instanceId,
          action,
          payload: payloadForRequest,
          confirmationNote: reportNote || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update report");
      }
      const updatedData = await mutateReports();
      if (action !== "submit" && updatedData?.reports) {
        const refreshed = updatedData.reports.find(
          (report) => report?.instanceId === activeReport.instanceId
        );
        if (refreshed) {
          setActiveReport(refreshed);
          setReportNote(refreshed.confirmationNote || "");
          setShowConfirmationNote(Boolean(refreshed.confirmationNote));
          if (refreshed?.templateKey === PT_DAILY_REPORT_KEY) {
            setPtEditablePayload(buildInitialPtPayload(refreshed.payload));
          }
          if (refreshed?.templateKey === SUBJECT_REPORT_KEY) {
            const refreshedPayload = buildInitialSubjectPayload(refreshed.payload);
            setSubjectEditablePayload(refreshedPayload);
            setHasSubjectEdits(false);
          }
        } else if (payloadForRequest) {
          setActiveReport((prev) =>
            prev
              ? {
                  ...prev,
                  payload: payloadForRequest,
                }
              : prev
          );
          if (isSubjectReport) {
            setSubjectEditablePayload(payloadForRequest);
            setHasSubjectEdits(false);
          }
        }
        if (isSubjectReport) {
          setHasSubjectEdits(false);
        }
      }
      if (action === "submit") {
        closeReportModal();
      } else if (isSubjectReport) {
        setHasSubjectEdits(false);
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
    const exclude = new Set(["cddRows", "ccdRows", "attendanceRows", "lessons", "summary", "sources", "teacher"]);
    return Object.entries(activeReportPayload).filter(([key]) => !exclude.has(key));
  }, [activeReportPayload]);

  const isPtReport = useMemo(
    () => activeReport?.templateKey === PT_DAILY_REPORT_KEY,
    [activeReport?.templateKey]
  );

  const isSubjectReport = useMemo(
    () => activeReport?.templateKey === SUBJECT_REPORT_KEY,
    [activeReport?.templateKey]
  );

  const activeSubjectLessons = useMemo(() => {
    if (!isSubjectReport) return [];
    if (subjectEditablePayload && typeof subjectEditablePayload === "object") {
      const lessons = subjectEditablePayload.lessons;
      return Array.isArray(lessons) ? lessons : [];
    }
    if (!activeReportPayload || typeof activeReportPayload !== "object") return [];
    const lessons = activeReportPayload.lessons;
    return Array.isArray(lessons) ? lessons : [];
  }, [isSubjectReport, subjectEditablePayload, activeReportPayload]);

  const subjectSummary = useMemo(() => {
    if (!isSubjectReport) return null;
    if (subjectEditablePayload?.summary && typeof subjectEditablePayload.summary === "object") {
      return subjectEditablePayload.summary;
    }
    if (!activeReportPayload || typeof activeReportPayload !== "object") return null;
    const summary = activeReportPayload.summary;
    return summary && typeof summary === "object" ? summary : null;
  }, [isSubjectReport, subjectEditablePayload, activeReportPayload]);

  const activeReportStatus = useMemo(() => {
    if (!activeReport) return "pending";
    return String(activeReport.status || "pending").toLowerCase();
  }, [activeReport]);

  const activeReportBadgeClass = useMemo(
    () => REPORT_STATUS_STYLES[activeReportStatus] || REPORT_STATUS_STYLES.default,
    [activeReportStatus]
  );

  const canEditPtReport = useMemo(
    () => isPtReport && !["verified", "waived"].includes(activeReportStatus),
    [isPtReport, activeReportStatus]
  );

  const canEditSubjectReport = useMemo(
    () => isSubjectReport && !["verified", "waived"].includes(activeReportStatus),
    [isSubjectReport, activeReportStatus]
  );

  const ptActiveClassId = useMemo(() => {
    if (!isPtReport) return null;
    const directId = Number(activeReport?.class?.id);
    if (Number.isFinite(directId) && directId > 0) return directId;
    const metaClass = activeReport?.meta?.class;
    const metaId = metaClass?.id ?? activeReport?.meta?.classId;
    const parsedMetaId = Number(metaId);
    return Number.isFinite(parsedMetaId) && parsedMetaId > 0 ? parsedMetaId : null;
  }, [isPtReport, activeReport]);

  const {
    data: ptRosterData,
    isLoading: isPtRosterLoading,
  } = useSWR(
    isPtReport && ptActiveClassId ? `/api/member/mris/students?classId=${ptActiveClassId}` : null,
    fetcher
  );

  const ptClassStudents = useMemo(() => {
    const list = ptRosterData?.students;
    return Array.isArray(list) ? list : [];
  }, [ptRosterData]);

  const ptClassStudentCount = ptClassStudents.length;

  const {
    data: ptTeacherDirectory,
    isLoading: isPtTeachersLoading,
    error: ptTeacherDirectoryError,
  } = useSWR(isPtReport ? "/api/member/mris/teachers?onlyTeachers=true" : null, fetcher);

  const ptTeacherOptions = useMemo(() => {
    const rows = Array.isArray(ptTeacherDirectory?.teachers) ? ptTeacherDirectory.teachers : [];
    return rows
      .map((row) => ({ id: row.id, name: row.name || `Member #${row.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ptTeacherDirectory]);

  const workingCddRows = useMemo(() => {
    if (isPtReport && ptEditablePayload) {
      return Array.isArray(ptEditablePayload.cddRows) ? ptEditablePayload.cddRows : [];
    }
    return activeReportCddRows;
  }, [isPtReport, ptEditablePayload, activeReportCddRows]);

  const workingCcdRows = useMemo(() => {
    if (isPtReport && ptEditablePayload) {
      return Array.isArray(ptEditablePayload.ccdRows) ? ptEditablePayload.ccdRows : [];
    }
    return activeReportCcdRows;
  }, [isPtReport, ptEditablePayload, activeReportCcdRows]);

  const workingAttendanceRows = useMemo(() => {
    if (isPtReport && ptEditablePayload) {
      return Array.isArray(ptEditablePayload.attendanceRows) ? ptEditablePayload.attendanceRows : [];
    }
    return activeReportAttendanceRows;
  }, [isPtReport, ptEditablePayload, activeReportAttendanceRows]);

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
    if (isPtReport) {
      const hasEntries =
        workingCddRows.length > 0 ||
        workingCcdRows.length > 0 ||
        workingAttendanceRows.length > 0;
      if (hasEntries) return null;
    }
    return (
      <pre className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
        No digital entries yet. Please review the physical register before confirming.
      </pre>
    );
  };

  const renderPtCddTable = () => {
    if (!workingCddRows.length) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          No CDD entries captured yet.
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto">
        <table className="min-w-[1200px] table-fixed text-xs text-slate-700">
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
            {workingCddRows.map((row, rowIndex) => (
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
    if (!workingCcdRows.length) {
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
            {workingCcdRows.map((row, rowIndex) => (
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
    if (!workingAttendanceRows.length) {
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
            {workingAttendanceRows.map((row, rowIndex) => (
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

  const getSectionKeyFromModal = (modal) => PT_SECTION_KEY_MAP[modal] || "cddRows";

  const renderSubjectSummarySection = () => {
    if (!isSubjectReport) return null;
    const summary = subjectSummary;
    const classEntries = Array.isArray(summary?.classes) ? summary.classes : [];
    const totalLessons =
      typeof summary?.totalLessons === "number" ? summary.totalLessons : activeSubjectLessons.length;

    if (totalLessons === 0 && classEntries.length === 0) {
      return canEditSubjectReport ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-700">
          No lessons captured yet. Use “Add Lesson” to record what you taught today.
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-700">
          No lessons were recorded for you in today&apos;s CCD.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-700">Summary</h4>
          {hasSubjectEdits && canEditSubjectReport && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">
              Unsaved edits
            </span>
          )}
        </div>
        {canEditSubjectReport && (
          <p className="text-[0.7rem] text-slate-500">
            Manual updates will stay as-is and won’t be overwritten by the automatic CCD sync.
          </p>
        )}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-700">
          <p className="font-semibold">
            Total periods captured: {totalLessons}
          </p>
          {classEntries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {classEntries.map((entry, index) => (
                <div
                  key={`${entry?.classId ?? entry?.classLabel ?? index}`}
                  className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-[0.7rem] text-indigo-700 shadow-sm"
                >
                  <p className="font-semibold">
                    {entry?.classLabel || "Class"}
                  </p>
                  <p className="text-[0.65rem] text-indigo-600">
                    {entry?.totalPeriods || 0} period{entry?.totalPeriods === 1 ? "" : "s"}
                    {Array.isArray(entry?.periods) && entry.periods.length > 0
                      ? ` • ${entry.periods.join(", ")}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSubjectLessonsTable = () => {
    if (!activeSubjectLessons.length) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          No lessons captured yet.
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto">
        <table className="min-w-[1100px] table-fixed text-xs text-slate-700">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">#</th>
              {SUBJECT_REPORT_COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-2 text-left font-semibold text-slate-700">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSubjectLessons.map((lesson, index) => (
              <tr key={`subject-lesson-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 align-top font-semibold text-slate-500">{index + 1}</td>
                {SUBJECT_REPORT_COLUMNS.map((column) => {
                  const rawValue = lesson?.[column.key];
                  const displayValue = formatCellValue(rawValue);
                  return (
                    <td key={`${column.key}-${index}`} className="px-4 py-3 align-top">
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

  const applySubjectLessonsUpdate = (updater) => {
    setSubjectEditablePayload((prev) => {
      const base = prev ?? buildInitialSubjectPayload(activeReportPayload);
      const currentLessons = Array.isArray(base.lessons) ? [...base.lessons] : [];
      const updatedLessonsRaw = updater(currentLessons, base);
      const updatedLessons = Array.isArray(updatedLessonsRaw) ? updatedLessonsRaw : currentLessons;
      const candidate = { ...base, lessons: updatedLessons };
      return sanitizeSubjectPayload(candidate, { markManual: Boolean(base.subjectSourceManual) });
    });
    setHasSubjectEdits(true);
  };

  const updateSubjectLesson = (rowIndex, updater) => {
    applySubjectLessonsUpdate((lessons) => {
      const nextLessons = [...lessons];
      if (!nextLessons[rowIndex]) {
        nextLessons[rowIndex] = createEmptySubjectLesson();
      }
      const current = nextLessons[rowIndex];
      const patch = typeof updater === "function" ? updater(current) : updater;
      nextLessons[rowIndex] = { ...current, ...patch };
      return nextLessons;
    });
  };

  const addSubjectLesson = () => {
    applySubjectLessonsUpdate((lessons) => {
      const nextLessons = [...lessons];
      const previous = nextLessons.length ? nextLessons[nextLessons.length - 1] : createEmptySubjectLesson();
      const newLesson = {
        ...createEmptySubjectLesson(),
        classLabel: toCleanString(previous?.classLabel),
        subject: toCleanString(previous?.subject),
      };
      nextLessons.push(newLesson);
      return nextLessons;
    });
  };

  const removeSubjectLesson = (rowIndex) => {
    applySubjectLessonsUpdate((lessons) => {
      if (rowIndex < 0 || rowIndex >= lessons.length) return lessons;
      const nextLessons = [...lessons];
      nextLessons.splice(rowIndex, 1);
      return nextLessons;
    });
  };

  const clearSubjectLessons = () => {
    applySubjectLessonsUpdate(() => []);
  };

  const renderSubjectLessonsEditor = () => {
    const editingPayload = subjectEditablePayload ?? buildInitialSubjectPayload(activeReportPayload);
    const lessons = Array.isArray(editingPayload?.lessons) ? editingPayload.lessons : [];
    const disableEditing = isSavingReport;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Lesson Entries</h4>
            <p className="text-[0.7rem] text-slate-500">
              Update the subject, topic, classwork and homework for each period you taught.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={addSubjectLesson}
              disabled={disableEditing}
            >
              Add Lesson
            </button>
            {lessons.length > 0 && (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={clearSubjectLessons}
                disabled={disableEditing}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1200px] text-xs text-slate-700">
            <thead className="bg-slate-100">
              <tr>
                {SUBJECT_EDIT_HEADERS.map((header) => (
                  <th key={header.id} className="border border-slate-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.length === 0 ? (
                <tr>
                  <td
                    colSpan={SUBJECT_EDIT_HEADERS.length + 1}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    No lessons captured yet. Use “Add Lesson” to start recording the periods you taught.
                  </td>
                </tr>
              ) : (
                lessons.map((lesson, rowIndex) => (
                  <tr key={`subject-edit-lesson-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {SUBJECT_EDIT_HEADERS.map((header) => {
                      const fieldId = header.id;
                      const value = lesson?.[fieldId];
                      if (header.type === "textarea") {
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <textarea
                              className="h-20 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              placeholder={header.placeholder || ""}
                              value={toCleanString(value)}
                              onChange={(event) =>
                                updateSubjectLesson(rowIndex, { [fieldId]: event.target.value })
                              }
                              disabled={disableEditing}
                            />
                          </td>
                        );
                      }
                      if (header.type === "select") {
                        const options = header.options?.length ? ["", ...header.options] : YES_NO_OPTIONS;
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <select
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              value={normalizeYesNo(value)}
                              onChange={(event) =>
                                updateSubjectLesson(rowIndex, {
                                  [fieldId]: normalizeYesNo(event.target.value),
                                })
                              }
                              disabled={disableEditing}
                            >
                              {options.map((option) => (
                                <option key={`${fieldId}-${option || "unset"}`} value={option}>
                                  {option || "Select…"}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                          <input
                            type="text"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                            placeholder={header.placeholder || ""}
                            value={toCleanString(value)}
                            onChange={(event) =>
                              updateSubjectLesson(rowIndex, { [fieldId]: event.target.value })
                            }
                            disabled={disableEditing}
                          />
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 px-2 py-2 align-top">
                      <button
                        type="button"
                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[0.65rem] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => removeSubjectLesson(rowIndex)}
                        disabled={disableEditing}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const updatePtRow = (sectionKey, rowIndex, updater) => {
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next[sectionKey]) ? [...next[sectionKey]] : [];
      if (!rows[rowIndex]) rows[rowIndex] = {};
      const currentRow = { ...rows[rowIndex] };
      const patch = typeof updater === "function" ? updater(currentRow) : updater;
      rows[rowIndex] = { ...currentRow, ...patch };
      next[sectionKey] = rows;
      return next;
    });
  };

  const addPtRow = (sectionKey) => {
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next[sectionKey]) ? [...next[sectionKey]] : [];
      if (sectionKey === "cddRows") {
        const lastDate = rows.length ? rows[rows.length - 1]?.date : formatISTDate(new Date());
        rows.push(createEmptyCddRow(lastDate || formatISTDate(new Date())));
      } else if (sectionKey === "ccdRows") {
        const nextPeriod = getNextCcdPeriod(rows);
        const newRow = createEmptyCcdRow(nextPeriod);
        const previousTeacher = rows.length ? rows[rows.length - 1]?.teacherName : ptTeacherOptions[0]?.name;
        newRow.teacherName = previousTeacher || "";
        rows.push(newRow);
      } else {
        rows.push(createEmptyAttendanceRow());
      }
      next[sectionKey] = rows;
      return next;
    });
  };

  const removePtRow = (sectionKey, rowIndex) => {
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next[sectionKey]) ? [...next[sectionKey]] : [];
      if (rowIndex < 0 || rowIndex >= rows.length) return next;
      rows.splice(rowIndex, 1);
      next[sectionKey] = rows;
      return next;
    });
  };

  const clearPtSection = (sectionKey) => {
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      return { ...base, [sectionKey]: [] };
    });
  };

  const setPtAbsentStudents = (rowIndex, rawList) => {
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next.attendanceRows) ? [...next.attendanceRows] : [];
      const current = { ...(rows[rowIndex] || createEmptyAttendanceRow()) };
      const values = Array.from(
        new Set(
          rawList
            .map((value) => String(value || "").trim())
            .filter((value) => value.length > 0)
        )
      );
      const existingDetails =
        current.absenceDetails && typeof current.absenceDetails === "object" ? current.absenceDetails : {};
      const normalizedDetails = {};
      values.forEach((name) => {
        normalizedDetails[name] = { ...getDefaultAttendanceDetail(), ...(existingDetails[name] || {}) };
      });
      const absentCount = values.length;
      const presentCount =
        ptClassStudentCount > 0 ? Math.max(ptClassStudentCount - absentCount, 0) : null;
      current.absentStudents = values;
      current.absentCount = String(absentCount);
      if (presentCount !== null) {
        current.presentCount = String(presentCount);
      } else if (current.presentCount == null) {
        current.presentCount = "";
      }
      current.absenceDetails = normalizedDetails;
      rows[rowIndex] = current;
      next.attendanceRows = rows;
      return next;
    });
  };

  const togglePtAbsentStudent = (rowIndex, studentName) => {
    const normalized = String(studentName || "").trim();
    if (!normalized) return;
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next.attendanceRows) ? [...next.attendanceRows] : [];
      const current = { ...(rows[rowIndex] || createEmptyAttendanceRow()) };
      const list = Array.isArray(current.absentStudents) ? [...current.absentStudents] : [];
      const details =
        current.absenceDetails && typeof current.absenceDetails === "object"
          ? { ...current.absenceDetails }
          : {};
      const idx = list.findIndex((name) => name === normalized);
      if (idx >= 0) {
        list.splice(idx, 1);
        delete details[normalized];
      } else {
        list.push(normalized);
        details[normalized] = { ...getDefaultAttendanceDetail(), ...(details[normalized] || {}) };
      }
      const uniqueList = Array.from(new Set(list));
      const absentCount = uniqueList.length;
      const presentCount =
        ptClassStudentCount > 0 ? Math.max(ptClassStudentCount - absentCount, 0) : null;
      current.absentStudents = uniqueList;
      current.absentCount = String(absentCount);
      if (presentCount !== null) {
        current.presentCount = String(presentCount);
      } else if (current.presentCount == null) {
        current.presentCount = "";
      }
      current.absenceDetails = details;
      rows[rowIndex] = current;
      next.attendanceRows = rows;
      return next;
    });
  };

  const updatePtAttendanceDetail = (rowIndex, studentName, patch) => {
    if (!studentName) return;
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next.attendanceRows) ? [...next.attendanceRows] : [];
      const current = { ...(rows[rowIndex] || createEmptyAttendanceRow()) };
      const normalized = String(studentName || "").trim();
      if (!normalized) return next;
      const details = current.absenceDetails && typeof current.absenceDetails === "object" ? { ...current.absenceDetails } : {};
      const existing = { ...getDefaultAttendanceDetail(), ...(details[normalized] || {}) };
      const updated = { ...existing, ...(patch || {}) };
      if (updated.applicationSubmitted === "No") {
        updated.reason = "";
        if (!updated.note) {
          updated.note = DEFAULT_APPLICATION_FOLLOWUP;
        }
      }
      details[normalized] = updated;
      current.absenceDetails = details;
      rows[rowIndex] = current;
      next.attendanceRows = rows;
      return next;
    });
  };

  const setPtChipValues = (sectionKey, rowIndex, fieldId, rawList) => {
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next[sectionKey]) ? [...next[sectionKey]] : [];
      const current = { ...(rows[rowIndex] || createEmptyRowForSection(sectionKey)) };
      const values = rawList
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0);
      current[fieldId] = values;
      rows[rowIndex] = current;
      next[sectionKey] = rows;
      return next;
    });
  };

  const togglePtChipValue = (sectionKey, rowIndex, fieldId, label) => {
    const normalized = String(label || "").trim();
    if (!normalized) return;
    setPtEditablePayload((prev) => {
      const base = prev ?? buildInitialPtPayload(activeReportPayload);
      const next = { ...base };
      const rows = Array.isArray(next[sectionKey]) ? [...next[sectionKey]] : [];
      const current = { ...(rows[rowIndex] || createEmptyRowForSection(sectionKey)) };
      const list = Array.isArray(current[fieldId]) ? [...current[fieldId]] : [];
      const idx = list.findIndex((value) => value === normalized);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(normalized);
      }
      current[fieldId] = Array.from(new Set(list));
      rows[rowIndex] = current;
      next[sectionKey] = rows;
      return next;
    });
  };

  const handleOpenPtEditModal = (section) => {
    if (!section || !isPtReport || !canEditPtReport) return;
    if (!ptEditablePayload) {
      setPtEditablePayload(buildInitialPtPayload(activeReportPayload));
    }
    setPtEditModal(section);
  };

  const handleClosePtEditModal = () => setPtEditModal(null);

  const renderConfirmationNoteSection = (variant = "footer") => {
    const inline = variant === "inline";
    const containerClass = inline
      ? "rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm"
      : "mt-5 border-t border-slate-200 pt-4";
    const toggleButtonClass = inline
      ? "flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      : "flex items-center gap-2 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";
    const summaryClass = inline
      ? "mt-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-[0.7rem] text-indigo-700 shadow-sm"
      : "mt-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[0.7rem] text-indigo-700";

    return (
      <div className={containerClass}>
        <button
          type="button"
          className={toggleButtonClass}
          onClick={() => setShowConfirmationNote((prev) => !prev)}
          disabled={isSavingReport}
        >
          {showConfirmationNote ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showConfirmationNote ? "Hide Confirmation Note" : "Add Confirmation Note"}
        </button>
        {!showConfirmationNote && reportNote && (
          <p className={summaryClass}>
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
    );
  };

  const renderPtEditModal = () => {
    if (!ptEditModal || !isPtReport) return null;
    const sectionKey = getSectionKeyFromModal(ptEditModal);
    const editingPayload = ptEditablePayload ?? buildInitialPtPayload(activeReportPayload);
    const rows = Array.isArray(editingPayload?.[sectionKey]) ? editingPayload[sectionKey] : [];
    const disableEditing = !canEditPtReport || isSavingReport;
    const sectionLabel = PT_SECTION_LABELS[ptEditModal] || "PT Diary Section";

    const renderHeaderActions = (sectionKey, addLabel, infoText) => (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{sectionLabel}</h4>
          {infoText && <p className="text-[0.7rem] text-slate-500">{infoText}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPtReport && (
            <button
              type="button"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => addPtRow(sectionKey)}
              disabled={disableEditing}
            >
              {addLabel}
            </button>
          )}
          {canEditPtReport && rows.length > 0 && (
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => clearPtSection(sectionKey)}
              disabled={disableEditing}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );

    const renderCddEditor = () => {
      const rosterPlural = ptClassStudentCount === 1 ? "" : "s";
      const rosterNote =
        ptClassStudentCount > 0
          ? `Capture defaulters, best student and signature details captured during the day. (Roster: ${ptClassStudentCount} student${rosterPlural})`
          : "Capture defaulters, best student and signature details captured during the day.";
      return (
        <div className="space-y-3">
          {renderHeaderActions("cddRows", "Add Day", rosterNote)}
          {ptTeacherDirectoryError && (
            <p className="text-[0.65rem] text-rose-600">
              Unable to load the teacher directory right now. You can still type the teacher's name manually.
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1100px] text-xs text-slate-700">
            <thead className="bg-slate-100">
              <tr>
                {PT_CDD_EDIT_HEADERS.map((header) => (
                  <th key={header.id} className="border border-slate-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                {canEditPtReport && (
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={PT_CDD_EDIT_HEADERS.length + (canEditPtReport ? 1 : 0)}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    No diary entries yet. Use “Add Day” to start recording CDD updates.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={`pt-edit-cdd-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {PT_CDD_EDIT_HEADERS.map((header) => {
                      const fieldId = header.id;
                      const value = row?.[fieldId];
                      if (header.type === "date") {
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <input
                              type="date"
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              value={toDateInputValue(value) || ""}
                              onChange={(event) =>
                                updatePtRow("cddRows", rowIndex, { [fieldId]: event.target.value || "" })
                              }
                              disabled={disableEditing}
                            />
                          </td>
                        );
                      }
                      if (header.type === "select") {
                        const options = header.options?.length ? ["", ...header.options] : YES_NO_OPTIONS;
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <select
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              value={normalizeYesNo(value)}
                              onChange={(event) =>
                                updatePtRow("cddRows", rowIndex, { [fieldId]: normalizeYesNo(event.target.value) })
                              }
                              disabled={disableEditing}
                            >
                              {options.map((option) => (
                                <option key={`${fieldId}-${option || "unset"}`} value={option}>
                                  {option || "Select…"}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      if (header.type === "chips") {
                        const chipValues = Array.isArray(value) ? value : [];
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <textarea
                              className="h-16 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              placeholder={header.placeholder || "Comma separated names"}
                              value={multiValueToString(chipValues)}
                              onChange={(event) =>
                                setPtChipValues("cddRows", rowIndex, fieldId, parseMultiValueInput(event.target.value))
                              }
                              disabled={disableEditing}
                            />
                            {ptActiveClassId && (
                              <div className="mt-2 space-y-1">
                                {isPtRosterLoading ? (
                                  <p className="text-[0.65rem] text-slate-500">Loading class roster…</p>
                                ) : ptClassStudents.length > 0 ? (
                                  <>
                                    <p className="text-[0.65rem] text-slate-500">
                                      Tap to toggle students for this field.
                                    </p>
                                    <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white/80 p-2">
                                      <div className="flex flex-wrap gap-1">
                                        {ptClassStudents.map((student) => {
                                          const rawLabel = student?.name || `Student #${student?.id ?? ""}`;
                                          const label = String(rawLabel || "").trim();
                                          if (!label) return null;
                                          const isSelected = chipValues.includes(label);
                                          return (
                                            <button
                                              type="button"
                                              key={`${rowIndex}-${fieldId}-${student?.id ?? label}`}
                                              className={`rounded-full px-2 py-1 text-[0.65rem] transition ${
                                                isSelected
                                                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                              } disabled:cursor-not-allowed disabled:opacity-60`}
                                              onClick={() => togglePtChipValue("cddRows", rowIndex, fieldId, label)}
                                              disabled={disableEditing}
                                            >
                                              {label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[0.65rem] text-amber-600">No roster found for this class.</p>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                          <input
                            type="text"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                            placeholder={header.placeholder || ""}
                            value={String(value ?? "")}
                            onChange={(event) =>
                              updatePtRow("cddRows", rowIndex, { [fieldId]: event.target.value })
                            }
                            disabled={disableEditing}
                          />
                        </td>
                      );
                    })}
                    {canEditPtReport && (
                      <td className="border border-slate-200 px-2 py-2 align-top">
                        <button
                          type="button"
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[0.65rem] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => removePtRow("cddRows", rowIndex)}
                          disabled={disableEditing}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[0.65rem] text-slate-500">
          Tip: use comma-separated names for defaulters and absent students. Leave sign fields blank until stamped.
        </p>
      </div>
      );
    };

    const renderCcdEditor = () => (
      <div className="space-y-3">
        {renderHeaderActions(
          "ccdRows",
          "Add Period",
          "Record period-wise coverage and homework before confirming with the class teacher."
        )}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1200px] text-xs text-slate-700">
            <thead className="bg-slate-100">
              <tr>
                {PT_CCD_EDIT_HEADERS.map((header) => (
                  <th key={header.id} className="border border-slate-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                {canEditPtReport && (
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={PT_CCD_EDIT_HEADERS.length + (canEditPtReport ? 1 : 0)}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    No periods recorded yet. Use “Add Period” to start logging CCD details.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={`pt-edit-ccd-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {PT_CCD_EDIT_HEADERS.map((header) => {
                      const fieldId = header.id;
                      const value = row?.[fieldId];
                      if (header.type === "teacherSelect") {
                        const currentTeacher = String(value ?? "");
                        const optionPool = ptTeacherOptions.some((teacher) => teacher.name === currentTeacher)
                          ? ptTeacherOptions
                          : currentTeacher
                          ? [...ptTeacherOptions, { id: `current-${rowIndex}`, name: currentTeacher }]
                          : ptTeacherOptions;
                        if (!isPtTeachersLoading && !optionPool.length) {
                          return (
                            <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                              <input
                                type="text"
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
                                placeholder="Type teacher name"
                                value={currentTeacher}
                                onChange={(event) => updatePtRow("ccdRows", rowIndex, { [fieldId]: event.target.value })}
                                disabled={disableEditing}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <select
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
                              value={String(value ?? "")}
                              onChange={(event) =>
                                updatePtRow("ccdRows", rowIndex, { [fieldId]: event.target.value })
                              }
                              disabled={disableEditing || isPtTeachersLoading}
                            >
                              <option value="">
                                {isPtTeachersLoading ? "Loading teachers…" : "Select teacher"}
                              </option>
                              {optionPool.map((teacher) => (
                                <option key={`${fieldId}-${teacher.id}`} value={teacher.name}>
                                  {teacher.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      if (header.type === "textarea") {
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <textarea
                              className="h-20 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              placeholder={header.placeholder || ""}
                              value={String(value ?? "")}
                              onChange={(event) =>
                                updatePtRow("ccdRows", rowIndex, { [fieldId]: event.target.value })
                              }
                              disabled={disableEditing}
                            />
                          </td>
                        );
                      }
                      if (header.type === "select") {
                        const options = header.options?.length ? ["", ...header.options] : YES_NO_OPTIONS;
                        return (
                          <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                            <select
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                              value={normalizeYesNo(value)}
                              onChange={(event) =>
                                updatePtRow("ccdRows", rowIndex, {
                                  [fieldId]: normalizeYesNo(event.target.value),
                                })
                              }
                              disabled={disableEditing}
                            >
                              {options.map((option) => (
                                <option key={`${fieldId}-${option || "unset"}`} value={option}>
                                  {option || "Select…"}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                          <input
                            type="text"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                            placeholder={header.placeholder || ""}
                            value={String(value ?? "")}
                            onChange={(event) =>
                              updatePtRow("ccdRows", rowIndex, { [fieldId]: event.target.value })
                            }
                            disabled={disableEditing}
                          />
                        </td>
                      );
                    })}
                    {canEditPtReport && (
                      <td className="border border-slate-200 px-2 py-2 align-top">
                        <button
                          type="button"
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[0.65rem] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => removePtRow("ccdRows", rowIndex)}
                          disabled={disableEditing}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[0.65rem] text-slate-500">
          Period number auto-increments. Adjust the subject/topic and include homework instructions teachers should review.
        </p>
      </div>
    );

    const renderAttendanceEditor = () => {
      const rosterPlural = ptClassStudentCount === 1 ? "" : "s";
      const attendanceInfo =
        ptClassStudentCount > 0
          ? `Keep a quick snapshot of attendance exceptions that the CT needs to confirm. (Roster: ${ptClassStudentCount} student${rosterPlural})`
          : "Keep a quick snapshot of attendance exceptions that the CT needs to confirm.";
      return (
        <div className="space-y-3">
          {renderHeaderActions("attendanceRows", "Add Session", attendanceInfo)}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[950px] text-xs text-slate-700">
            <thead className="bg-slate-100">
              <tr>
                {PT_ATTENDANCE_EDIT_HEADERS.map((header) => (
                  <th key={header.id} className="border border-slate-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                {canEditPtReport && (
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={PT_ATTENDANCE_EDIT_HEADERS.length + (canEditPtReport ? 1 : 0)}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    No attendance snapshots captured yet. Use “Add Session” to log morning/afternoon notes.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const absentList = Array.isArray(row?.absentStudents) ? row.absentStudents : [];
                  const details =
                    row?.absenceDetails && typeof row.absenceDetails === "object" ? row.absenceDetails : {};
                  return (
                    <Fragment key={`pt-edit-attendance-${rowIndex}`}>
                      <tr className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        {PT_ATTENDANCE_EDIT_HEADERS.map((header) => {
                          const fieldId = header.id;
                          const value = row?.[fieldId];
                          if (header.type === "textarea") {
                            return (
                              <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                                <textarea
                                  className="h-16 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                                  placeholder={header.placeholder || ""}
                                  value={String(value ?? "")}
                                  onChange={(event) =>
                                    updatePtRow("attendanceRows", rowIndex, { [fieldId]: event.target.value })
                                  }
                                  disabled={disableEditing}
                                />
                              </td>
                            );
                          }
                          if (header.type === "chips") {
                            return (
                              <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                                <textarea
                                  className="h-16 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                                  placeholder={header.placeholder || "Comma separated names"}
                                  value={multiValueToString(value)}
                                  onChange={(event) =>
                                    setPtAbsentStudents(rowIndex, parseMultiValueInput(event.target.value))
                                  }
                                  disabled={disableEditing}
                                />
                                {ptActiveClassId && (
                                  <div className="mt-2 space-y-1">
                                    {isPtRosterLoading ? (
                                      <p className="text-[0.65rem] text-slate-500">Loading class roster…</p>
                                    ) : ptClassStudents.length > 0 ? (
                                      <>
                                        <p className="text-[0.65rem] text-slate-500">Tap to toggle absent students:</p>
                                        <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white/80 p-2">
                                          <div className="flex flex-wrap gap-1">
                                            {ptClassStudents.map((student) => {
                                              const rawLabel = student?.name || `Student #${student?.id ?? ""}`;
                                              const label = String(rawLabel || "").trim();
                                              if (!label) return null;
                                              const isSelected = absentList.some((name) => name === label);
                                              return (
                                                <button
                                                  type="button"
                                                  key={`${rowIndex}-${student?.id ?? label}`}
                                                  className={`rounded-full px-2 py-1 text-[0.65rem] transition ${
                                                    isSelected
                                                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                                  onClick={() => togglePtAbsentStudent(rowIndex, label)}
                                                  disabled={disableEditing}
                                                >
                                                  {label}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <p className="text-[0.65rem] text-amber-600">No roster found for this class.</p>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          }
                          if (header.type === "readonly") {
                            return (
                              <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                                <input
                                  type="text"
                                  readOnly
                                  className="w-full rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                  value={String(value ?? "")}
                                />
                              </td>
                            );
                          }
                          return (
                            <td key={fieldId} className="border border-slate-200 px-2 py-2 align-top">
                              <input
                                type="text"
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                                placeholder={header.placeholder || ""}
                                value={String(value ?? "")}
                                onChange={(event) =>
                                  updatePtRow("attendanceRows", rowIndex, { [fieldId]: event.target.value })
                                }
                                disabled={disableEditing}
                              />
                            </td>
                          );
                        })}
                        {canEditPtReport && (
                          <td className="border border-slate-200 px-2 py-2 align-top">
                            <button
                              type="button"
                              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[0.65rem] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => removePtRow("attendanceRows", rowIndex)}
                              disabled={disableEditing}
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                      {absentList.length > 0 && (
                        <tr className="bg-slate-50/60">
                          <td
                            colSpan={PT_ATTENDANCE_EDIT_HEADERS.length + (canEditPtReport ? 1 : 0)}
                            className="border border-slate-200 px-4 py-3"
                          >
                            <div className="space-y-3">
                              {absentList.map((student) => {
                                const detail = { ...getDefaultAttendanceDetail(), ...(details[student] || {}) };
                                return (
                                  <div
                                    key={`${rowIndex}-${student}`}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700 shadow-sm"
                                  >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                      <p className="font-semibold text-slate-800">{student}</p>
                                      <div className="flex flex-wrap items-center gap-3">
                                        <label className="flex items-center gap-2">
                                          <span className="text-[0.7rem] text-slate-600">Application Submitted?</span>
                                          <select
                                            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
                                            value={detail.applicationSubmitted || "No"}
                                            onChange={(event) =>
                                              updatePtAttendanceDetail(rowIndex, student, {
                                                applicationSubmitted: event.target.value,
                                              })
                                            }
                                            disabled={disableEditing}
                                          >
                                            {YES_NO_OPTIONS.slice(1).map((option) => (
                                              <option key={option} value={option}>
                                                {option}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label className="flex items-center gap-2">
                                          <span className="text-[0.7rem] text-slate-600">Reason</span>
                                          <select
                                            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
                                            value={detail.reason || ""}
                                            onChange={(event) =>
                                              updatePtAttendanceDetail(rowIndex, student, {
                                                reason: event.target.value,
                                              })
                                            }
                                            disabled={disableEditing || detail.applicationSubmitted !== "Yes"}
                                          >
                                            <option value="">Select…</option>
                                            {ATTENDANCE_APPLICATION_REASONS.map((reason) => (
                                              <option key={reason} value={reason}>
                                                {reason}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-[0.7rem] font-semibold text-slate-600">
                                        Follow-up Note
                                      </label>
                                      <textarea
                                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
                                        rows={2}
                                        value={detail.note || ""}
                                        onChange={(event) =>
                                          updatePtAttendanceDetail(rowIndex, student, { note: event.target.value })
                                        }
                                        disabled={disableEditing}
                                        placeholder="Add reminder or acknowledgement for the CT."
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[0.65rem] text-slate-500">
          Attendance tips: list absent names separated by commas. Present/Absent counts auto-update when you toggle students.
        </p>
      </div>
      );
    };

    const sectionEditor =
      sectionKey === "cddRows" ? renderCddEditor() : sectionKey === "ccdRows" ? renderCcdEditor() : renderAttendanceEditor();

    return (
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClosePtEditModal}
      >
        <motion.div
          className="relative w-full max-w-6xl rounded-3xl bg-white p-6 shadow-2xl md:p-8"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            onClick={handleClosePtEditModal}
            disabled={isSavingReport}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="space-y-2 pr-6">
            <h3 className="text-lg font-semibold text-slate-900">{sectionLabel}</h3>
            <p className="text-xs text-slate-500">
              Update the captured data before confirming your PT report. Changes are saved when you hit “Save Draft” or “Confirm &amp; Submit”.
            </p>
            {!canEditPtReport && (
              <p className="text-xs text-amber-600">
                This report is already verified/waived. Contact coordination if updates are required.
              </p>
            )}
          </div>
          <div className="mt-4 max-h-[65vh] overflow-y-auto pr-2">{sectionEditor}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleClosePtEditModal}
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

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
                {pendingPtReportCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
                    {pendingPtReportCount} pending
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
              ) : ptDailyReports.length === 0 ? (
                <p className="text-sm text-gray-600">No PT daily reports assigned to you right now.</p>
              ) : (
                <div className="space-y-3">
                  {ptDailyReports.map((report) => {
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

          {/* Subject Reports Card */}
          <motion.div
            className="lg:col-span-3 h-full bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-5 border border-purple-100/60"
            whileHover={{ scale: 1.005 }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                  <h4 className="text-base font-bold text-gray-800">Subject Teaching MRI Reports</h4>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Review periods tagged to you in the Class Curriculum Diaries across all classes you taught today.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tag>Subject Report</Tag>
                {pendingSubjectReportCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
                    {pendingSubjectReportCount} pending
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4">
              {isReportsLoading ? (
                <p className="text-sm text-gray-600">Gathering today&apos;s subject reports…</p>
              ) : reportsError ? (
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle size={16} /> {reportsError.message || "Failed to load subject reports."}
                </p>
              ) : subjectReports.length === 0 ? (
                <p className="text-sm text-gray-600">No subject teaching reports assigned to you right now.</p>
              ) : (
                <div className="space-y-3">
                  {subjectReports.map((report) => {
                    const status = String(report?.status || "pending").toLowerCase();
                    const badgeClass = REPORT_STATUS_STYLES[status] || REPORT_STATUS_STYLES.default;
                    const payload =
                      report?.payload && typeof report.payload === "string"
                        ? (() => {
                            try {
                              return JSON.parse(report.payload);
                            } catch {
                              return null;
                            }
                          })()
                        : (report?.payload && typeof report.payload === "object" ? report.payload : null);
                    const lessons = Array.isArray(payload?.lessons) ? payload.lessons : [];
                    const summaryClasses = Array.isArray(payload?.summary?.classes) ? payload.summary.classes : [];
                    const classLabels = summaryClasses
                      .map((entry) => entry?.classLabel)
                      .filter((label) => typeof label === "string" && label.trim().length > 0);
                    const summaryText =
                      lessons.length > 0
                        ? `${lessons.length} period${lessons.length > 1 ? "s" : ""} captured${
                            classLabels.length ? ` • ${classLabels.join(", ")}` : ""
                          }`
                        : "Awaiting CCD entries tagged to you.";
                    return (
                      <div
                        key={report?.instanceId || report?.assignmentId}
                        className="rounded-xl border border-purple-100 bg-purple-50/70 p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-purple-800">
                              {report?.templateName || "Subject Teaching Report"}
                            </p>
                            <p className="text-xs text-purple-700/80">{summaryText}</p>
                            {report?.confirmationNote ? (
                              <p className="mt-2 text-[0.7rem] text-purple-700/80">
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
                            className="rounded-md bg-purple-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-purple-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => openReportModal(report)}
                            disabled={!report?.instanceId}
                          >
                            Review &amp; Confirm
                          </button>
                          <span className="text-[0.65rem] text-purple-700/70">
                            {lessons.length > 0 ? "Data captured from CCD" : "No CCD data yet"}
                          </span>
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
                          {workingCddRows.length
                            ? `${workingCddRows.length} entr${workingCddRows.length > 1 ? "ies" : "y"}`
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
                          {workingCcdRows.length
                            ? `${workingCcdRows.length} entr${workingCcdRows.length > 1 ? "ies" : "y"}`
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
                          {workingAttendanceRows.length
                            ? `${workingAttendanceRows.length} entr${workingAttendanceRows.length > 1 ? "ies" : "y"}`
                            : "No entries yet"}
                        </span>
                      </button>
                    </div>

                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-slate-700 shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p className="leading-relaxed">
                          Review the assistant&apos;s entries and edit anything that changed during the day. Updates are saved when you keep the modal open and choose Save Draft or Confirm.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {["cdd", "ccd", "attendance"].map((section) => (
                            <button
                              key={`pt-edit-open-${section}`}
                              type="button"
                              className={`rounded-md px-3 py-1 text-[0.7rem] font-semibold transition ${
                                ptActiveSection === section
                                  ? "bg-indigo-600 text-white shadow"
                                  : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                              onClick={() => handleOpenPtEditModal(section)}
                              disabled={!canEditPtReport || isSavingReport}
                            >
                              {section === "cdd"
                                ? "Edit CDD Entries"
                                : section === "ccd"
                                ? "Edit CCD Entries"
                                : "Edit Attendance"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {!canEditPtReport && (
                        <p className="mt-2 text-[0.65rem] text-amber-600">
                          This report is locked for edits because it has been verified or waived.
                        </p>
                      )}
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
                    {ptActiveSection === "ccd" && renderConfirmationNoteSection("inline")}
                  </div>
                ) : isSubjectReport ? (
                  <div className="flex h-full flex-col gap-4">
                    {(subjectEditablePayload?.teacher?.name || activeReportPayload?.teacher?.name) && (
                      <p className="text-xs text-slate-500">
                        Tagged teacher: {subjectEditablePayload?.teacher?.name || activeReportPayload?.teacher?.name}
                      </p>
                    )}
                    {renderSubjectSummarySection()}
                    <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                      {canEditSubjectReport ? renderSubjectLessonsEditor() : renderSubjectLessonsTable()}
                    </div>
                    {renderAdditionalDetails()}
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

              {(!isPtReport || ptActiveSection !== "ccd") && renderConfirmationNoteSection("footer")}

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

      <AnimatePresence>{renderPtEditModal()}</AnimatePresence>

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
