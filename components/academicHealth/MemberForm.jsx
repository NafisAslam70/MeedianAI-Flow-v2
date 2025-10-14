"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Loader2, Plus, Trash2 } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const safeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const initialiseCopyChecks = (rows = []) =>
  Array.isArray(rows) && rows.length
    ? rows.map((row, index) => ({
        id: row?.id || `copy-${index}`,
        studentId: row?.studentId || null,
        copyTypes: Array.isArray(row?.copyTypes) ? row.copyTypes : safeArray(row?.copyTypes),
        adFlag: Boolean(row?.adFlag),
        note: row?.note || "",
      }))
    : Array.from({ length: 5 }, (_, idx) => ({
        id: `copy-seed-${idx}`,
        studentId: null,
        copyTypes: [],
        adFlag: false,
        note: "",
      }));

const initialiseClassChecks = (rows = []) =>
  Array.isArray(rows) && rows.length
    ? rows.map((row, index) => ({
        id: row?.id || `class-${index}`,
        classId: row?.classId || null,
        diaryType: row?.diaryType || "CCD",
        adFlag: Boolean(row?.adFlag),
        note: row?.note || "",
      }))
    : Array.from({ length: 2 }, (_, idx) => ({
        id: `class-seed-${idx}`,
        classId: null,
        diaryType: idx === 0 ? "CCD" : "CDD",
        adFlag: false,
        note: "",
      }));

const normaliseCopyTypes = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const buildPatchPayload = (report) => {
  if (!report) return {};
  return {
    attendanceConfirmed: Boolean(report.attendanceConfirmed),
    maghribSalahLedById: report.maghribSalahLedById ? Number(report.maghribSalahLedById) : null,
    slot12TransitionQuality: report.slot12TransitionQuality || null,
    slot12NmriModerated: Boolean(report.slot12NmriModerated),
    slot12Ads: report.slot12Ads || "",
    mhcp2PresentCount:
      report.mhcp2PresentCount === "" || report.mhcp2PresentCount === null
        ? null
        : Number(report.mhcp2PresentCount),
    mhcp2AllTeachersPresent: Boolean(report.mhcp2AllTeachersPresent),
    mhcp2AbsentTeacherIds: Array.isArray(report.mhcp2AbsentTeacherIds)
      ? report.mhcp2AbsentTeacherIds.map(Number).filter((id) => Number.isFinite(id))
      : [],
    mhcp2Substitutions: Array.isArray(report.mhcp2Substitutions)
      ? report.mhcp2Substitutions
          .map((row) => ({
            originalTeacherId: row.originalTeacherId ? Number(row.originalTeacherId) : null,
            substituteTeacherId: row.substituteTeacherId ? Number(row.substituteTeacherId) : null,
            reason: row.reason || "",
          }))
          .filter((row) => row.originalTeacherId && row.substituteTeacherId)
      : [],
    mhcp2FocusToday: report.mhcp2FocusToday || "",
    mhcp2Discrepancies: report.mhcp2Discrepancies || "",
    section1Comment: report.section1Comment || "",
    checkMode: report.checkMode || "MSP",
    escalationsHandledIds: Array.isArray(report.escalationsHandledIds)
      ? report.escalationsHandledIds.map(Number).filter((id) => Number.isFinite(id))
      : [],
    copyChecks: Array.isArray(report.copyChecks)
      ? report.copyChecks.map((row) => ({
          studentId: row.studentId ? Number(row.studentId) : null,
          copyTypes: normaliseCopyTypes(row.copyTypes),
          adFlag: Boolean(row.adFlag),
          note: row.note || "",
        }))
      : [],
    classChecks: Array.isArray(report.classChecks)
      ? report.classChecks.map((row) => ({
          classId: row.classId ? Number(row.classId) : null,
          diaryType: row.diaryType || "CCD",
          adFlag: Boolean(row.adFlag),
          note: row.note || "",
        }))
      : [],
    morningCoaching: report.morningCoaching
      ? {
          absentees: Array.isArray(report.morningCoaching.absentees)
            ? report.morningCoaching.absentees.map(Number).filter((id) => Number.isFinite(id))
            : [],
          state: report.morningCoaching.state || "",
        }
      : { absentees: [], state: "" },
    escalationDetails: Array.isArray(report.escalationDetails)
      ? report.escalationDetails
          .map((row) => ({
            escalationId: row.escalationId ? Number(row.escalationId) : null,
            actionTaken: row.actionTaken || "",
            outcome: row.outcome || "",
            status: row.status || "FOLLOW_UP",
          }))
          .filter((row) => row.escalationId)
      : [],
    defaulters: Array.isArray(report.defaulters)
      ? report.defaulters
          .map((row) => ({
            studentId: row.studentId ? Number(row.studentId) : null,
            defaulterType: row.defaulterType || "",
            reason: row.reason || "",
          }))
          .filter((row) => row.studentId && row.defaulterType)
      : [],
    actionsByCategory: Array.isArray(report.actionsByCategory)
      ? report.actionsByCategory
          .map((row) => ({
            category: row.category || "",
            actions: Array.isArray(row.actions) ? row.actions.filter(Boolean) : [],
          }))
          .filter((row) => row.category)
      : [],
    selfDayClose: Boolean(report.selfDayClose),
    finalRemarks: report.finalRemarks || "",
    signatureName: report.signatureName || "",
    signatureBlobPath: report.signatureBlobPath || "",
  };
};

