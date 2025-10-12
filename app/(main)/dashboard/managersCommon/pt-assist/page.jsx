"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { formatISTDate, formatISTDateTime } from "@/lib/timezone";

const todayIso = () => formatISTDate(new Date());

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const splitMultiValue = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const joinMultiValue = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

const looksLikeDateString = (str) => /-|\//.test(str) || /\d{2}:\d{2}/.test(str) || str.length > 10;

const formatPreviewValue = (value) => {
  if (Array.isArray(value)) return joinMultiValue(value) || "—";
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (value instanceof Date) {
    return formatISTDateTime(value);
  }

  const str = String(value).trim();
  if (!str) return "—";

  if (looksLikeDateString(str)) {
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      const hasTime = /[T\s]\d/.test(str);
      return hasTime ? formatISTDateTime(parsed) : formatISTDate(parsed);
    }
  }

  return str;
};

const YES_NO_OPTIONS = ["", "Yes", "No"];
const ATTENDANCE_APPLICATION_REASONS = ["Sickness", "Family Event", "Out of Station", "Other"];
const DEFAULT_APPLICATION_FOLLOWUP = "Please collect application tomorrow.";

const FALLBACK_CDD_SECTION = {
  key: "cddRows",
  title: "Class Discipline Diary",
  repeat: true,
  fields: [
    { id: "date", type: "date", label: "Date" },
    { id: "assemblyUniformDefaulters", type: "chips", label: "Assembly/Uniform Defaulters" },
    { id: "languageDefaulters", type: "chips", label: "Language Defaulters" },
    { id: "homeworkDefaulters", type: "chips", label: "Homework Defaulters" },
    { id: "disciplineDefaulters", type: "chips", label: "Discipline Defaulters" },
    { id: "bestStudentOfDay", type: "chips", label: "Best Student(s) of the Day" },
    { id: "absentStudents", type: "chips", label: "Absent Students" },
    { id: "teacherSigned", type: "select", label: "CT Sign", options: YES_NO_OPTIONS.slice(1) },
    { id: "principalStamp", type: "select", label: "Principal Stamp", options: YES_NO_OPTIONS.slice(1) },
  ],
};

const FALLBACK_CCD_SECTION = {
  key: "ccdRows",
  title: "Class Curriculum Diary",
  repeat: true,
  fields: [
    { id: "period", type: "text", label: "Period" },
    { id: "subject", type: "text", label: "Subject" },
    { id: "topic", type: "text", label: "Topic" },
    { id: "teacherName", type: "select", label: "Teacher" },
    { id: "classwork", type: "textarea", label: "Classwork (What happened)" },
    { id: "homework", type: "textarea", label: "Homework (Assigned)" },
    { id: "teacherSignature", type: "select", label: "Teacher Sign", options: YES_NO_OPTIONS.slice(1) },
    { id: "monitorInitials", type: "select", label: "Monitor Initials", options: YES_NO_OPTIONS.slice(1) },
  ],
};

const FALLBACK_ATTENDANCE_SECTION = {
  key: "attendanceRows",
  title: "Attendance",
  repeat: true,
  fields: [
    { id: "session", type: "text", label: "Session" },
    { id: "absentStudents", type: "chips", label: "Absent Students" },
    { id: "presentCount", type: "text", label: "Present Count" },
    { id: "absentCount", type: "text", label: "Absent Count" },
    { id: "notes", type: "textarea", label: "Notes" },
  ],
};

const sectionDefaults = (section) => {
  const defaults = {};
  const fields = Array.isArray(section?.fields) ? section.fields : [];
  for (const field of fields) {
    const type = (field?.type || "text").toLowerCase();
    if (type === "chips") defaults[field.id] = [];
    else if (type === "boolean") defaults[field.id] = false;
    else defaults[field.id] = "";
  }
  return defaults;
};

const PERIOD_LABELS = ["1", "2", "3", "4", "5", "6", "7"];

const normalizeYesNoValue = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  const str = String(value || "").trim().toLowerCase();
  if (str === "yes" || str === "y" || str === "1") return "Yes";
  if (str === "no" || str === "n" || str === "0") return "No";
  return "";
};

const buildDefaultCddRows = (section, selectedDate) => {
  if (!section) return [];
  const defaults = sectionDefaults(section);
  const firstRow = { ...defaults };
  if (Object.prototype.hasOwnProperty.call(firstRow, "date")) {
    firstRow.date = selectedDate || todayIso();
  }
  return [firstRow];
};

const buildDefaultCcdRows = (section, defaultTeacher = "") => {
  if (!section) return [];
  const defaults = sectionDefaults(section);
  return PERIOD_LABELS.map((label) => ({
    ...defaults,
    period: label,
    teacherName: defaultTeacher || defaults.teacherName || "",
  }));
};

const buildDefaultAttendanceRows = (section) => {
  if (!section) return [];
  const defaults = sectionDefaults(section);
  return [
    {
      ...defaults,
      session: "Morning",
      absentStudents: [],
      absentCount: "0",
      presentCount: defaults.presentCount || "0",
      absenceDetails: {},
      notes: "",
    },
  ];
};

const summarizeAttendanceAbsent = (row) => {
  const list = Array.isArray(row?.absentStudents) ? row.absentStudents : [];
  if (!list.length) return "All present";
  const details = row?.absenceDetails || {};
  return list
    .map((student) => {
      const detail = details[student] || {};
      const status = detail.applicationSubmitted || "No";
      if (status === "Yes") {
        const reason = detail.reason ? ` - ${detail.reason}` : "";
        return `${student} (Yes${reason})`;
      }
      return `${student} (No - follow up)`;
    })
    .join(", ");
};

