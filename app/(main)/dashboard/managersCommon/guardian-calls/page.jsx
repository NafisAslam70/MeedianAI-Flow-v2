"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CalendarDays, PhoneCall, RefreshCw } from "lucide-react";
import Link from "next/link";

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
  campaignAssignmentId: "",
});

const initialFilters = {
  classId: "",
  studentId: "",
  programId: "",
  callDate: "",
  search: "",
  followUp: "all",
  campaignId: "",
};

const formatDisplayDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const normalizePhone = (raw) => {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const dotIdx = str.indexOf(".");
  if (dotIdx === -1) return str;
  const fractional = str.slice(dotIdx + 1);
  if (/^0+$/.test(fractional)) {
    return str.slice(0, dotIdx);
  }
  return str;
};

export default function GuardianCallsPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState(() => initialForm());
  const [filters, setFilters] = useState(initialFilters);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [followUpModal, setFollowUpModal] = useState(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("log");
  const [previousFollowFilter, setPreviousFollowFilter] = useState("all");
  const [callMode, setCallMode] = useState("general");

  const {
    data: optionsData,
    error: optionsError,
    isLoading: optionsLoading,
  } = useSWR("/api/managersCommon/guardian-calls?section=options", fetcher, { dedupingInterval: 60000 });

  const classes = useMemo(() => optionsData?.classes || [], [optionsData?.classes]);
  const programs = useMemo(() => optionsData?.programs || [], [optionsData?.programs]);

  const campaignDateKey = form.callDate || todayKey();
  const {
    data: campaignsData,
    error: campaignsError,
  } = useSWR(
    `/api/managersCommon/guardian-calls?section=campaigns&date=${campaignDateKey}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const campaigns = campaignsData?.campaigns || [];
  const campaignsById = useMemo(() => {
    const map = new Map();
    for (const campaign of campaigns) {
      map.set(Number(campaign.id), campaign);
    }
    return map;
  }, [campaigns]);
  const viewerCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.assignedToViewer),
    [campaigns]
  );
  useEffect(() => {
    if (!viewerCampaigns.length && callMode === "campaign") {
      setCallMode("general");
      setForm((prev) => ({ ...prev, campaignAssignmentId: "" }));
    }
  }, [viewerCampaigns, callMode]);


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
    const effectiveFollowUp = activeTab === "followups" ? "needs" : filters.followUp;
    if (effectiveFollowUp && effectiveFollowUp !== "all") params.set("followUp", effectiveFollowUp);
    if (filters.campaignId) params.set("campaignId", filters.campaignId);
    return `/api/managersCommon/guardian-calls?${params.toString()}`;
  }, [filters, activeTab]);

  const {
    data: callsData,
    error: callsError,
    isLoading: callsLoading,
    mutate: mutateCalls,
  } = useSWR(callsKey, fetcher, { keepPreviousData: true, dedupingInterval: 15000 });

  const calls = useMemo(() => callsData?.calls || [], [callsData?.calls]);

  const campaignFilterOptions = useMemo(() => {
    const map = new Map();
    for (const campaign of campaigns) {
      map.set(Number(campaign.id), campaign.label);
    }
    for (const call of calls) {
      if (call?.campaign?.id) {
        map.set(Number(call.campaign.id), call.campaign.label);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [campaigns, calls]);

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
      guardianPhone: normalizePhone(selected?.guardianPhone),
    }));
  };

  const handleProgramChange = (event) => {
    setForm((prev) => ({
      ...prev,
      programId: event.target.value,
    }));
  };

  const selectedCampaign = useMemo(() => {
    if (!form.campaignAssignmentId) return null;
    const numeric = Number(form.campaignAssignmentId);
    if (!Number.isFinite(numeric)) return null;
    return campaignsById.get(numeric) || null;
  }, [form.campaignAssignmentId, campaignsById]);

  const handleCampaignSelect = (event) => {
    const value = event.target.value;
    const numeric = value ? Number(value) : null;
    const campaign = numeric ? campaignsById.get(numeric) : null;
    setForm((prev) => ({
      ...prev,
      campaignAssignmentId: value,
      classId:
        campaign && campaign.scope?.mode === "single_class" && campaign.scope.classId
          ? String(campaign.scope.classId)
          : prev.classId,
    }));
    if (campaign && campaign.scope?.mode === "single_class" && campaign.scope.classId) {
      setFilters((prev) => ({
        ...prev,
        classId: String(campaign.scope.classId),
      }));
    }
  };

  const applyCampaignToForm = (campaign) => {
    if (!campaign) return;
    setActiveTab("log");
    setCallMode("campaign");
    setForm((prev) => ({
      ...prev,
      campaignAssignmentId: String(campaign.id),
      classId:
        campaign.scope?.mode === "single_class" && campaign.scope.classId
          ? String(campaign.scope.classId)
          : prev.classId,
      callDate: todayKey(),
    }));
    if (campaign.scope?.mode === "single_class" && campaign.scope.classId) {
      setFilters((prev) => ({
        ...prev,
        classId: String(campaign.scope.classId),
      }));
    }
  };

  const handleCallModeChange = (mode) => {
    setCallMode(mode);
    if (mode === "general") {
      setForm((prev) => ({
        ...prev,
        campaignAssignmentId: "",
      }));
    } else if (mode === "campaign" && viewerCampaigns.length === 1) {
      applyCampaignToForm(viewerCampaigns[0]);
    }
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

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === "followups") {
      setPreviousFollowFilter(filters.followUp || "all");
      setFilters((prev) => ({
        ...prev,
        followUp: "needs",
      }));
    } else if (tab === "log") {
      setFilters((prev) => ({
        ...prev,
        followUp: previousFollowFilter || "all",
      }));
    }
  };

  const followUpSelectValue = activeTab === "followups" ? "needs" : filters.followUp;
  const isFollowUpTab = activeTab === "followups";

  const resetAlerts = () => {
    setStatusMessage(null);
  };

  const resetForm = () => {
    setForm((prev) => ({
      ...initialForm(),
      classId: prev.classId,
      callDate: todayKey(),
      campaignAssignmentId: prev.campaignAssignmentId || "",
    }));
    resetAlerts();
  };

  const setMessage = (type, text) => {
    setStatusMessage({ type, text });
    if (text) {
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const openFollowUpModal = (call) => {
    if (!call) return;
    const classParts = [];
    if (call.class?.name) classParts.push(call.class.name);
    if (call.class?.section) classParts.push(call.class.section);
    setFollowUpModal({
      id: call.id,
      studentName: call.student?.name || "",
      guardianName: call.guardian?.name || "",
      classLabel: classParts.join(" ").trim(),
      callDate: call.callDate,
      followUpNeeded: Boolean(call.followUpNeeded),
      followUpDate: call.followUpNeeded
        ? call.followUpDate || call.callDate || todayKey()
        : "",
      note: "",
      campaignLabel: call.campaign?.label || "",
    });
  };

  const updateFollowUpModal = (patch) => {
    setFollowUpModal((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const closeFollowUpModal = () => {
    setFollowUpModal(null);
    setFollowUpSaving(false);
  };

  const handleFollowUpSubmit = async (event) => {
    event.preventDefault();
    if (!followUpModal || followUpSaving) return;
    const note = (followUpModal.note || "").trim();
    if (note.length < 3) {
      setMessage("error", "Add a short follow-up note before saving.");
      return;
    }
    if (followUpModal.followUpNeeded && !followUpModal.followUpDate) {
      setMessage("error", "Pick a follow-up date.");
      return;
    }

    setFollowUpSaving(true);
    try {
      const res = await fetch("/api/managersCommon/guardian-calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: followUpModal.id,
          appendReport: note,
          followUpNeeded: followUpModal.followUpNeeded,
          followUpDate: followUpModal.followUpNeeded ? followUpModal.followUpDate : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      await mutateCalls();
      setMessage("success", "Follow-up updated.");
      closeFollowUpModal();
    } catch (error) {
      console.error("Failed to update guardian call follow-up", error);
      setMessage("error", error.message || "Failed to update follow-up.");
      setFollowUpSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!form.classId || !form.studentId || !form.callDate || !form.report.trim()) {
      setMessage("error", "Class, student, call date, and report are required.");
      return;
    }
    if (callMode === "campaign" && !form.campaignAssignmentId) {
      setMessage("error", "Choose a campaign before logging this call.");
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
          guardianPhone: normalizePhone(form.guardianPhone) || null,
          campaignAssignmentId: form.campaignAssignmentId ? Number(form.campaignAssignmentId) : null,
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
        {campaignsError && (
          <p className="text-sm text-red-600">
            Failed to load current phone call campaigns. Refresh the page or contact Admin.
          </p>
        )}
        <Link
          href="/dashboard/managersCommon/managerial-club"
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          <span aria-hidden="true">←</span>
          Back to Managerial Club
        </Link>
      </header>

      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        {[
          { id: "log", label: "Log calls" },
          { id: "followups", label: "Follow-ups" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-teal-500 text-white shadow"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!isFollowUpTab && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleCallModeChange("general")}
            className={`rounded-xl border p-4 text-left transition ${
              callMode === "general"
                ? "border-teal-300 bg-teal-50 shadow"
                : "border-gray-200 bg-white hover:border-teal-200"
            }`}
          >
            <h3 className="text-sm font-semibold text-gray-900">General call</h3>
            <p className="mt-1 text-xs text-gray-600">Log an ad-hoc guardian call not tied to a campaign.</p>
          </button>
          <button
            type="button"
            onClick={() => handleCallModeChange("campaign")}
            disabled={!viewerCampaigns.length}
            className={`rounded-xl border p-4 text-left transition ${
              callMode === "campaign"
                ? "border-teal-300 bg-teal-50 shadow"
                : "border-gray-200 bg-white hover:border-teal-200"
            } ${!viewerCampaigns.length ? "opacity-60" : ""}`}
          >
            <h3 className="text-sm font-semibold text-gray-900">Campaign call</h3>
            <p className="mt-1 text-xs text-gray-600">
              {viewerCampaigns.length
                ? "Pick an active phone call campaign assigned to you."
                : "No campaigns have been assigned to you yet."}
            </p>
          </button>
        </div>
      )}

      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-gray-900">Current phone call campaigns</h2>
              <p className="text-sm text-gray-600">
                {viewerCampaigns.length > 0
                  ? `You are assigned to ${viewerCampaigns.length} active campaign${viewerCampaigns.length > 1 ? "s" : ""}.`
                  : "Monitor these active campaigns and log updates as calls are completed."}
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2">
              {campaigns.map((campaign) => {
                const dueLabel = campaign.dueDate ? formatDisplayDate(campaign.dueDate) : "No deadline";
                const statusColor =
                  campaign.status === "overdue" ? "amber" : campaign.active ? "teal" : "gray";
                return (
                  <div
                    key={campaign.id}
                    className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition ${
                      campaign.assignedToViewer ? "border-teal-300 bg-teal-50/70" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{campaign.label}</p>
                        {campaign.scope?.label ? (
                          <p className="text-xs text-gray-500">{campaign.scope.label}</p>
                        ) : null}
                      </div>
                      <Badge color={statusColor}>
                        {campaign.status === "overdue"
                          ? "Overdue"
                          : campaign.active
                          ? campaign.assignedToViewer
                            ? "Assigned to you"
                            : "Active"
                          : "Snoozed"}
                      </Badge>
                    </div>
                    <div className="grid gap-1 text-xs text-gray-600">
                      {campaign.callType && <p><span className="font-semibold text-gray-700">Type:</span> {campaign.callType}</p>}
                      {campaign.focusArea && <p><span className="font-semibold text-gray-700">Focus:</span> {campaign.focusArea}</p>}
                      <p>
                        <span className="font-semibold text-gray-700">Due:</span> {dueLabel}
                      </p>
                      {campaign.assignedTo?.name && (
                        <p>
                          <span className="font-semibold text-gray-700">Owner:</span>{" "}
                          {campaign.assignedTo.name}
                        </p>
                      )}
                      {campaign.instructions && (
                        <p className="rounded-md border border-dashed border-teal-200 bg-teal-50/60 p-2 text-teal-800">
                          {campaign.instructions}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="light" onClick={() => applyCampaignToForm(campaign)}>
                        Log call
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            campaignId: String(campaign.id),
                          }))
                        }
                      >
                        View calls
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {!isFollowUpTab && (
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

            {callMode === "campaign" && (
              <div className="lg:col-span-3">
                <label className="text-sm font-medium text-gray-700" htmlFor="gc-campaign">
                  Campaign
                </label>
                <select
                  id="gc-campaign"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.campaignAssignmentId}
                  onChange={handleCampaignSelect}
                >
                  <option value="">Select campaign</option>
                  {viewerCampaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.label}
                      {campaign.scope?.label ? ` • ${campaign.scope.label}` : ""}
                    </option>
                  ))}
                </select>
                {selectedCampaign ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Due {formatDisplayDate(selectedCampaign.dueDate)} • Owner: {selectedCampaign.assignedTo?.name || "—"}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-600">
                    Select a campaign assigned to you to log this call.
                  </p>
                )}
              </div>
            )}

            {selectedCampaign && (
              <div className="lg:col-span-12 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                <p className="font-semibold">Campaign brief</p>
                <div className="mt-1 grid gap-1 text-teal-900/80 md:grid-cols-2">
                  {selectedCampaign.callType && (
                    <div>
                      <span className="font-semibold">Type:</span> {selectedCampaign.callType}
                    </div>
                  )}
                  {selectedCampaign.focusArea && (
                    <div>
                      <span className="font-semibold">Focus:</span> {selectedCampaign.focusArea}
                    </div>
                  )}
                  {selectedCampaign.audience && (
                    <div>
                      <span className="font-semibold">Audience:</span> {selectedCampaign.audience}
                    </div>
                  )}
                  {selectedCampaign.scope?.label && (
                    <div>
                      <span className="font-semibold">Scope:</span> {selectedCampaign.scope.label}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Due:</span> {formatDisplayDate(selectedCampaign.dueDate)}
                  </div>
                  {selectedCampaign.assignedTo?.name && (
                    <div>
                      <span className="font-semibold">Owner:</span> {selectedCampaign.assignedTo.name}
                    </div>
                  )}
                </div>
                {selectedCampaign.instructions && (
                  <p className="mt-2 rounded-md border border-dashed border-teal-300 bg-white/60 p-2 text-sm text-teal-800">
                    {selectedCampaign.instructions}
                  </p>
                )}
              </div>
            )}

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
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {isFollowUpTab ? "Follow-up queue" : "Recent guardian calls"}
              </h2>
              <p className="text-sm text-gray-600">
                {isFollowUpTab
                  ? "Keep track of pending follow-ups and close them once conversations are wrapped up."
                  : "Use filters to review past conversations and follow-ups for any student."}
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-8">
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
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-campaign">
                Campaign filter
              </label>
              <select
                id="gc-filter-campaign"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={filters.campaignId}
                onChange={handleFiltersChange("campaignId")}
              >
                <option value="">All campaigns</option>
                {campaignFilterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="gc-filter-followup">
                Follow-up status
              </label>
              <select
                id="gc-filter-followup"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={followUpSelectValue}
                onChange={handleFiltersChange("followUp")}
                disabled={isFollowUpTab}
              >
                <option value="all">All calls</option>
                <option value="needs">Needs follow-up</option>
                <option value="closed">Closed</option>
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
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Called by</th>
                  <th className="px-4 py-3">Logged at</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calls.length === 0 && !callsLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={12}>
                      No guardian calls logged yet. Once you add reports they will appear here.
                    </td>
                  </tr>
                )}
                {callsLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={12}>
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
                        <a href={`tel:${normalizePhone(call.guardian.phone)}`} className="text-teal-600 hover:underline">
                          {normalizePhone(call.guardian.phone)}
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
                    <td className="px-4 py-3 text-gray-700">
                      {call.campaign ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-900">{call.campaign.label}</span>
                          {call.campaign.scope?.label ? (
                            <span className="text-xs text-gray-500">{call.campaign.scope.label}</span>
                          ) : null}
                          {call.campaign.dueDate ? (
                            <span className="text-xs text-gray-500">
                              Due {formatDisplayDate(call.campaign.dueDate)}
                            </span>
                          ) : null}
                          {call.campaign.assignedToViewer && (
                            <Badge color="teal" className="w-fit">Assigned to you</Badge>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
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
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="primary"
                        className="shadow-sm shadow-teal-500/40"
                        onClick={() => openFollowUpModal(call)}
                      >
                        {call.followUpNeeded ? "Log follow-up" : "Add note"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {followUpModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Follow-up with {followUpModal.studentName || "student"}</h3>
              <p className="mt-1 text-sm text-gray-600">
                Guardian: {followUpModal.guardianName || "—"} • Call date: {formatDisplayDate(followUpModal.callDate)}
                {followUpModal.classLabel ? ` • Class ${followUpModal.classLabel}` : ""}
                {followUpModal.campaignLabel ? ` • Campaign: ${followUpModal.campaignLabel}` : ""}
              </p>
            </div>
            <form onSubmit={handleFollowUpSubmit}>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="text-sm font-medium text-gray-700" htmlFor="gc-followup-note">
                    Follow-up note
                  </label>
                  <textarea
                    id="gc-followup-note"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={4}
                    placeholder="Summarise the follow-up conversation or update."
                    value={followUpModal.note}
                    onChange={(event) => updateFollowUpModal({ note: event.target.value })}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700" htmlFor="gc-followup-status">
                    Next action
                  </label>
                  <select
                    id="gc-followup-status"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={followUpModal.followUpNeeded ? "needs" : "closed"}
                    onChange={(event) => {
                      const needs = event.target.value === "needs";
                      updateFollowUpModal({
                        followUpNeeded: needs,
                        followUpDate: needs
                          ? followUpModal.followUpDate || todayKey()
                          : "",
                      });
                    }}
                  >
                    <option value="needs">Needs another follow-up</option>
                    <option value="closed">Close follow-up</option>
                  </select>
                </div>
                {followUpModal.followUpNeeded && (
                  <div>
                    <label className="text-sm font-medium text-gray-700" htmlFor="gc-followup-date">
                      Schedule next follow-up
                    </label>
                    <input
                      id="gc-followup-date"
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      min={followUpModal.callDate || todayKey()}
                      value={followUpModal.followUpDate}
                      onChange={(event) => updateFollowUpModal({ followUpDate: event.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <Button type="button" variant="ghost" onClick={closeFollowUpModal} disabled={followUpSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={followUpSaving}>
                  {followUpSaving ? "Saving…" : "Save follow-up"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
