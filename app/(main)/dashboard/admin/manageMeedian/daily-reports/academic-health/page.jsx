"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

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

const toLocalTime = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const initialiseCopyChecks = (rows = []) =>
  rows.length
    ? rows.map((row) => ({
        id: row.id || `copy-${Math.random()}`,
        studentId: row.studentId || null,
        copyTypes: Array.isArray(row.copyTypes) ? row.copyTypes : [],
        adFlag: Boolean(row.adFlag),
        note: row.note || "",
      }))
    : Array.from({ length: 5 }, (_, idx) => ({
        id: `copy-seed-${idx}`,
        studentId: null,
        copyTypes: [],
        adFlag: false,
        note: "",
      }));

const initialiseClassChecks = (rows = []) =>
  rows.length
    ? rows.map((row) => ({
        id: row.id || `class-${Math.random()}`,
        classId: row.classId || null,
        diaryType: row.diaryType || "CCD",
        adFlag: Boolean(row.adFlag),
        note: row.note || "",
      }))
    : Array.from({ length: 2 }, (_, idx) => ({
        id: `class-seed-${idx}`,
        classId: null,
        diaryType: idx === 0 ? "CCD" : "CDD",
        adFlag: false,
        note: "",
      }));

const buildPatchPayload = (report) => {
  if (!report) return {};
  return {
    attendanceConfirmed: Boolean(report.attendanceConfirmed),
    maghribSalahLedById: report.maghribSalahLedById ? Number(report.maghribSalahLedById) : null,
    slot12TransitionQuality: report.slot12TransitionQuality || null,
    slot12NmriModerated: Boolean(report.slot12NmriModerated),
    slot12Ads: report.slot12Ads || "",
    mhcp2PresentCount: Number.isFinite(Number(report.mhcp2PresentCount))
      ? Number(report.mhcp2PresentCount)
      : null,
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

const emptyReportState = {
  id: null,
  status: "DRAFT",
  attendanceConfirmed: false,
  slot12NmriModerated: true,
  mhcp2AllTeachersPresent: true,
  mhcp2AbsentTeacherIds: [],
  mhcp2Substitutions: [],
  escalationsHandledIds: [],
  copyChecks: initialiseCopyChecks(),
  classChecks: initialiseClassChecks(),
  morningCoaching: { absentees: [], state: "" },
  escalationDetails: [],
  defaulters: [],
  actionsByCategory: [],
  selfDayClose: false,
  checkMode: "MSP",
};

const useTeamOptions = () => {
  const { data } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    revalidateOnFocus: false,
  });
  const options = useMemo(() => {
    if (!data?.users?.length) return [];
    return data.users
      .map((user) => ({
        id: user.id,
        name: user.name || `User #${user.id}`,
        isTeacher: user.isTeacher,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.users]);
  return options;
};

export default function AcademicHealthReportPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const selfUserId = toNumber(session?.user?.id) || null;
  const selfRole = session?.user?.role || "member";

  const [reportParams, setReportParams] = useState(() => ({
    reportDate: todayDate(),
    siteId: 1,
    assignedToUserId: null,
    checkMode: "MSP",
  }));
  const [loadedParamsKey, setLoadedParamsKey] = useState(null);
  const [report, setReport] = useState(emptyReportState);
  const [loadingReport, setLoadingReport] = useState(false);
  const [saveState, setSaveState] = useState({ saving: false, error: "", lastSavedAt: null });
  const [dirty, setDirty] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [bootstrappedFromQuery, setBootstrappedFromQuery] = useState(false);

  const teamOptions = useTeamOptions();

  useEffect(() => {
    if (!reportParams.assignedToUserId && selfUserId) {
      setReportParams((prev) => ({ ...prev, assignedToUserId: selfUserId }));
    }
  }, [reportParams.assignedToUserId, selfUserId]);

  useEffect(() => {
    if (bootstrappedFromQuery) return;
    const reportId = searchParams?.get("reportId");
    if (!reportId) {
      setBootstrappedFromQuery(true);
      return;
    }
    const loadExisting = async () => {
      setLoadingReport(true);
      try {
        const res = await fetch(`/api/reports/academic-health/${reportId}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
        const incoming = payload?.report;
        if (incoming) {
          const paramsFromReport = {
            reportDate: incoming.reportDate ? String(incoming.reportDate).slice(0, 10) : todayDate(),
            siteId: incoming.siteId || 1,
            assignedToUserId: incoming.assignedToUserId || selfUserId || null,
            checkMode: incoming.checkMode || "MSP",
          };
          setReportParams(paramsFromReport);
          setReport({
            ...emptyReportState,
            ...incoming,
            mhcp2AbsentTeacherIds: incoming.mhcp2AbsentTeacherIds || [],
            mhcp2Substitutions: incoming.mhcp2Substitutions || [],
            escalationsHandledIds: incoming.escalationsHandledIds || [],
            copyChecks: initialiseCopyChecks(incoming.copyChecks),
            classChecks: initialiseClassChecks(incoming.classChecks),
            morningCoaching: incoming.morningCoaching || { absentees: [], state: "" },
            escalationDetails: incoming.escalationDetails || [],
            defaulters: incoming.defaulters || [],
            actionsByCategory: incoming.actionsByCategory || [],
            checkMode: incoming.checkMode || "MSP",
          });
          const key = JSON.stringify(paramsFromReport);
          setLoadedParamsKey(key);
          setSaveState({ saving: false, error: "", lastSavedAt: incoming.updatedAt || null });
          setDirty(false);
        }
      } catch (error) {
        console.error("Failed to bootstrap report from query param:", error);
        setSaveState((prev) => ({ ...prev, error: error.message || "Failed to load report" }));
      } finally {
        setLoadingReport(false);
        setBootstrappedFromQuery(true);
      }
    };
    loadExisting();
  }, [bootstrappedFromQuery, searchParams, selfUserId]);

  const supportingKey =
    reportParams.assignedToUserId && reportParams.reportDate
      ? `/api/reports/academic-health?mode=supporting&reportDate=${reportParams.reportDate}&assignedToUserId=${reportParams.assignedToUserId}`
      : null;
  const {
    data: supportingData,
    error: supportingError,
    isLoading: supportingLoading,
    mutate: refreshSupporting,
  } = useSWR(supportingKey, fetcher, { revalidateOnFocus: false });

  const loadReport = useCallback(
    async (params) => {
      if (!params.assignedToUserId || !params.reportDate) return;
      const key = JSON.stringify(params);
      if (key === loadedParamsKey) return;
      setLoadingReport(true);
      setSaveState((prev) => ({ ...prev, error: "" }));
      try {
        const res = await fetch("/api/reports/academic-health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportDate: params.reportDate,
            siteId: params.siteId,
            assignedToUserId: params.assignedToUserId,
            checkMode: params.checkMode,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
        const incoming = payload?.report || {};
        setReport({
          ...emptyReportState,
          ...incoming,
          mhcp2AbsentTeacherIds: incoming.mhcp2AbsentTeacherIds || [],
          mhcp2Substitutions: incoming.mhcp2Substitutions || [],
          escalationsHandledIds: incoming.escalationsHandledIds || [],
          copyChecks: initialiseCopyChecks(incoming.copyChecks),
          classChecks: initialiseClassChecks(incoming.classChecks),
          morningCoaching: incoming.morningCoaching || { absentees: [], state: "" },
          escalationDetails: incoming.escalationDetails || [],
          defaulters: incoming.defaulters || [],
          actionsByCategory: incoming.actionsByCategory || [],
          checkMode: incoming.checkMode || params.checkMode || "MSP",
        });
        setSaveState({
          saving: false,
          error: "",
          lastSavedAt: incoming.updatedAt || null,
        });
        setLoadedParamsKey(key);
        setDirty(false);
      } catch (error) {
        console.error("Failed to load Academic Health Report:", error);
        setSaveState({ saving: false, error: error.message || "Failed to load report", lastSavedAt: null });
      } finally {
        setLoadingReport(false);
      }
    },
    [loadedParamsKey]
  );

  useEffect(() => {
    if (!reportParams.assignedToUserId || !reportParams.reportDate) return;
    loadReport(reportParams);
  }, [reportParams, loadReport]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveState((prev) => ({ ...prev, error: "" }));
  }, []);

  const patchReport = useCallback(
    async (payload) => {
      if (!report?.id) return;
      setSaveState((prev) => ({ ...prev, saving: true, error: "" }));
      try {
        const res = await fetch(`/api/reports/academic-health/${report.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        const updated = json?.report || {};
        setReport((prev) => ({
          ...prev,
          ...updated,
          copyChecks: initialiseCopyChecks(updated.copyChecks),
          classChecks: initialiseClassChecks(updated.classChecks),
          morningCoaching: updated.morningCoaching || { absentees: [], state: "" },
          escalationDetails: updated.escalationDetails || [],
          defaulters: updated.defaulters || [],
          actionsByCategory: updated.actionsByCategory || [],
        }));
        setSaveState({
          saving: false,
          error: "",
          lastSavedAt: updated.updatedAt || new Date().toISOString(),
        });
        setDirty(false);
      } catch (error) {
        console.error("Autosave failed:", error);
        setSaveState((prev) => ({
          ...prev,
          saving: false,
          error: error.message || "Failed to save report",
        }));
      }
    },
    [report?.id]
  );

  useEffect(() => {
    if (!report?.id || !dirty || !autoSaveEnabled) return;
    const payload = buildPatchPayload(report);
    const timer = setTimeout(() => {
      patchReport(payload);
    }, 1200);
    return () => clearTimeout(timer);
  }, [report, dirty, autoSaveEnabled, patchReport]);

  const handleField = (field) => (event) => {
    const value = event?.target?.type === "checkbox" ? event.target.checked : event.target.value;
    setReport((prev) => ({
      ...prev,
      [field]: field === "mhcp2PresentCount" ? (value === "" ? "" : Number(value)) : value,
    }));
    markDirty();
  };

  const updateNestedArray = (key, index, updater) => {
    setReport((prev) => {
      const existing = Array.isArray(prev[key]) ? prev[key] : [];
      const next = existing.map((row, idx) => (idx === index ? updater(row) : row));
      return { ...prev, [key]: next };
    });
    markDirty();
  };

  const addSubstitutionRow = () => {
    setReport((prev) => ({
      ...prev,
      mhcp2Substitutions: [
        ...(Array.isArray(prev.mhcp2Substitutions) ? prev.mhcp2Substitutions : []),
        { id: `sub-${Date.now()}`, originalTeacherId: null, substituteTeacherId: null, reason: "" },
      ],
    }));
  };

  const removeSubstitutionRow = (index) => {
    setReport((prev) => {
      const rows = Array.isArray(prev.mhcp2Substitutions) ? prev.mhcp2Substitutions.slice() : [];
      rows.splice(index, 1);
      return { ...prev, mhcp2Substitutions: rows };
    });
    markDirty();
  };

  const addEscalationDetail = (escalationId) => {
    setReport((prev) => {
      const rows = Array.isArray(prev.escalationDetails) ? prev.escalationDetails.slice() : [];
      const exists = rows.some((row) => Number(row.escalationId) === Number(escalationId));
      if (exists) return prev;
      rows.push({
        id: `esc-${escalationId}`,
        escalationId,
        actionTaken: "",
        outcome: "",
        status: supportingData?.escalationStatuses?.[0]?.value || "FOLLOW_UP",
      });
      return { ...prev, escalationDetails: rows };
    });
    markDirty();
  };

  const removeEscalationDetail = (escalationId) => {
    setReport((prev) => ({
      ...prev,
      escalationDetails: (prev.escalationDetails || []).filter(
        (row) => Number(row.escalationId) !== Number(escalationId)
      ),
    }));
    markDirty();
  };

  const updateActionsByCategory = (category, actions) => {
    setReport((prev) => {
      const rows = Array.isArray(prev.actionsByCategory) ? prev.actionsByCategory.slice() : [];
      const idx = rows.findIndex((row) => row.category === category);
      if (idx === -1) {
        rows.push({ category, actions });
      } else {
        rows[idx] = { ...rows[idx], actions };
      }
      return { ...prev, actionsByCategory: rows };
    });
    markDirty();
  };

  const addDefaulter = () => {
    setReport((prev) => ({
      ...prev,
      defaulters: [
        ...(Array.isArray(prev.defaulters) ? prev.defaulters : []),
        { id: `def-${Date.now()}`, studentId: null, defaulterType: "", reason: "" },
      ],
    }));
    markDirty();
  };

  const removeDefaulter = (index) => {
    setReport((prev) => {
      const rows = Array.isArray(prev.defaulters) ? prev.defaulters.slice() : [];
      rows.splice(index, 1);
      return { ...prev, defaulters: rows };
    });
    markDirty();
  };

  const handleSubmit = async () => {
    if (!report?.id) return;
    setSaveState((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      const payload = buildPatchPayload(report);
      const res = await fetch(`/api/reports/academic-health/${report.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const updated = json?.report || {};
      setReport((prev) => ({
        ...prev,
        ...updated,
        copyChecks: initialiseCopyChecks(updated.copyChecks),
        classChecks: initialiseClassChecks(updated.classChecks),
        morningCoaching: updated.morningCoaching || { absentees: [], state: "" },
        escalationDetails: updated.escalationDetails || [],
        defaulters: updated.defaulters || [],
        actionsByCategory: updated.actionsByCategory || [],
      }));
      setSaveState({
        saving: false,
        error: "",
        lastSavedAt: updated.updatedAt || new Date().toISOString(),
      });
      setDirty(false);
    } catch (error) {
      console.error("Submit failed:", error);
      setSaveState((prev) => ({ ...prev, saving: false, error: error.message || "Submit failed" }));
    }
  };

  const handleStatusAction = async (action) => {
    if (!report?.id) return;
    const endpoint =
      action === "approve"
        ? `/api/reports/academic-health/${report.id}/approve`
        : `/api/reports/academic-health/${report.id}/reopen`;
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const updated = json?.report || {};
      setReport((prev) => ({ ...prev, ...updated }));
      setSaveState((prev) => ({ ...prev, error: "", lastSavedAt: updated.updatedAt || prev.lastSavedAt }));
    } catch (error) {
      console.error(`Failed to ${action} report:`, error);
      setSaveState((prev) => ({ ...prev, error: error.message || `Failed to ${action} report` }));
    }
  };

  const sortedTeachers = useMemo(() => {
    const teachers = supportingData?.teachers || [];
    return teachers.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [supportingData?.teachers]);

  const activeDefaulterCategories = useMemo(() => {
    if (!Array.isArray(report?.defaulters)) return [];
    const set = new Set();
    report.defaulters.forEach((row) => {
      if (row?.defaulterType) set.add(row.defaulterType);
    });
    return Array.from(set);
  }, [report?.defaulters]);

  const actionsByCategoryMap = useMemo(() => {
    const map = new Map();
    (report?.actionsByCategory || []).forEach((row) => {
      if (row?.category) map.set(row.category, row.actions || []);
    });
    return map;
  }, [report?.actionsByCategory]);

  const selectedEscalations = useMemo(
    () =>
      new Set(
        (report?.escalationsHandledIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))
      ),
    [report?.escalationsHandledIds]
  );

  const escalationDetailMap = useMemo(() => {
    const map = new Map();
    (report?.escalationDetails || []).forEach((row) => {
      if (!row?.escalationId) return;
      map.set(Number(row.escalationId), row);
    });
    return map;
  }, [report?.escalationDetails]);

  const assignedUser = useMemo(() => {
    if (!reportParams.assignedToUserId) return null;
    const id = Number(reportParams.assignedToUserId);
    return teamOptions.find((user) => Number(user.id) === id) || null;
  }, [reportParams.assignedToUserId, teamOptions]);

  const showSubmit =
    report?.id &&
    ["DRAFT", "REOPENED"].includes(report.status) &&
    selfUserId &&
    Number(report.assignedToUserId) === Number(selfUserId);

  const showApprove = report?.id && ["SUBMITTED"].includes(report.status) && ["admin", "team_manager"].includes(selfRole);
  const showReopen =
    report?.id && ["SUBMITTED", "APPROVED"].includes(report.status) && ["admin", "team_manager"].includes(selfRole);

  const statusBadgeClass =
    report?.status === "SUBMITTED"
      ? "bg-amber-100 text-amber-800"
      : report?.status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : report?.status === "REOPENED"
      ? "bg-purple-100 text-purple-800"
      : "bg-slate-200 text-slate-800";

  return (
    <div className="space-y-6 pb-16">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Academic Health Report</h1>
            <p className="text-sm text-gray-600">
              Capture evening dean operations across arrival, MHCP-2 supervision, deanship tasks, and day shutdown.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}>
              {report?.status || "DRAFT"}
            </span>
            {saveState.saving && <Loader2 className="h-4 w-4 animate-spin text-teal-600" />}
            {saveState.lastSavedAt && (
              <span className="text-xs text-gray-500">Saved {toLocalTime(saveState.lastSavedAt)}</span>
            )}
          </div>
        </div>
        {saveState.error && <p className="text-sm text-red-600">{saveState.error}</p>}
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Report Context</h2>
          <p className="text-sm text-gray-600">Configure the date, site, and assigned dean to load or refresh the report.</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input
              type="date"
              label="Report Date"
              value={reportParams.reportDate}
              onChange={(event) =>
                setReportParams((prev) => ({ ...prev, reportDate: event.target.value || todayDate() }))
              }
            />
            <Input
              type="number"
              label="Site ID"
              min={1}
              value={reportParams.siteId}
              onChange={(event) => setReportParams((prev) => ({ ...prev, siteId: Number(event.target.value) || 1 }))}
            />
            <Select
              label="Assigned Dean"
              value={reportParams.assignedToUserId || ""}
              onChange={(event) =>
                setReportParams((prev) => ({
                  ...prev,
                  assignedToUserId: Number(event.target.value) || null,
                }))
              }
            >
              <option value="">Select member</option>
              {teamOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.isTeacher ? " • Teacher" : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Check Mode (new report)"
              value={reportParams.checkMode}
              onChange={(event) =>
                setReportParams((prev) => ({
                  ...prev,
                  checkMode: event.target.value || "MSP",
                }))
              }
            >
              <option value="MSP">MSP (Academic Health)</option>
              <option value="MORNING_COACHING">Morning Coaching</option>
            </Select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadedParamsKey(null);
                loadReport(reportParams);
                refreshSupporting();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload report
            </Button>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                checked={autoSaveEnabled}
                onChange={(event) => setAutoSaveEnabled(event.target.checked)}
              />
              Autosave every few seconds
            </label>
            {assignedUser && (
              <span className="text-xs text-gray-500">
                Working as: <span className="font-semibold text-gray-700">{assignedUser.name}</span>
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Section 1 — Arrival & Program Conductance</h2>
              <p className="text-sm text-gray-600">
                Confirm attendance, supervise Slot 12, and capture MHCP-2 readiness.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshSupporting()}
              disabled={supportingLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh auto data
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input
              label="MOP2 Check-in"
              value={toLocalTime(report?.mop2CheckinTime || supportingData?.mop2Checkin?.checkinTime)}
              readOnly
            />
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(report?.attendanceConfirmed)}
                onChange={handleField("attendanceConfirmed")}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              I confirm my attendance is accurate
            </label>
            <Select
              label="Maghrib Salah led by"
              value={report?.maghribSalahLedById || ""}
              onChange={handleField("maghribSalahLedById")}
            >
              <option value="">Select teacher</option>
              {sortedTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </Select>
            <Select
              label="Slot 12 transition quality"
              value={report?.slot12TransitionQuality || ""}
              onChange={handleField("slot12TransitionQuality")}
            >
              <option value="">Select rating</option>
              {(supportingData?.transitionQualityOptions || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(report?.slot12NmriModerated)}
                onChange={handleField("slot12NmriModerated")}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              NMRI moderator on-duty
            </label>
            <Input
              type="number"
              label="MHCP-2 Present Count"
              min={0}
              value={report?.mhcp2PresentCount ?? ""}
              onChange={handleField("mhcp2PresentCount")}
            />
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(report?.mhcp2AllTeachersPresent)}
                onChange={handleField("mhcp2AllTeachersPresent")}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              All MHCP-2 teachers present
            </label>
          </div>
          {!report?.mhcp2AllTeachersPresent && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Absent teachers"
                multiple
                value={report?.mhcp2AbsentTeacherIds || []}
                onChange={(event) => {
                  const options = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
                  setReport((prev) => ({ ...prev, mhcp2AbsentTeacherIds: options }));
                  markDirty();
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
                  <span className="block text-sm font-medium text-gray-700">Substitutions</span>
                  <Button variant="light" size="xs" onClick={addSubstitutionRow}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add substitution
                  </Button>
                </div>
                <div className="mt-2 space-y-3 rounded-lg border border-dashed border-gray-200 p-3">
                  {(report?.mhcp2Substitutions || []).length === 0 && (
                    <p className="text-xs text-gray-500">Add substitute mapping if any teacher was replaced.</p>
                  )}
                  {(report?.mhcp2Substitutions || []).map((row, index) => (
                    <div key={row.id || index} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <Select
                        value={row.originalTeacherId || ""}
                        onChange={(event) =>
                          updateNestedArray("mhcp2Substitutions", index, (current) => ({
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
                          updateNestedArray("mhcp2Substitutions", index, (current) => ({
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
                            updateNestedArray("mhcp2Substitutions", index, (current) => ({
                              ...current,
                              reason: event.target.value,
                            }))
                          }
                          placeholder="Reason / notes"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          className="rounded-md border border-transparent p-1 text-gray-400 hover:text-red-600"
                          onClick={() => removeSubstitutionRow(index)}
                          aria-label="Remove substitution"
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="MHCP-2 focus today"
              value={report?.mhcp2FocusToday || ""}
              onChange={handleField("mhcp2FocusToday")}
              placeholder="eg. Grammar drills on WH-questions"
            />
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Slot 12 actionable discrepancies, ADs noted..."
              value={report?.slot12Ads || ""}
              onChange={(event) =>
                setReport((prev) => ({ ...prev, slot12Ads: event.target.value }))
              }
              onBlur={markDirty}
            />
          </div>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Any MHCP-2 discrepancies or section-level comments..."
            value={report?.mhcp2Discrepancies || ""}
            onChange={(event) =>
              setReport((prev) => ({ ...prev, mhcp2Discrepancies: event.target.value }))
            }
            onBlur={markDirty}
          />
          <textarea
            className="min-h-[64px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Section summary / observations"
            value={report?.section1Comment || ""}
            onChange={(event) => setReport((prev) => ({ ...prev, section1Comment: event.target.value }))}
            onBlur={markDirty}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Section 2 — Deanship Work (during MHCP-2)</h2>
          <p className="text-sm text-gray-600">Log escalations handled and complete either MSP copy checks or Morning Coaching audit.</p>
        </CardHeader>
        <CardBody className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Escalations handled</label>
            <p className="text-xs text-gray-500">
              Select the escalations addressed today. Add action/outcome notes for each selected item.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(supportingData?.escalations || []).map((matter) => {
                const checked = selectedEscalations.has(Number(matter.id));
                return (
                  <label
                    key={matter.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = new Set(selectedEscalations);
                        if (event.target.checked) {
                          next.add(Number(matter.id));
                          addEscalationDetail(Number(matter.id));
                        } else {
                          next.delete(Number(matter.id));
                          removeEscalationDetail(Number(matter.id));
                        }
                        setReport((prev) => ({
                          ...prev,
                          escalationsHandledIds: Array.from(next),
                        }));
                        markDirty();
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{matter.title}</p>
                      <p className="text-xs text-gray-500">
                        Level {matter.level} • {matter.status}
                      </p>
                    </div>
                  </label>
                );
              })}
              {!supportingData?.escalations?.length && (
                <p className="text-sm text-gray-500">No open escalations assigned to this user.</p>
              )}
            </div>
          </div>

          {Array.from(selectedEscalations).map((escalationId) => {
            const detail = escalationDetailMap.get(Number(escalationId)) || {
              actionTaken: "",
              outcome: "",
              status: supportingData?.escalationStatuses?.[0]?.value || "FOLLOW_UP",
            };
            return (
              <div key={escalationId} className="rounded-lg border border-teal-100 bg-teal-50/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-teal-900">
                    Escalation #{escalationId} actions
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => removeEscalationDetail(Number(escalationId))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <textarea
                    className="min-h-[60px] w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Action taken"
                    value={detail.actionTaken || ""}
                    onChange={(event) =>
                      setReport((prev) => ({
                        ...prev,
                        escalationDetails: (prev.escalationDetails || []).map((row) =>
                          Number(row.escalationId) === Number(escalationId)
                            ? { ...row, actionTaken: event.target.value }
                            : row
                        ),
                      }))
                    }
                    onBlur={markDirty}
                  />
                  <textarea
                    className="min-h-[60px] w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Outcome / next steps"
                    value={detail.outcome || ""}
                    onChange={(event) =>
                      setReport((prev) => ({
                        ...prev,
                        escalationDetails: (prev.escalationDetails || []).map((row) =>
                          Number(row.escalationId) === Number(escalationId)
                            ? { ...row, outcome: event.target.value }
                            : row
                        ),
                      }))
                    }
                    onBlur={markDirty}
                  />
                  <Select
                    value={detail.status || ""}
                    onChange={(event) =>
                      setReport((prev) => ({
                        ...prev,
                        escalationDetails: (prev.escalationDetails || []).map((row) =>
                          Number(row.escalationId) === Number(escalationId)
                            ? { ...row, status: event.target.value }
                            : row
                        ),
                      }))
                    }
                  >
                    {(supportingData?.escalationStatuses || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <input
                type="radio"
                name="checkMode"
                value="MSP"
                checked={report?.checkMode === "MSP"}
                onChange={(event) => {
                  setReport((prev) => ({ ...prev, checkMode: event.target.value }));
                  markDirty();
                }}
                className="h-4 w-4 text-teal-600 focus:ring-teal-500"
              />
              MSP — Academic Health
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <input
                type="radio"
                name="checkMode"
                value="MORNING_COACHING"
                checked={report?.checkMode === "MORNING_COACHING"}
                onChange={(event) => {
                  setReport((prev) => ({ ...prev, checkMode: event.target.value }));
                  markDirty();
                }}
                className="h-4 w-4 text-teal-600 focus:ring-teal-500"
              />
              Morning Coaching
            </label>
          </div>

          {report?.checkMode === "MSP" && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Copy Checks (5 students)</h3>
                  <p className="text-xs text-gray-500">Select five unique students and note ADs where applicable.</p>
                </div>
              </div>
              <div className="space-y-3">
                {(report?.copyChecks || []).map((row, index) => (
                  <div key={row.id || index} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Select
                      value={row.studentId || ""}
                      onChange={(event) =>
                        updateNestedArray("copyChecks", index, (current) => ({
                          ...current,
                          studentId: Number(event.target.value) || null,
                        }))
                      }
                    >
                      <option value="">Select student</option>
                      {(supportingData?.students || []).map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                        </option>
                      ))}
                    </Select>
                    <input
                      type="text"
                      value={row.copyTypes?.join(", ") || ""}
                      onChange={(event) =>
                        updateNestedArray("copyChecks", index, (current) => ({
                          ...current,
                          copyTypes: normaliseCopyTypes(event.target.value),
                        }))
                      }
                      placeholder="Copy types (comma separated)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <textarea
                      className="min-h-[48px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Notes / ADs"
                      value={row.note || ""}
                      onChange={(event) =>
                        updateNestedArray("copyChecks", index, (current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={Boolean(row.adFlag)}
                        onChange={(event) =>
                          updateNestedArray("copyChecks", index, (current) => ({
                            ...current,
                            adFlag: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      AD noted
                    </label>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800">Class Diary Checks (CCD/CDD)</h3>
                <p className="text-xs text-gray-500">
                  Record exactly two class diary checks — one CCD, one CDD (or as per schedule).
                </p>
                <div className="mt-2 space-y-3">
                  {(report?.classChecks || []).map((row, index) => (
                    <div key={row.id || index} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Select
                        value={row.classId || ""}
                        onChange={(event) =>
                          updateNestedArray("classChecks", index, (current) => ({
                            ...current,
                            classId: Number(event.target.value) || null,
                          }))
                        }
                      >
                        <option value="">Select class</option>
                        {(supportingData?.classes || []).map((klass) => (
                          <option key={klass.id} value={klass.id}>
                            {klass.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={row.diaryType || "CCD"}
                        onChange={(event) =>
                          updateNestedArray("classChecks", index, (current) => ({
                            ...current,
                            diaryType: event.target.value,
                          }))
                        }
                      >
                        {(supportingData?.diaryTypes || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <textarea
                        className="min-h-[48px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Notes / ADs"
                        value={row.note || ""}
                        onChange={(event) =>
                          updateNestedArray("classChecks", index, (current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={Boolean(row.adFlag)}
                          onChange={(event) =>
                            updateNestedArray("classChecks", index, (current) => ({
                              ...current,
                              adFlag: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        AD noted
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {report?.checkMode === "MORNING_COACHING" && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Morning Coaching absentees"
                  multiple
                  value={report?.morningCoaching?.absentees || []}
                  onChange={(event) => {
                    const values = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
                    setReport((prev) => ({
                      ...prev,
                      morningCoaching: { ...(prev.morningCoaching || {}), absentees: values },
                    }));
                    markDirty();
                  }}
                >
                  {(supportingData?.students || []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
                <textarea
                  className="min-h-[96px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Topics, teacher presence, ADs noticed during Morning Coaching..."
                  value={report?.morningCoaching?.state || ""}
                  onChange={(event) =>
                    setReport((prev) => ({
                      ...prev,
                      morningCoaching
: { ...(prev.morningCoaching || {}), state: event.target.value },
                    }))
                  }
                  onBlur={markDirty}
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Section 3 — Day Shutdown & Self Closure</h2>
          <p className="text-sm text-gray-600">Log student defaulters, follow-up actions, and close your day.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Defaulters</h3>
              <Button variant="light" size="xs" onClick={addDefaulter}>
                <Plus className="mr-1 h-3 w-3" />
                Add defaulter
              </Button>
            </div>
            <div className="mt-2 space-y-3">
              {(report?.defaulters || []).map((row, index) => (
                <div key={row.id || index} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Select
                    value={row.studentId || ""}
                    onChange={(event) =>
                      updateNestedArray("defaulters", index, (current) => ({
                        ...current,
                        studentId: Number(event.target.value) || null,
                      }))
                    }
                  >
                    <option value="">Select student</option>
                    {(supportingData?.students || []).map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={row.defaulterType || ""}
                    onChange={(event) =>
                      updateNestedArray("defaulters", index, (current) => ({
                        ...current,
                        defaulterType: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select category</option>
                    {(supportingData?.defaulterTypes || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="text"
                    value={row.reason || ""}
                    onChange={(event) =>
                      updateNestedArray("defaulters", index, (current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Reason / AD"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-lg border border-transparent bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100"
                    onClick={() => removeDefaulter(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!(report?.defaulters || []).length && (
                <p className="text-xs text-gray-500">No defaulters logged for the day.</p>
              )}
            </div>
          </div>

          {activeDefaulterCategories.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
              <h3 className="text-sm font-semibold text-gray-800">Actions taken (per category)</h3>
              <p className="text-xs text-gray-500">
                Ensure each defaulter category has at least one follow-up action for audit purposes.
              </p>
              <div className="mt-3 space-y-3">
                {activeDefaulterCategories.map((category) => {
                  const activeActions = new Set(actionsByCategoryMap.get(category) || []);
                  return (
                    <div key={category} className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {category}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {(supportingData?.actionsCatalog || []).map((action) => (
                          <label key={`${category}-${action.value}`} className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              checked={activeActions.has(action.value)}
                              onChange={(event) => {
                                const next = new Set(actionsByCategoryMap.get(category) || []);
                                if (event.target.checked) next.add(action.value);
                                else next.delete(action.value);
                                updateActionsByCategory(category, Array.from(next));
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(report?.selfDayClose)}
                onChange={handleField("selfDayClose")}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              I have completed my day close
            </label>
            <Input
              label="Signature — Name"
              placeholder="Enter your name as it appears in the app"
              value={report?.signatureName || ""}
              onChange={handleField("signatureName")}
            />
            <Input
              label="Signature Blob Path / URL"
              placeholder="Upload to storage & paste link"
              value={report?.signatureBlobPath || ""}
              onChange={handleField("signatureBlobPath")}
            />
          </div>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Final remarks / summary"
            value={report?.finalRemarks || ""}
            onChange={(event) =>
              setReport((prev) => ({ ...prev, finalRemarks: event.target.value }))
            }
            onBlur={markDirty}
          />
        </CardBody>
      </Card>

      <div className="sticky bottom-4 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg shadow-gray-900/5">
        <div className="flex items-center gap-3">
          {dirty ? (
            <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
          ) : (
            <span className="text-xs text-gray-500">All changes saved</span>
          )}
          {saveState.saving && (
            <span className="flex items-center gap-1 text-xs text-teal-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="light"
            size="sm"
            onClick={() => {
              if (!report?.id) return;
              const payload = buildPatchPayload(report);
              patchReport(payload);
            }}
            disabled={saveState.saving || !report?.id}
          >
            <Save className="mr-2 h-4 w-4" />
            Save now
          </Button>
          {showSubmit && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={saveState.saving}
            >
              Submit report
            </Button>
          )}
          {showApprove && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleStatusAction("approve")}
            >
              Approve
            </Button>
          )}
          {showReopen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusAction("reopen")}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      {supportingError && <p className="text-sm text-red-600">Failed to load supporting data. Reload to retry.</p>}
    </div>
  );
}