export default function PtAssistPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [payloadState, setPayloadState] = useState({
    cddRows: [],
    ccdRows: [],
    attendanceRows: [],
    extras: {},
  });
  const [saveStatus, setSaveStatus] = useState({ message: "", error: "" });
  const [savingAction, setSavingAction] = useState(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/managersCommon/pt-assist?date=${selectedDate}`,
    fetcher,
    { dedupingInterval: 15000 }
  );

  const template = data?.template || null;
  const assignments = data?.assignments || [];
  const viewerId = data?.viewerId == null ? null : Number(data.viewerId);

  const templateSections = useMemo(() => {
    if (!template?.formSchema?.sections) return [];
    const sections = Array.isArray(template.formSchema.sections) ? template.formSchema.sections : [];
    return sections.map((section) => ({
      ...section,
      fields: Array.isArray(section?.fields) ? section.fields : [],
    }));
  }, [template]);

  const cddSection = useMemo(
    () => templateSections.find((section) => section?.key === "cddRows" || section?.title === "Class Discipline Diary") || null,
    [templateSections]
  );

  const ccdSection = useMemo(
    () => templateSections.find((section) => section?.key === "ccdRows" || section?.title === "Class Curriculum Diary") || null,
    [templateSections]
  );
  const attendanceSection = useMemo(
    () => templateSections.find((section) => section?.key === "attendanceRows" || section?.title === "Attendance") || null,
    [templateSections]
  );
  const resolvedCddSection = cddSection || FALLBACK_CDD_SECTION;
  const resolvedCcdSection = ccdSection || FALLBACK_CCD_SECTION;
  const resolvedAttendanceSection = attendanceSection || FALLBACK_ATTENDANCE_SECTION;

  useEffect(() => {
    if (!assignments.length) {
      if (selectedAssignmentId !== null) setSelectedAssignmentId(null);
      setAccessMessage("");
      return;
    }
    const exists = assignments.some((assignment) => assignment.id === selectedAssignmentId);
    if (!exists) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  const selectedAssignment = useMemo(() => {
    const found = assignments.find((assignment) => assignment.id === selectedAssignmentId) || null;
    if (found) return found;
    if (!assignments.length) return null;
    return assignments[0];
  }, [assignments, selectedAssignmentId]);

  const classIdForStudents = useMemo(() => {
    if (!selectedAssignment) return null;
    const fromAssignment = selectedAssignment.classId;
    if (typeof fromAssignment === "number" && Number.isFinite(fromAssignment) && fromAssignment > 0) {
      return fromAssignment;
    }
    const metaClassId = selectedAssignment?.scopeMeta?.class?.id;
    if (typeof metaClassId === "number" && Number.isFinite(metaClassId) && metaClassId > 0) {
      return metaClassId;
    }
    const parsed = Number(metaClassId || fromAssignment);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [selectedAssignment]);

  const {
    data: classStudentsResponse,
    error: classStudentsError,
  } = useSWR(
    classIdForStudents ? `/api/member/mris/students?status=active&classId=${classIdForStudents}` : null,
    fetcher,
    { dedupingInterval: 60000 }
  );

  const {
    data: teacherDirectoryResponse,
    error: teacherDirectoryError,
  } = useSWR("/api/member/mris/teachers?onlyTeachers=true", fetcher, { dedupingInterval: 60000 });

  const classStudents = useMemo(() => {
    if (!classIdForStudents) return [];
    const rows = Array.isArray(classStudentsResponse?.students) ? classStudentsResponse.students : [];
    return rows
      .map((row) => ({ id: row.id, name: row.name || `Student #${row.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classStudentsResponse, classIdForStudents]);

  const isLoadingClassStudents = Boolean(classIdForStudents) && !classStudentsResponse && !classStudentsError;
  const totalStudents = classStudents.length;
  const teacherOptions = useMemo(() => {
    const rows = Array.isArray(teacherDirectoryResponse?.teachers) ? teacherDirectoryResponse.teachers : [];
    const mapped = rows.map((row) => ({ id: row.id, name: row.name || `Member #${row.id}` }));
    const extras = [];
    if (selectedAssignment?.teacherName) {
      const exists = mapped.some((teacher) => teacher.name === selectedAssignment.teacherName);
      if (!exists) {
        extras.push({ id: `assignment-${selectedAssignment.teacherName}`, name: selectedAssignment.teacherName });
      }
    }
    return [...mapped, ...extras].sort((a, b) => a.name.localeCompare(b.name));
  }, [teacherDirectoryResponse, selectedAssignment?.teacherName]);
  const isLoadingTeachers = !teacherDirectoryResponse && !teacherDirectoryError;

  const viewerIsAssistant = useMemo(() => {
    if (!selectedAssignment) return false;
    const assistantId = Number(selectedAssignment.assistantUserId || 0);
    return viewerId !== null && assistantId === viewerId;
  }, [selectedAssignment, viewerId]);
  const canEdit = viewerIsAssistant;

  useEffect(() => {
    if (!selectedAssignment) {
      setPayloadState({ cddRows: [], ccdRows: [], attendanceRows: [], extras: {} });
      setActiveModal(null);
      setAccessMessage("");
      return;
    }
    const payload = selectedAssignment.payload || {};
    const {
      cddRows: storedCddRows = [],
      ccdRows: storedCcdRows = [],
      attendanceRows: storedAttendanceRows = [],
      ...extras
    } = payload;

    const normalizedCddRows = (Array.isArray(storedCddRows) && storedCddRows.length > 0
      ? storedCddRows
      : buildDefaultCddRows(resolvedCddSection, selectedDate)
    ).map((row) => ({
      ...row,
      date: row?.date ? row.date : selectedDate || todayIso(),
    }));

    const normalizedCcdRows = (Array.isArray(storedCcdRows) && storedCcdRows.length > 0
      ? storedCcdRows
      : buildDefaultCcdRows(resolvedCcdSection, selectedAssignment?.teacherName || "")
    ).map((row) => ({
      ...row,
      teacherName: row?.teacherName || selectedAssignment?.teacherName || "",
    }));

    const normalizedAttendanceRows = (Array.isArray(storedAttendanceRows) && storedAttendanceRows.length > 0
      ? storedAttendanceRows
      : buildDefaultAttendanceRows(resolvedAttendanceSection)
    ).map((row, index) => ({
      ...row,
      session: row?.session || `Session ${index + 1}`,
    }));

    setPayloadState({
      cddRows: normalizedCddRows,
      ccdRows: normalizedCcdRows,
      attendanceRows: normalizedAttendanceRows,
      extras,
    });
      setActiveModal(null);
      setAccessMessage("");
      setSaveStatus({ message: "", error: "" });
  }, [selectedAssignment, resolvedCddSection, resolvedCcdSection, resolvedAttendanceSection, selectedDate]);

  useEffect(() => {
    if (!totalStudents) return;
    setPayloadState((prev) => {
      const rows = Array.isArray(prev.attendanceRows) ? prev.attendanceRows : [];
      let changed = false;
      const nextRows = rows.map((row) => {
        const absentList = Array.isArray(row.absentStudents) ? row.absentStudents : [];
        const absentCount = String(absentList.length);
        const presentCount = String(Math.max(totalStudents - absentList.length, 0));
        if (row.absentCount === absentCount && row.presentCount === presentCount) return row;
        changed = true;
        return { ...row, absentCount, presentCount };
      });
      if (!changed) return prev;
      return { ...prev, attendanceRows: nextRows };
    });
  }, [totalStudents]);

  const updateRow = (sectionKey, index, updater) => {
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      const current = { ...rows[index] };
      const updated = { ...current, ...updater(current) };
      rows[index] = updated;
      return { ...prev, [sectionKey]: rows };
    });
  };

  const addRow = (sectionKey, section) => {
    const defaults = sectionDefaults(section);
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      const nextRow = { ...defaults };
      if (sectionKey === "ccdRows") {
        const numericPeriods = rows
          .map((row) => {
            const raw = row?.period;
            const parsed = Number.parseInt(raw, 10);
            return Number.isFinite(parsed) ? parsed : null;
          })
          .filter((value) => value !== null);
        const nextPeriod = (numericPeriods.length ? Math.max(...numericPeriods) + 1 : rows.length + 1);
        nextRow.period = String(nextPeriod);
        const previousTeacher = rows.length ? rows[rows.length - 1]?.teacherName : selectedAssignment?.teacherName;
        nextRow.teacherName = previousTeacher || "";
      } else if (sectionKey === "attendanceRows") {
        nextRow.session = nextRow.session || `Session ${rows.length + 1}`;
        const absentList = Array.isArray(nextRow.absentStudents) ? nextRow.absentStudents : [];
        const absentCount = absentList.length;
        const presentCount = Math.max(totalStudents - absentCount, 0);
        nextRow.absentStudents = absentList;
        nextRow.absentCount = String(absentCount);
        nextRow.presentCount = String(presentCount < 0 ? 0 : presentCount);
      }
      rows.push(nextRow);
      return { ...prev, [sectionKey]: rows };
    });
  };

  const removeRow = (sectionKey, index) => {
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      rows.splice(index, 1);
      return { ...prev, [sectionKey]: rows };
    });
  };

  const toggleChipValue = (sectionKey, rowIndex, fieldId, value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      const currentRow = { ...(rows[rowIndex] || {}) };
      const currentValues = Array.isArray(currentRow[fieldId]) ? [...currentRow[fieldId]] : [];
      const existingIndex = currentValues.findIndex((entry) => entry.trim() === normalized);
      if (existingIndex >= 0) {
        currentValues.splice(existingIndex, 1);
      } else {
        currentValues.push(normalized);
      }
      currentRow[fieldId] = currentValues;
      rows[rowIndex] = currentRow;
      return { ...prev, [sectionKey]: rows };
    });
  };

  const updateAttendanceDetail = (rowIndex, studentName, patch) => {
    setPayloadState((prev) => {
      const rows = Array.isArray(prev.attendanceRows) ? [...prev.attendanceRows] : [];
      const current = { ...(rows[rowIndex] || {}) };
      const details = { ...(current.absenceDetails || {}) };
      const normalized = String(studentName || "").trim();
      if (!normalized) return prev;
      const existing = {
        applicationSubmitted: "No",
        reason: "",
        note: DEFAULT_APPLICATION_FOLLOWUP,
        ...(details[normalized] || {}),
      };
      const updated = { ...existing, ...patch };
      if (updated.applicationSubmitted === "No") {
        updated.reason = "";
        updated.note = DEFAULT_APPLICATION_FOLLOWUP;
      } else if (existing.applicationSubmitted === "No" && updated.applicationSubmitted === "Yes") {
        if (!patch.note || patch.note === DEFAULT_APPLICATION_FOLLOWUP) {
          updated.note = "";
        }
      }
      details[normalized] = updated;

      const absentList = Array.isArray(current.absentStudents) ? current.absentStudents : [];
      const absentCount = absentList.length;
      const presentCount = Math.max(totalStudents - absentCount, 0);

      current.absenceDetails = details;
      current.absentCount = String(absentCount);
      current.presentCount = String(presentCount < 0 ? 0 : presentCount);
      rows[rowIndex] = current;
      return { ...prev, attendanceRows: rows };
    });
  };