const defaultReportState = {
  id: null,
  status: "DRAFT",
  attendanceConfirmed: false,
  mop2CheckinTime: null,
  slot12TransitionQuality: "",
  slot12NmriModerated: true,
  slot12Ads: "",
  mhcp2PresentCount: "",
  mhcp2AllTeachersPresent: true,
  mhcp2AbsentTeacherIds: [],
  mhcp2Substitutions: [],
  mhcp2FocusToday: "",
  mhcp2Discrepancies: "",
  section1Comment: "",
  checkMode: "MSP",
  escalationsHandledIds: [],
  escalationDetails: [],
  copyChecks: initialiseCopyChecks(),
  classChecks: initialiseClassChecks(),
  morningCoaching: { absentees: [], state: "" },
  defaulters: [],
  actionsByCategory: [],
  selfDayClose: false,
  finalRemarks: "",
  signatureName: "",
  signatureBlobPath: "",
};

const primeReport = (raw) => {
  if (!raw) return { ...defaultReportState };
  return {
    ...defaultReportState,
    ...raw,
    mhcp2PresentCount:
      raw.mhcp2PresentCount === null || typeof raw.mhcp2PresentCount === "undefined"
        ? ""
        : raw.mhcp2PresentCount,
    mhcp2AbsentTeacherIds: safeArray(raw.mhcp2AbsentTeacherIds),
    mhcp2Substitutions: Array.isArray(raw.mhcp2Substitutions)
      ? raw.mhcp2Substitutions.map((row, index) => ({
          id: row?.id || `sub-${index}`,
          originalTeacherId: row?.originalTeacherId || null,
          substituteTeacherId: row?.substituteTeacherId || null,
          reason: row?.reason || "",
        }))
      : [],
    copyChecks: initialiseCopyChecks(raw.copyChecks),
    classChecks: initialiseClassChecks(raw.classChecks),
    morningCoaching: raw.morningCoaching
      ? {
          absentees: safeArray(raw.morningCoaching.absentees),
          state: raw.morningCoaching.state || "",
        }
      : { absentees: [], state: "" },
    escalationsHandledIds: safeArray(raw.escalationsHandledIds),
    escalationDetails: Array.isArray(raw.escalationDetails)
      ? raw.escalationDetails.map((row, index) => ({
          id: row?.id || `esc-${index}`,
          escalationId: row?.escalationId || null,
          actionTaken: row?.actionTaken || "",
          outcome: row?.outcome || "",
          status: row?.status || "FOLLOW_UP",
        }))
      : [],
    defaulters: Array.isArray(raw.defaulters)
      ? raw.defaulters.map((row, index) => ({
          id: row?.id || `def-${index}`,
          studentId: row?.studentId || null,
          defaulterType: row?.defaulterType || "",
          reason: row?.reason || "",
        }))
      : [],
    actionsByCategory: Array.isArray(raw.actionsByCategory)
      ? raw.actionsByCategory.map((row, index) => ({
          id: row?.id || `act-${index}`,
          category: row?.category || "",
          actions: safeArray(row?.actions),
        }))
      : [],
  };
};

function formatDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function AcademicHealthMemberForm({
  reportId,
  reportDate,
  instanceId,
  mutateReports,
  onClose,
}) {
  const { data: session } = useSession();
  const assignedToUserId = Number(session?.user?.id) || null;

  const supportKey =
    reportId && assignedToUserId
      ? `/api/reports/academic-health?mode=supporting&reportDate=${reportDate}&assignedToUserId=${assignedToUserId}`
      : null;

  const {
    data: reportData,
    error: reportError,
    isLoading: reportLoading,
    mutate: mutateReport,
  } = useSWR(reportId ? `/api/reports/academic-health/${reportId}` : null, fetcher);
  const { data: supportingData, error: supportingError } = useSWR(supportKey, fetcher);

  const [report, setReport] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (reportData?.report) {
      setReport(primeReport(reportData.report));
      setDirty(false);
    }
  }, [reportData?.report]);

  const sortedTeachers = useMemo(() => {
    const rows = supportingData?.teachers || [];
    return rows.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [supportingData?.teachers]);

  const sortedStudents = useMemo(() => {
    const rows = supportingData?.students || [];
    return rows.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [supportingData?.students]);

  const sortedClasses = useMemo(() => {
    const rows = supportingData?.classes || [];
    return rows.slice().sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }, [supportingData?.classes]);

  const escalationOptions = useMemo(() => supportingData?.escalations || [], [supportingData?.escalations]);
  const escalationStatuses = useMemo(
    () => supportingData?.escalationStatuses || [],
    [supportingData?.escalationStatuses]
  );
  const defaulterTypes = useMemo(
    () => supportingData?.defaulterTypes || [],
    [supportingData?.defaulterTypes]
  );
  const actionsCatalog = useMemo(() => supportingData?.actionsCatalog || [], [supportingData?.actionsCatalog]);
  const transitionOptions = useMemo(
    () => supportingData?.transitionQualityOptions || [],
    [supportingData?.transitionQualityOptions]
  );

  const handleFieldChange = (field) => (event) => {
    const value =
      event?.target?.type === "checkbox"
        ? event.target.checked
        : event?.target?.value !== undefined
        ? event.target.value
        : event;
    setReport((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setDirty(true);
    setFormError("");
    setMessage("");
  };

  const handleNestedUpdate = (key, index, updater) => {
    setReport((prev) => {
      if (!prev) return prev;
      const existing = Array.isArray(prev[key]) ? prev[key] : [];
      const next = existing.map((row, idx) => (idx === index ? updater(row) : row));
      return { ...prev, [key]: next };
    });
    setDirty(true);
  };

  const addSubstitution = () => {
    setReport((prev) => {
      if (!prev) return prev;
      const existing = Array.isArray(prev.mhcp2Substitutions) ? prev.mhcp2Substitutions : [];
      return {
        ...prev,
        mhcp2Substitutions: [
          ...existing,
          { id: `sub-${Date.now()}`, originalTeacherId: null, substituteTeacherId: null, reason: "" },
        ],
      };
    });
    setDirty(true);
  };

  const removeSubstitution = (index) => {
    setReport((prev) => {
      if (!prev) return prev;
      const existing = Array.isArray(prev.mhcp2Substitutions) ? prev.mhcp2Substitutions.slice() : [];
      existing.splice(index, 1);
      return { ...prev, mhcp2Substitutions: existing };
    });
    setDirty(true);
  };

  const addCopyCheckRow = () => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        copyChecks: [...(prev.copyChecks || []), { id: `copy-${Date.now()}`, studentId: null, copyTypes: [], adFlag: false, note: "" }],
      };
    });
    setDirty(true);
  };

  const removeCopyCheckRow = (index) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = Array.isArray(prev.copyChecks) ? prev.copyChecks.slice() : [];
      next.splice(index, 1);
      return { ...prev, copyChecks: next };
    });
    setDirty(true);
  };

  const addClassCheckRow = () => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        classChecks: [...(prev.classChecks || []), { id: `class-${Date.now()}`, classId: null, diaryType: "CCD", adFlag: false, note: "" }],
      };
    });
    setDirty(true);
  };

  const removeClassCheckRow = (index) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = Array.isArray(prev.classChecks) ? prev.classChecks.slice() : [];
      next.splice(index, 1);
      return { ...prev, classChecks: next };
    });
    setDirty(true);
  };

  const addDefaulterRow = () => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defaulters: [...(prev.defaulters || []), { id: `def-${Date.now()}`, studentId: null, defaulterType: "", reason: "" }],
      };
    });
    setDirty(true);
  };

  const removeDefaulterRow = (index) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = Array.isArray(prev.defaulters) ? prev.defaulters.slice() : [];
      next.splice(index, 1);
      return { ...prev, defaulters: next };
    });
    setDirty(true);
  };

  const updateActionsForCategory = (category, actions) => {
    setReport((prev) => {
      if (!prev) return prev;
      const existing = Array.isArray(prev.actionsByCategory) ? prev.actionsByCategory.slice() : [];
      const idx = existing.findIndex((row) => row.category === category);
      if (idx === -1) {
        existing.push({ category, actions });
      } else {
        existing[idx] = { ...existing[idx], actions };
      }
      return { ...prev, actionsByCategory: existing };
    });
    setDirty(true);
  };

  const toggleEscalation = (escalationId, checked) => {
    setReport((prev) => {
      if (!prev) return prev;
      const existingIds = Array.isArray(prev.escalationsHandledIds) ? prev.escalationsHandledIds.slice() : [];
      const details = Array.isArray(prev.escalationDetails) ? prev.escalationDetails.slice() : [];
      const idNum = Number(escalationId);
      if (checked) {
        if (!existingIds.includes(idNum)) {
          existingIds.push(idNum);
        }
        if (!details.some((row) => Number(row.escalationId) === idNum)) {
          details.push({
            id: `esc-${idNum}`,
            escalationId: idNum,
            actionTaken: "",
            outcome: "",
            status: escalationStatuses?.[0]?.value || "FOLLOW_UP",
          });
        }
      } else {
        const idx = existingIds.indexOf(idNum);
        if (idx !== -1) existingIds.splice(idx, 1);
        const detailIdx = details.findIndex((row) => Number(row.escalationId) === idNum);
        if (detailIdx !== -1) details.splice(detailIdx, 1);
      }
      return { ...prev, escalationsHandledIds: existingIds, escalationDetails: details };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!report || !reportId) return;
    setSaving(true);
    setFormError("");
    setMessage("");
    try {
      const payload = buildPatchPayload(report);
      const res = await fetch(`/api/reports/academic-health/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save draft.");
      }
      if (json?.report) {
        setReport(primeReport(json.report));
        mutateReport(json, false);
      }
      if (instanceId) {
        await fetch("/api/member/mri-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId, action: "draft", payload: { ahrReportId: reportId } }),
        });
      }
      await mutateReports?.();
      setDirty(false);
      setMessage(`Draft saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (err) {
      setFormError(err.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!report || !reportId) return;
    setSubmitting(true);
    setFormError("");
    setMessage("");
    try {
      const payload = buildPatchPayload(report);
      const res = await fetch(`/api/reports/academic-health/${reportId}/submit`, {
        method: "POST",
       	headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Submission failed.");
      }
      if (json?.report) {
        setReport(primeReport(json.report));
        mutateReport(json, false);
      }
      if (instanceId) {
        await fetch("/api/member/mri-reports", {
          method: "POST",
         	headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId, action: "submit", payload: { ahrReportId: reportId } }),
        });
      }
      await mutateReports?.();
      setDirty(false);
      setMessage("Report submitted successfully.");
      onClose?.();
    } catch (err) {
      setFormError(err.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeDefaulterCategories = useMemo(() => {
    if (!report || !Array.isArray(report.defaulters)) return [];
    const set = new Set();
    report.defaulters.forEach((row) => {
      if (row?.defaulterType) set.add(row.defaulterType);
    });
    return Array.from(set);
  }, [report?.defaulters]);

  if (reportLoading || !report) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        <p className="text-sm text-slate-600">Loading Academic Health Report…</p>
      </div>
    );
  }

  if (reportError) {
    return <p className="text-sm text-red-600">Failed to load report: {reportError.message}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-800">
        <p className="font-semibold">Academic Health Report • {reportDate}</p>
        <p className="text-xs">
          Your attendance scan: <span className="font-medium">{formatDateTime(report.mop2CheckinTime)}</span>
        </p>
      </div>

      {(supportingError || formError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {supportingError ? supportingError.message : null}
          {formError ? (supportingError ? ` • ${formError}` : formError) : null}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* Section 1 */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <header>
          <h4 className="text-base font-semibold text-slate-800">Section 1 — Arrival & Program Conductance</h4>
          <p className="text-sm text-slate-500">
            Confirm MOP2 attendance, audit Slot 12, and capture MHCP-2 readiness details.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={Boolean(report.attendanceConfirmed)}
              onChange={handleFieldChange("attendanceConfirmed")}
            />
            I confirm my MOP2 attendance
          </label>
          <Select
            label="Slot 12 transition quality"
            value={report.slot12TransitionQuality || ""}
            onChange={handleFieldChange("slot12TransitionQuality")}
          >
            <option value="">Select rating</option>
            {transitionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            label="Maghrib Salah led by"
            value={report.maghribSalahLedById || ""}
            onChange={handleFieldChange("maghribSalahLedById")}
          >
            <option value="">Select teacher</option>
            {sortedTeachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={Boolean(report.slot12NmriModerated)}
              onChange={handleFieldChange("slot12NmriModerated")}
            />
            NMRI moderator on-duty
          </label>
        </div>

        <textarea
          className="min-h-[70px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="Slot 12 actionable discrepancies / ADs"
          value={report.slot12Ads || ""}
          onChange={handleFieldChange("slot12Ads")}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            type="number"
            label="MHCP-2 student headcount"
            min={0}
            value={report.mhcp2PresentCount === "" ? "" : Number(report.mhcp2PresentCount)}
            onChange={handleFieldChange("mhcp2PresentCount")}
          />
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={Boolean(report.mhcp2AllTeachersPresent)}
              onChange={handleFieldChange("mhcp2AllTeachersPresent")}
            />
            All MHCP-2 teachers present
          </label>
          <Input
            label="Focus for MHCP-2 today"
            placeholder="e.g., Grammar drills"
            value={report.mhcp2FocusToday || ""}
            onChange={handleFieldChange("mhcp2FocusToday")}
          />
        </div>

        {!report.mhcp2AllTeachersPresent && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Absent teachers"
              value={report.mhcp2AbsentTeacherIds || []}
              multiple
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
                handleFieldChange("mhcp2AbsentTeacherIds")({
                  target: { value: selected },
                });
              }}
            >
              {sortedTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </Select>
            <div>
              <div className="flex items-center justify-between">
                <span className="block text-sm font-medium text-slate-700">Substitutions</span>
                <Button variant="light" size="xs" onClick={addSubstitution}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add substitution
                </Button>
              </div>
              <div className="mt-2 space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
                {!report.mhcp2Substitutions?.length && (
                  <p className="text-xs text-slate-500">Add substitute teacher details if any replacements were made.</p>
                )}
                {report.mhcp2Substitutions?.map((row, index) => (
                  <div key={row.id || index} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Select
                      value={row.originalTeacherId || ""}
                      onChange={(event) =>
                        handleNestedUpdate("mhcp2Substitutions", index, (current) => ({
                          ...current,
                          originalTeacherId: Number(event.target.value) || null,
                        }))
                      }
                    >
                      <option value="">Original teacher</option>
                      {sortedTeachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={row.substituteTeacherId || ""}
                      onChange={(event) =>
                        handleNestedUpdate("mhcp2Substitutions", index, (current) => ({
                          ...current,
                          substituteTeacherId: Number(event.target.value) || null,
                        }))
                      }
                    >
                      <option value="">Substitute</option>
                      {sortedTeachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.reason || ""}
                        onChange={(event) =>
                          handleNestedUpdate("mhcp2Substitutions", index, (current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        placeholder="Reason / notes"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        className="rounded-md border border-transparent p-1 text-slate-400 hover:text-red-600"
                        onClick={() => removeSubstitution(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <textarea
          className="min-h-[70px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="MHCP-2 discrepancies"
          value={report.mhcp2Discrepancies || ""}
          onChange={handleFieldChange("mhcp2Discrepancies")}
        />
        <textarea
          className="min-h-[60px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="Section summary / comments"
          value={report.section1Comment || ""}
          onChange={handleFieldChange("section1Comment")}
        />
      </section>

      {/* Section 2 */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <header>
          <h4 className="text-base font-semibold text-slate-800">Section 2 — Deanship Work</h4>
          <p className="text-sm text-slate-500">
            Capture escalations handled and either MSP academic health checks or morning coaching progress.
          </p>
        </header>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Escalations handled</p>
          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            {escalationOptions.length === 0 ? (
              <p className="text-xs text-slate-500">No open escalations assigned to you.</p>
            ) : (
              escalationOptions.map((matter) => {
                const checked = report.escalationsHandledIds?.includes(Number(matter.id));
                return (
                  <label
                    key={matter.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      checked={checked}
                      onChange={(event) => toggleEscalation(matter.id, event.target.checked)}
                    />
                    <div>
                      <p className="font-semibold text-slate-800">{matter.title}</p>
                      <p className="text-xs text-slate-500">Level {matter.level} • {matter.status}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {report.escalationsHandledIds?.length > 0 && (
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              {report.escalationDetails.map((detail, index) => (
                <div key={detail.id || index} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <textarea
                    className="min-h-[60px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Action taken"
                    value={detail.actionTaken || ""}
                    onChange={(event) =>
                      handleNestedUpdate("escalationDetails", index, (current) => ({
                        ...current,
                        actionTaken: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className="min-h-[60px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Outcome / follow-up"
                    value={detail.outcome || ""}
                    onChange={(event) =>
                      handleNestedUpdate("escalationDetails", index, (current) => ({
                        ...current,
                        outcome: event.target.value,
                      }))
                    }
                  />
                  <Select
                    value={detail.status || ""}
                    onChange={(event) =>
                      handleNestedUpdate("escalationDetails", index, (current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    {escalationStatuses.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="radio"
              name="ahr-check-mode"
              value="MSP"
              checked={report.checkMode === "MSP"}
              onChange={handleFieldChange("checkMode")}
              className="h-4 w-4 text-teal-600 focus:ring-teal-500"
            />
            Academic Health (MSP)
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="radio"
              name="ahr-check-mode"
              value="MORNING_COACHING"
              checked={report.checkMode === "MORNING_COACHING"}
              onChange={handleFieldChange("checkMode")}
              className="h-4 w-4 text-teal-600 focus:ring-teal-500"
            />
            Morning Coaching
          </label>
        </div>

        {report.checkMode === "MSP" ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-slate-800">Copy checks (5 students)</h5>
                <Button variant="light" size="xs" onClick={addCopyCheckRow}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add row
                </Button>
              </div>
              <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                {report.copyChecks.map((row, index) => (
                  <div key={row.id || index} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Select
                      value={row.studentId || ""}
                      onChange={(event) =>
                        handleNestedUpdate("copyChecks", index, (current) => ({
                          ...current,
                          studentId: Number(event.target.value) || null,
                        }))
                      }
                    >
                      <option value="">Select student</option>
                      {sortedStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                        </option>
                      ))}
                    </Select>
                    <input
                      type="text"
                      value={Array.isArray(row.copyTypes) ? row.copyTypes.join(", ") : ""}
                      onChange={(event) =>
                        handleNestedUpdate("copyChecks", index, (current) => ({
                          ...current,
                          copyTypes: normaliseCopyTypes(event.target.value),
                        }))
                      }
                      placeholder="Copy types (comma separated)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <textarea
                      className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Notes / ADs"
                      value={row.note || ""}
                      onChange={(event) =>
                        handleNestedUpdate("copyChecks", index, (current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          checked={Boolean(row.adFlag)}
                          onChange={(event) =>
                            handleNestedUpdate("copyChecks", index, (current) => ({
                              ...current,
                              adFlag: event.target.checked,
                            }))
                          }
                        />
                        AD noted
                      </label>
                      {report.copyChecks.length > 1 && (
                        <button
                          type="button"
                          className="rounded-md border border-transparent p-1 text-slate-400 hover:text-red-600"
                          onClick={() => removeCopyCheckRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-slate-800">Class diary checks (2 classes)</h5>
                <Button variant="light" size="xs" onClick={addClassCheckRow}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add row
                </Button>
              </div>
              <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                {report.classChecks.map((row, index) => (
                  <div key={row.id || index} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Select
                      value={row.classId || ""}
                      onChange={(event) =>
                        handleNestedUpdate("classChecks", index, (current) => ({
                          ...current,
                          classId: Number(event.target.value) || null,
                        }))
                      }
                    >
                      <option value="">Select class</option>
                      {sortedClasses.map((klass) => (
                        <option key={klass.id} value={klass.id}>
                          {klass.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={row.diaryType || "CCD"}
                      onChange={(event) =>
                        handleNestedUpdate("classChecks", index, (current) => ({
                          ...current,
                          diaryType: event.target.value,
                        }))
                      }
                    >
                      <option value="CCD">CCD</option>
                      <option value="CDD">CDD</option>
                    </Select>
                    <textarea
                      className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Notes / ADs"
                      value={row.note || ""}
                      onChange={(event) =>
                        handleNestedUpdate("classChecks", index, (current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          checked={Boolean(row.adFlag)}
                          onChange={(event) =>
                            handleNestedUpdate("classChecks", index, (current) => ({
                              ...current,
                              adFlag: event.target.checked,
                            }))
                          }
                        />
                        AD noted
                      </label>
                      {report.classChecks.length > 1 && (
                        <button
                          type="button"
                          className="rounded-md border border-transparent p-1 text-slate-400 hover:text-red-600"
                          onClick={() => removeClassCheckRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <Select
              label="Morning coaching absentees"
              value={report.morningCoaching?.absentees || []}
              multiple
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
                setReport((prev) => ({
                  ...prev,
                  morningCoaching: { ...(prev?.morningCoaching || {}), absentees: selected },
                }));
                setDirty(true);
              }}
            >
              {sortedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </Select>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Morning coaching updates — topics, ADs, absentees, teacher presence"
              value={report.morningCoaching?.state || ""}
              onChange={(event) =>
                setReport((prev) => ({
                  ...prev,
                  morningCoaching: { ...(prev?.morningCoaching || {}), state: event.target.value },
                }))
              }
            />
          </div>
        )}
      </section>

      {/* Section 3 */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <header>
          <h4 className="text-base font-semibold text-slate-800">Section 3 — Day Shutdown</h4>
          <p className="text-sm text-slate-500">
            Log defaulters, corrective actions, and confirm your own day close.
          </p>
        </header>

        <div>
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-slate-800">Defaulters</h5>
            <Button variant="light" size="xs" onClick={addDefaulterRow}>
              <Plus className="mr-1 h-3 w-3" />
              Add defaulter
            </Button>
          </div>
          <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            {report.defaulters.length === 0 && (
              <p className="text-xs text-slate-500">No defaulters logged yet.</p>
            )}
            {report.defaulters.map((row, index) => (
              <div key={row.id || index} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Select
                  value={row.studentId || ""}
                  onChange={(event) =>
                    handleNestedUpdate("defaulters", index, (current) => ({
                      ...current,
                      studentId: Number(event.target.value) || null,
                    }))
                  }
                >
                  <option value="">Select student</option>
                  {sortedStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={row.defaulterType || ""}
                  onChange={(event) =>
                    handleNestedUpdate("defaulters", index, (current) => ({
                      ...current,
                      defaulterType: event.target.value,
                    }))
                  }
                >
                  <option value="">Select category</option>
                  {defaulterTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.reason || ""}
                    onChange={(event) =>
                      handleNestedUpdate("defaulters", index, (current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Reason / AD"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    className="rounded-md border border-transparent p-1 text-slate-400 hover:text-red-600"
                    onClick={() => removeDefaulterRow(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {activeDefaulterCategories.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <h5 className="text-sm font-semibold text-slate-800">Actions taken per category</h5>
            <div className="mt-2 space-y-3">
              {activeDefaulterCategories.map((category) => {
                const actions = new Set(
                  report.actionsByCategory?.find((row) => row.category === category)?.actions || []
                );
                return (
                  <div key={category} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {category}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {actionsCatalog.map((action) => (
                        <label key={`${category}-${action.value}`} className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            checked={actions.has(action.value)}
                            onChange={(event) => {
                              const next = new Set(actions);
                              if (event.target.checked) {
                                next.add(action.value);
                              } else {
                                next.delete(action.value);
                              }
                              updateActionsForCategory(category, Array.from(next));
                            }}
                          />
                          {action.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={Boolean(report.selfDayClose)}
              onChange={handleFieldChange("selfDayClose")}
            />
            I have completed my day close
          </label>
          <Input
            label="Signature name"
            placeholder="Dean name"
            value={report.signatureName || ""}
            onChange={handleFieldChange("signatureName")}
          />
          <Input
            label="Signature upload path / URL"
            placeholder="Upload reference"
            value={report.signatureBlobPath || ""}
            onChange={handleFieldChange("signatureBlobPath")}
          />
        </div>
        <textarea
          className="min-h-[64px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="Final remarks / summary"
          value={report.finalRemarks || ""}
          onChange={handleFieldChange("finalRemarks")}
        />
      </section>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
        <Button
          variant="light"
          size="sm"
          onClick={handleSave}
          disabled={saving || submitting}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </span>
          ) : (
            "Save Draft"
          )}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </span>
          ) : (
            "Submit Report"
          )}
        </Button>
      </div>
    </div>
  );
}