const toggleAttendanceStudent = (rowIndex, label) => {
  const normalized = String(label || "").trim();
  if (!normalized) return;
  setPayloadState((prev) => {
    const rows = Array.isArray(prev.attendanceRows) ? [...prev.attendanceRows] : [];
    const current = { ...(rows[rowIndex] || {}) };
    const list = Array.isArray(current.absentStudents) ? [...current.absentStudents] : [];
    const details = { ...(current.absenceDetails || {}) };
    const idx = list.findIndex((name) => name === normalized);
    if (idx >= 0) {
      list.splice(idx, 1);
      delete details[normalized];
    } else {
      list.push(normalized);
      if (!details[normalized]) {
        details[normalized] = {
          applicationSubmitted: "No",
          reason: "",
          note: DEFAULT_APPLICATION_FOLLOWUP,
        };
      }
    }
    const absentCount = list.length;
    const presentCount = Math.max(totalStudents - absentCount, 0);
    current.absentStudents = list;
    current.absentCount = String(absentCount);
    current.presentCount = String(presentCount < 0 ? 0 : presentCount);
    current.absenceDetails = details;
    rows[rowIndex] = current;
    return { ...prev, attendanceRows: rows };
  });
};

  const normalizePayloadForSave = (state) => {
    const next = { ...state.extras };
    next.cddRows = (state.cddRows || []).map((row) => {
      const output = {};
      Object.entries(row || {}).forEach(([fieldId, value]) => {
        if (Array.isArray(value)) output[fieldId] = value;
        else if (typeof value === "boolean") output[fieldId] = value;
        else if (value === "" || value === null) output[fieldId] = "";
        else output[fieldId] = value;
      });
      return output;
    });
    next.ccdRows = (state.ccdRows || []).map((row) => {
      const output = {};
      Object.entries(row || {}).forEach(([fieldId, value]) => {
        if (Array.isArray(value)) output[fieldId] = value;
        else if (typeof value === "boolean") output[fieldId] = value;
        else if (value === "" || value === null) output[fieldId] = "";
        else output[fieldId] = value;
      });
      return output;
    });
    next.attendanceRows = (state.attendanceRows || []).map((row) => {
      const output = {};
      Object.entries(row || {}).forEach(([fieldId, value]) => {
        if (Array.isArray(value)) output[fieldId] = value;
        else if (typeof value === "boolean") output[fieldId] = value;
        else if (value === "" || value === null) output[fieldId] = "";
        else output[fieldId] = value;
      });
      return output;
    });
    return next;
  };

  const handleOpenDiary = (diaryKey) => {
    if (!selectedAssignment) return;
    const assistantId = Number(selectedAssignment.assistantUserId || 0);
    if (!assistantId) {
      setAccessMessage("No assistant has been assigned for this class yet.");
      return;
    }
    if (viewerId === null) {
      setAccessMessage("Unable to verify your assistant role.");
      return;
    }
    if (assistantId !== viewerId) {
      setAccessMessage("You are not the assistant for this class.");
      return;
    }
    setAccessMessage("");
    setActiveModal(diaryKey);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setAccessMessage("");
  };

  const handleSave = async (action = "draft") => {
    if (!selectedAssignment) return;
    setSavingAction(action);
    setSaveStatus({ message: "", error: "" });
    try {
      const payload = normalizePayloadForSave(payloadState);
      const res = await fetch("/api/managersCommon/pt-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          date: selectedDate,
          payload,
          action,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
      setSaveStatus({ message: action === "submit" ? "Submitted to class teacher." : "Saved draft.", error: "" });
      await mutate();
    } catch (err) {
      setSaveStatus({ message: "", error: err.message || "Failed to save report data." });
    } finally {
      setSavingAction(null);
    }
  };

  const renderCcdSection = (sectionData, rows) => {
    const headers = [
      { id: "period", label: "Period", type: "text", placeholder: "1" },
      { id: "subject", label: "Subject", type: "text", placeholder: "Math" },
      { id: "topic", label: "Topic", type: "text", placeholder: "Ch-4" },
      { id: "teacherName", label: "Teacher", type: "teacherSelect" },
      { id: "classwork", label: "C.W. (what happened)", type: "textarea", placeholder: "Test taken" },
      { id: "homework", label: "H.W. (assigned)", type: "textarea", placeholder: "Memorise Ques/Ans" },
      { id: "teacherSignature", label: "T.S.", type: "select", options: YES_NO_OPTIONS },
      { id: "monitorInitials", label: "Monitor Initials", type: "select", options: YES_NO_OPTIONS },
    ];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Class Curriculum Diary (CCD)</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="light" type="button" onClick={() => addRow("ccdRows", sectionData)}>
              Add Period
            </Button>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setPayloadState((prev) => ({
                    ...prev,
                    ccdRows: [],
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {teacherDirectoryError && (
          <p className="text-[0.65rem] text-red-600">
            Failed to load teacher directory. You can still type the teacher name manually.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-xs text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((header) => (
                  <th key={header.id} className="border border-gray-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="px-3 py-4 text-center text-sm text-gray-500">
                    No periods recorded yet. Use "Add Period" to start capturing the day.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={`ccd-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                    {headers.map((header) => {
                      const fieldId = header.id;
                      const fieldType = header.type || "text";
                      const rawValue = row?.[fieldId];
                      const normalizedValue =
                        typeof rawValue === "boolean" ? (rawValue ? "Yes" : "No") : rawValue ?? "";

                      if (fieldType === "teacherSelect") {
                        const currentTeacher = String(rawValue || "");
                        const optionPool = teacherOptions.some((teacher) => teacher.name === currentTeacher)
                          ? teacherOptions
                          : currentTeacher
                          ? [...teacherOptions, { id: `current-${rowIndex}`, name: currentTeacher }]
                          : teacherOptions;
                        if (!isLoadingTeachers && !optionPool.length) {
                          return (
                            <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                              <input
                                type="text"
                                className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Type teacher name"
                                value={currentTeacher}
                                onChange={(event) =>
                                  updateRow("ccdRows", rowIndex, () => ({
                                    [fieldId]: event.target.value,
                                  }))
                                }
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                            <select
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed"
                              value={String(rawValue || "")}
                              onChange={(event) =>
                                updateRow("ccdRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                              disabled={isLoadingTeachers}
                            >
                              <option value="">{isLoadingTeachers ? "Loading teachers…" : "Select teacher"}</option>
                              {optionPool.map((teacher) => (
                                <option key={`${fieldId}-${teacher.id}`} value={teacher.name}>
                                  {teacher.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      if (fieldType === "select" || fieldId === "teacherSignature" || fieldId === "monitorInitials") {
                        const selectOptions = Array.isArray(header.options) && header.options.length
                          ? ["", ...header.options]
                          : YES_NO_OPTIONS;
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2">
                            <select
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              value={normalizeYesNoValue(normalizedValue)}
                              onChange={(event) =>
                                updateRow("ccdRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                            >
                              {selectOptions.map((option) => (
                                <option key={`${fieldId}-${option || "unset"}`} value={option}>
                                  {option === "" ? "Select…" : option}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      if (fieldType === "textarea") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                            <textarea
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              rows={fieldId === "teacherSignature" ? 2 : 3}
                              placeholder={header.placeholder || ""}
                              value={String(normalizedValue || "")}
                              onChange={(event) =>
                                updateRow("ccdRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        );
                      }

                      if (fieldType === "boolean") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={Boolean(rawValue)}
                              onChange={(event) =>
                                updateRow("ccdRows", rowIndex, () => ({
                                  [fieldId]: event.target.checked,
                                }))
                              }
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={fieldId} className="border border-gray-200 px-2 py-2">
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder={header.placeholder || ""}
                            value={String(normalizedValue || "")}
                            onChange={(event) =>
                              updateRow("ccdRows", rowIndex, () => ({
                                [fieldId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="border border-gray-200 px-2 py-2 text-center align-middle">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeRow("ccdRows", rowIndex)}
                      >
                        Remove
                      </Button>
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

  const renderAttendanceSection = (sectionData, rows) => {
    const headers = [
      { id: "session", label: "Session", type: "text", placeholder: "Morning" },
      { id: "absentStudents", label: "Absent Students", type: "chips" },
      { id: "presentCount", label: "Present Count", type: "readonly" },
      { id: "absentCount", label: "Absent Count", type: "readonly" },
      { id: "notes", label: "Notes", type: "textarea" },
    ];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Attendance Snapshot</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="light" type="button" onClick={() => addRow("attendanceRows", sectionData)}>
              Add Session
            </Button>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setPayloadState((prev) => ({
                    ...prev,
                    attendanceRows: [],
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {totalStudents > 0 && (
          <p className="text-[0.65rem] text-gray-500">Class roster size: {totalStudents} student{totalStudents > 1 ? "s" : ""}</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-xs text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((header) => (
                  <th key={header.id} className="border border-gray-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="px-3 py-4 text-center text-sm text-gray-500">
                    No attendance captured yet. Use "Add Session" to record attendance details.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const selectedValues = Array.isArray(row.absentStudents) ? row.absentStudents : [];
                  const details = row.absenceDetails || {};
                  return (
                    <Fragment key={`attendance-${rowIndex}`}>
                      <tr className="odd:bg-white even:bg-gray-50">
                        {headers.map((header) => {
                          const fieldId = header.id;
                          const type = header.type || "text";
                          const value = row?.[fieldId];

                          if (type === "textarea") {
                            return (
                              <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                                <textarea
                                  className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  rows={3}
                                  value={String(value || "")}
                                  onChange={(event) =>
                                    updateRow("attendanceRows", rowIndex, () => ({
                                      [fieldId]: event.target.value,
                                    }))
                                  }
                                />
                              </td>
                            );
                          }

                          if (type === "readonly") {
                            return (
                              <td key={fieldId} className="border border-gray-200 px-2 py-2">
                                <input
                                  type="text"
                                  readOnly
                                  className="w-full rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-700"
                                  value={String(value || "0")}
                                />
                              </td>
                            );
                          }

                          if (type === "chips") {
                            return (
                              <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                                <textarea
                                  className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  rows={2}
                                  placeholder={header.placeholder || "Tap names below or type manually"}
                                  value={joinMultiValue(selectedValues)}
                                  onChange={(event) => {
                                    const values = splitMultiValue(event.target.value);
                                    updateRow("attendanceRows", rowIndex, () => {
                                      const absentCount = values.length;
                                      const presentCount = Math.max(totalStudents - absentCount, 0);
                                      const nextDetails = values.reduce((acc, name) => {
                                        const normalized = String(name || "").trim();
                                        if (!normalized) return acc;
                                        acc[normalized] = details[normalized] || {
                                          applicationSubmitted: "No",
                                          reason: "",
                                          note: DEFAULT_APPLICATION_FOLLOWUP,
                                        };
                                        return acc;
                                      }, {});
                                      return {
                                        [fieldId]: values,
                                        absentCount: String(absentCount),
                                        presentCount: String(presentCount),
                                        absenceDetails: nextDetails,
                                      };
                                    });
                                  }}
                                />
                                {classIdForStudents && (
                                  <div className="mt-2 space-y-1">
                                    {isLoadingClassStudents && (
                                      <p className="text-[0.65rem] text-gray-500">Loading class roster…</p>
                                    )}
                                    {!isLoadingClassStudents && classStudents.length > 0 && (
                                      <>
                                        <p className="text-[0.65rem] text-gray-500">Tap to toggle absent students:</p>
                                        <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white/80 p-2">
                                          <div className="flex flex-wrap gap-1">
                                            {classStudents.map((student) => {
                                              const label = student.name;
                                              const isSelected = selectedValues.some((entry) => entry.trim() === label);
                                              return (
                                                <button
                                                  type="button"
                                                  key={`${fieldId}-${student.id}`}
                                                  className={`rounded-full px-2 py-1 text-[0.65rem] transition ${
                                                    isSelected
                                                      ? "bg-rose-600 text-white hover:bg-rose-700"
                                                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                                  }`}
                                                  onClick={() => toggleAttendanceStudent(rowIndex, label)}
                                                  title={label}
                                                >
                                                  {label}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {!isLoadingClassStudents && classStudents.length === 0 && (
                                      <p className="text-[0.65rem] text-amber-600">No students found for this class.</p>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          }

                          return (
                            <td key={fieldId} className="border border-gray-200 px-2 py-2">
                              <input
                                type="text"
                                className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder={header.placeholder || ""}
                                value={String(value || "")}
                                onChange={(event) =>
                                  updateRow("attendanceRows", rowIndex, () => ({
                                    [fieldId]: event.target.value,
                                  }))
                                }
                              />
                            </td>
                          );
                        })}
                        <td className="border border-gray-200 px-2 py-2 text-center align-middle">
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => removeRow("attendanceRows", rowIndex)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                      {selectedValues.length > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={headers.length + 1} className="border border-gray-200 px-4 py-3">
                            <div className="space-y-3">
                              {selectedValues.map((studentName) => {
                                const detail = details[studentName] || {
                                  applicationSubmitted: "No",
                                  reason: "",
                                  note: DEFAULT_APPLICATION_FOLLOWUP,
                                };
                                return (
                                  <div
                                    key={`${rowIndex}-${studentName}`}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
                                  >
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div className="font-semibold text-gray-800">{studentName}</div>
                                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                                        <label className="flex items-center gap-2">
                                          <span className="text-[0.75rem] text-gray-600">Application Submitted?</span>
                                          <select
                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            value={detail.applicationSubmitted || "No"}
                                            onChange={(event) =>
                                              updateAttendanceDetail(rowIndex, studentName, {
                                                applicationSubmitted: event.target.value,
                                              })
                                            }
                                          >
                                            {YES_NO_OPTIONS.slice(1).map((option) => (
                                              <option key={option} value={option}>
                                                {option}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label className="flex items-center gap-2">
                                          <span className="text-[0.75rem] text-gray-600">Reason</span>
                                          <select
                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            value={detail.reason || ""}
                                            onChange={(event) =>
                                              updateAttendanceDetail(rowIndex, studentName, {
                                                reason: event.target.value,
                                              })
                                            }
                                            disabled={detail.applicationSubmitted !== "Yes"}
                                          >
                                            <option value="">Select reason</option>
                                            {ATTENDANCE_APPLICATION_REASONS.map((option) => (
                                              <option key={option} value={option}>
                                                {option}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <label className="text-[0.75rem] font-semibold text-gray-600">
                                        Follow-up Note
                                      </label>
                                      <textarea
                                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        rows={2}
                                        value={detail.note || ""}
                                        onChange={(event) =>
                                          updateAttendanceDetail(rowIndex, studentName, {
                                            note: event.target.value,
                                          })
                                        }
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
      </div>
    );
  };

  const renderCddSection = (sectionData, rows) => {
    const headers = [
      { id: "date", label: "Date", type: "date" },
      { id: "assemblyUniformDefaulters", label: "Assembly/Uniform Defaulters", type: "chips", placeholder: "Sajid, Zaki" },
      { id: "languageDefaulters", label: "Language Defaulters", type: "chips", placeholder: "None" },
      { id: "homeworkDefaulters", label: "Homework Defaulters", type: "chips", placeholder: "None" },
      { id: "disciplineDefaulters", label: "Discipline Defaulters", type: "chips", placeholder: "None" },
      { id: "bestStudentOfDay", label: "Best Student of the Day", type: "chips", placeholder: "Zaki; Ahmad" },
      { id: "absentStudents", label: "Absent Students", type: "chips", placeholder: "None" },
      { id: "teacherSigned", label: "CT Sign", type: "text", placeholder: "Yes (19/05/25)" },
      { id: "principalStamp", label: "Principal Stamp", type: "text", placeholder: "Yes (stamp, 19/05/25)" },
    ];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Class Discipline Diary (CDD)</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="light" type="button" onClick={() => addRow("cddRows", sectionData)}>
              Add Day
            </Button>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setPayloadState((prev) => ({
                    ...prev,
                    cddRows: [],
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-xs text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((header) => (
                  <th key={header.id} className="border border-gray-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="px-3 py-4 text-center text-sm text-gray-500">
                    No diary entries yet. Use "Add Day" to start recording CDD updates.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={`cdd-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                    {headers.map((header) => {
                      const fieldId = header.id;
                      const type = header.type;
                      const rawValue = row?.[fieldId];

                      if (fieldId === "teacherSigned" || fieldId === "principalStamp") {
                        const selectOptions = Array.isArray(header.options) && header.options.length
                          ? ["", ...header.options]
                          : YES_NO_OPTIONS;
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2">
                            <select
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              value={normalizeYesNoValue(rawValue)}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                            >
                              {selectOptions.map((option) => (
                                <option key={`${fieldId}-${option || "unset"}`} value={option}>
                                  {option === "" ? "Select…" : option}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      if (type === "chips") {
                        const selectedValues = Array.isArray(rawValue) ? rawValue : [];
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                            <textarea
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              rows={2}
                              placeholder={header.placeholder || "Select or type names (comma separated)"}
                              value={joinMultiValue(selectedValues)}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: splitMultiValue(event.target.value),
                                }))
                              }
                            />
                            {classIdForStudents && (
                              <div className="mt-2 space-y-1">
                                {isLoadingClassStudents && (
                                  <p className="text-[0.65rem] text-gray-500">Loading class roster…</p>
                                )}
                                {!isLoadingClassStudents && classStudents.length > 0 && (
                                  <>
                                    <p className="text-[0.65rem] text-gray-500">Tap to toggle students:</p>
                                    <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white/80 p-2">
                                      <div className="flex flex-wrap gap-1">
                                        {classStudents.map((student) => {
                                          const label = student.name;
                                          const isSelected = selectedValues.some(
                                            (entry) => entry.trim() === label
                                          );
                                          return (
                                            <button
                                              type="button"
                                              key={`${fieldId}-${student.id}`}
                                              className={`rounded-full px-2 py-1 text-[0.65rem] transition ${
                                                isSelected
                                                  ? "bg-teal-600 text-white hover:bg-teal-700"
                                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                              }`}
                                              onClick={() => toggleChipValue("cddRows", rowIndex, fieldId, label)}
                                              title={label}
                                            >
                                              {label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                )}
                                {!isLoadingClassStudents && classStudents.length === 0 && (
                                  <p className="text-[0.65rem] text-amber-600">
                                    No students found for this class.
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }

                      if (type === "date") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2">
                            <input
                              type="date"
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              value={rawValue || ""}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        );
                      }

                      if (type === "boolean") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={Boolean(rawValue)}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: event.target.checked,
                                }))
                              }
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={fieldId} className="border border-gray-200 px-2 py-2">
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder={header.placeholder || ""}
                            value={String(
                              typeof rawValue === "boolean" ? (rawValue ? "Yes" : "") : rawValue || ""
                            )}
                            onChange={(event) =>
                              updateRow("cddRows", rowIndex, () => ({
                                [fieldId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="border border-gray-200 px-2 py-2 text-center align-middle">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeRow("cddRows", rowIndex)}
                      >
                        Remove
                      </Button>
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

  const renderCddPreview = (rows) => {
    if (!rows || rows.length === 0) {
      return <p className="text-xs text-gray-500">No CDD entries captured yet.</p>;
    }
    return (
      <div className="mt-2 space-y-2">
        {rows.slice(0, 2).map((row, index) => {
          const dateLabel = (() => {
            const formatted = formatPreviewValue(row?.date);
            return formatted === "—" ? `Entry ${index + 1}` : formatted;
          })();
          return (
            <div
              key={`cdd-preview-${index}`}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
            >
              <p className="font-semibold text-gray-700">{dateLabel}</p>
              <p>
                <span className="font-semibold text-gray-700">Best Student:</span>{" "}
                {formatPreviewValue(row?.bestStudentOfDay)}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Assembly Defaulters:</span>{" "}
                {formatPreviewValue(row?.assemblyUniformDefaulters)}
              </p>
              <p>
                <span className="font-semibold text-gray-700">CT Sign:</span>{" "}
                {formatPreviewValue(row?.teacherSigned)}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Principal Stamp:</span>{" "}
                {formatPreviewValue(row?.principalStamp)}
              </p>
            </div>
          );
        })}
        {rows.length > 2 && (
          <p className="text-[0.65rem] text-gray-500">
            + {rows.length - 2} more entries recorded for the day.
          </p>
        )}
      </div>
    );
  };

  const renderCcdPreview = (rows) => {
    if (!rows || rows.length === 0) {
      return <p className="text-xs text-gray-500">No CCD entries captured yet.</p>;
    }
    return (
      <div className="mt-2 space-y-2">
        {rows.slice(0, 3).map((row, index) => (
          <div
            key={`ccd-preview-${index}`}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm"
          >
            <p className="font-semibold text-gray-700">
              Period {formatPreviewValue(row?.period)} • {formatPreviewValue(row?.subject)} —{" "}
              {formatPreviewValue(row?.topic)}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Classwork:</span>{" "}
              {formatPreviewValue(row?.classwork)}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Homework:</span>{" "}
              {formatPreviewValue(row?.homework)}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Teacher:</span>{" "}
              {formatPreviewValue(row?.teacherName)}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Teacher Sign / Notes:</span>{" "}
              {formatPreviewValue(row?.teacherSignature)}
            </p>
          </div>
        ))}
        {rows.length > 3 && (
          <p className="text-[0.65rem] text-gray-500">
            + {rows.length - 3} more periods captured for the day.
          </p>
        )}
      </div>
    );
  };

  const renderAttendancePreview = (rows) => {
    if (!rows || rows.length === 0) {
      return <p className="text-xs text-gray-500">No attendance snapshots captured yet.</p>;
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-xs text-gray-700">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Session</th>
              <th className="px-3 py-2 text-left font-semibold">Absent Students</th>
              <th className="px-3 py-2 text-left font-semibold">Present</th>
              <th className="px-3 py-2 text-left font-semibold">Absent</th>
              <th className="px-3 py-2 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`attendance-preview-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 font-medium text-gray-800">{row?.session || `Session ${index + 1}`}</td>
                <td className="px-3 py-2">{summarizeAttendanceAbsent(row)}</td>
                <td className="px-3 py-2">{row?.presentCount || "—"}</td>
                <td className="px-3 py-2">{row?.absentCount || "—"}</td>
                <td className="px-3 py-2">{row?.notes ? String(row.notes) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDiaryModal = () => {
    if (!activeModal) return null;
    const isCdd = activeModal === "cdd";
    const isCcd = activeModal === "ccd";
    const isAttendance = activeModal === "attendance";
    const sectionData = isCdd
      ? resolvedCddSection
      : isCcd
      ? resolvedCcdSection
      : resolvedAttendanceSection;
    const rows = isCdd
      ? payloadState.cddRows || []
      : isCcd
      ? payloadState.ccdRows || []
      : payloadState.attendanceRows || [];
    const title = isCdd
      ? "Class Discipline Diary (CDD)"
      : isCcd
      ? "Class Curriculum Diary (CCD)"
      : "Attendance Snapshot";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8">
        <div className="absolute inset-0" onClick={handleCloseModal} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
              aria-label="Close diary modal"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-6 space-y-6">
            {isCdd
              ? renderCddSection(sectionData, rows)
              : isCcd
              ? renderCcdSection(sectionData, rows)
              : renderAttendanceSection(sectionData, rows)}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
            <Button variant="ghost" onClick={handleCloseModal}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CCD / CDD Assistant</h1>
          <p className="text-sm text-gray-600">
            Capture Class Discipline Diary (CDD) and Class Curriculum Diary (CCD) entries for the PT assignments created in Manage Meedian → MRI Reports.
            The class teacher will review and confirm these entries during day close.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports/pt")}>
          Manage PT Assignments
        </Button>
      </div>

      {template && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-gray-900">{template.name || "PT Daily Report Template"}</h2>
              <p className="text-sm text-gray-600">
                Key: <span className="font-mono text-gray-700">{template.key}</span> • Frequency: {template.defaultFrequency || "daily"}
              </p>
              {template.instructions && (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{template.instructions}</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {templateSections.map((section) => (
                <div key={section?.key || section?.title} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {section?.title || section?.key || "Section"}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Entry type: {section?.repeat ? "Multiple rows" : "Single entry"}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-gray-600">
                    {(section?.fields || []).map((field) => (
                      <li key={field?.id} className="flex items-start gap-2">
                        <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
                        <span>
                          <span className="font-semibold text-gray-700">{field?.label || field?.id}</span>
                          <span className="text-gray-500"> — {String(field?.type || "text").toUpperCase()}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Working Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value || todayIso());
                setSaveStatus({ message: "", error: "" });
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Assigned Class / Teacher</label>
            <select
              value={selectedAssignmentId || ""}
              onChange={(event) => setSelectedAssignmentId(Number(event.target.value) || null)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {assignments.length === 0 && <option value="">No active assignments</option>}
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.className ? `Class ${assignment.className}${assignment.classSection ? ` ${assignment.classSection}` : ""}` : assignment.targetLabel || "Unlabelled"}{" "}
                  — {assignment.teacherName || "Teacher"}
                  {assignment.assistantUserId
                    ? ` • Assistant: ${viewerId !== null && assignment.assistantUserId === viewerId ? "You" : assignment.assistantName || `User #${assignment.assistantUserId}`}`
                    : " • Assistant: Unassigned"}
                </option>
              ))}
            </select>
          </div>
          {selectedAssignment && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <p>
                <span className="font-semibold text-gray-700">Assisting Class:</span>{" "}
                {selectedAssignment.className
                  ? `Class ${selectedAssignment.className}${
                      selectedAssignment.classSection ? ` ${selectedAssignment.classSection}` : ""
                    }`
                  : selectedAssignment.targetLabel || "Unlabelled"}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Class Teacher:</span>{" "}
                {selectedAssignment.teacherName || "—"}
                {selectedAssignment.teacherEmail ? ` (${selectedAssignment.teacherEmail})` : ""}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Assistant:</span>{" "}
                {selectedAssignment.assistantUserId
                  ? selectedAssignment.assistantUserId === viewerId
                    ? "You"
                    : selectedAssignment.assistantName || `User #${selectedAssignment.assistantUserId}`
                  : "—"}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Current Status:</span>{" "}
                <span className={selectedAssignment.status === "submitted" ? "text-emerald-600" : "text-slate-700"}>
                  {selectedAssignment.status}
                </span>
              </p>
              {selectedAssignment.confirmationNote && (
                <p className="mt-1 text-amber-700">
                  <span className="font-semibold text-amber-800">Teacher Note:</span>{" "}
                  {selectedAssignment.confirmationNote}
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {error && (
        <Card>
          <CardBody>
            <p className="text-sm text-red-600">Failed to load assignments. {error.message}</p>
          </CardBody>
        </Card>
      )}

      {!isLoading && !selectedAssignment && assignments.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">
              No PT assignments found for the selected date. Ensure class teachers and PT assistants are assigned in Manage Meedian → MRI Reports → PT Daily Report.
            </p>
          </CardBody>
        </Card>
      )}

      {selectedAssignment && (
        <Card>
          <CardBody className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-gray-900">PT Daily Diaries</h2>
              <p className="text-xs text-gray-600">
                Use the pop-up editors to capture or review today's Class Discipline Diary (CDD) and Class Curriculum Diary (CCD) before submitting to the class teacher.
              </p>
              {!canEdit && (
                <p className="text-xs text-amber-600">
                  Only the assigned assistant can make changes. You can still review the previews below.
                </p>
              )}
              {!selectedAssignment.assistantUserId && (
                <p className="text-xs text-amber-600">No PT assistant has been assigned to this class yet.</p>
              )}
              {classStudentsError && (
                <p className="text-xs text-red-600">Failed to load class roster. Please try refreshing.</p>
              )}
              {accessMessage && <p className="text-xs text-red-600">{accessMessage}</p>}
            </div>

            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Class Discipline Diary (CDD)</h3>
                  <p className="text-xs text-gray-500">
                    Track defaulters, best student of the day and signatures.
                  </p>
                </div>
                <Button variant="primary" onClick={() => handleOpenDiary("cdd")}>
                  Open CDD Form
                </Button>
              </div>
              {renderCddPreview(payloadState.cddRows || [])}
            </div>

            <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Class Curriculum Diary (CCD)</h3>
                  <p className="text-xs text-gray-500">
                    Record period-wise subject coverage and homework instructions.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => handleOpenDiary("ccd")}>
                  Open CCD Form
                </Button>
              </div>
              {renderCcdPreview(payloadState.ccdRows || [])}
            </div>

            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Attendance Snapshot</h3>
                  <p className="text-xs text-gray-500">
                    Log present/absent counts or quick notes for each attendance session.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => handleOpenDiary("attendance")}>
                  Open Attendance Form
                </Button>
              </div>
              {renderAttendancePreview(payloadState.attendanceRows || [])}
            </div>

            {saveStatus.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveStatus.error}
              </div>
            )}
            {saveStatus.message && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {saveStatus.message}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={() => handleSave("draft")}
                disabled={!canEdit || savingAction !== null}
              >
                {savingAction === "draft" ? "Saving…" : "Save Draft"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSave("submit")}
                disabled={!canEdit || savingAction !== null}
              >
                {savingAction === "submit" ? "Submitting…" : "Submit to Teacher"}
              </Button>
              <Button variant="ghost" onClick={() => mutate()} disabled={savingAction !== null}>
                Refresh
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
      {renderDiaryModal()}
    </div>
  );
}
