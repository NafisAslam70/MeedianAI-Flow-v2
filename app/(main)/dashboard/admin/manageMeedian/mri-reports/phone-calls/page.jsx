"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { format } from "date-fns";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const TEMPLATE_KEY = "phone_call_drive";
const CALL_TYPE_OPTIONS = ["Attendance follow-up", "Fee reminder", "PTM invite", "Wellness check", "Custom"];
const SCOPE_OPTIONS = [
  { value: "all_classes", label: "All classes" },
  { value: "single_class", label: "Specific class" },
  { value: "by_track", label: "Track / division" },
  { value: "custom", label: "Custom list" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, "dd MMM yyyy");
};

const createInitialFormState = () => ({
  userId: "",
  targetLabel: "",
  callType: CALL_TYPE_OPTIONS[0],
  focusArea: "",
  scopeMode: "all_classes",
  classId: "",
  track: "",
  audience: "",
  instructions: "",
  startDate: todayIso(),
  dueDate: "",
  active: true,
});

export default function ManagePhoneCallDrivesPage() {
  const router = useRouter();
  const { data: templateData, error: templateError } = useSWR(
    "/api/admin/manageMeedian?section=mriReportTemplates",
    fetcher,
    { dedupingInterval: 60000 }
  );
  const {
    data: assignmentData,
    error: assignmentError,
    mutate: mutateAssignments,
  } = useSWR(
    `/api/admin/manageMeedian?section=mriReportAssignments&templateKey=${TEMPLATE_KEY}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const { data: classesData } = useSWR(
    "/api/admin/manageMeedian?section=classes",
    fetcher,
    { dedupingInterval: 60000 }
  );
  const { data: teamData } = useSWR(
    "/api/admin/manageMeedian?section=team",
    fetcher,
    { dedupingInterval: 60000 }
  );

  const template = useMemo(
    () => (templateData?.templates || []).find((tpl) => tpl.key === TEMPLATE_KEY) || null,
    [templateData?.templates]
  );
  const assignments = assignmentData?.assignments || [];
  const classes = useMemo(() => {
    const rows = classesData?.classes || [];
    return [...rows].sort((a, b) => {
      const nameA = `${a.name || ""}${a.section ? ` ${a.section}` : ""}`;
      const nameB = `${b.name || ""}${b.section ? ` ${b.section}` : ""}`;
      return nameA.localeCompare(nameB);
    });
  }, [classesData?.classes]);
  const classById = useMemo(() => {
    const map = new Map();
    for (const cls of classes) {
      map.set(Number(cls.id), cls);
    }
    return map;
  }, [classes]);
  const trackOptions = useMemo(() => {
    const tracks = new Set();
    for (const cls of classes) {
      const track = String(cls.track || "").trim();
      if (track) tracks.add(track);
    }
    return Array.from(tracks).sort();
  }, [classes]);

  const callers = useMemo(() => {
    const rows = teamData?.users || [];
    return rows
      .filter((member) => member.role === "member" || member.role === "team_manager")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [teamData?.users]);

  const [form, setForm] = useState(() => createInitialFormState());
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const resetForm = () => {
    setEditingAssignment(null);
    setForm(createInitialFormState());
    resetAlerts();
  };

  const updateForm = (field) => (event) => {
    const value = event?.target?.value ?? event;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleScopeModeChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      scopeMode: value,
      classId: value === "single_class" ? prev.classId : "",
      track: value === "by_track" ? prev.track : "",
    }));
  };

  const loadAssignmentIntoForm = (assignment) => {
    if (!assignment) return;
    const scopeMeta = assignment.scopeMeta || {};
    const campaign = scopeMeta.campaign || {};
    const callScope = scopeMeta.callScope || {};
    const timeline = scopeMeta.timeline || {};
    setForm({
      userId: assignment.userId ? String(assignment.userId) : "",
      targetLabel: assignment.targetLabel || "",
      callType: campaign.callType || CALL_TYPE_OPTIONS[0],
      focusArea: campaign.focusArea || "",
      scopeMode: callScope.mode || "all_classes",
      classId: callScope.classId ? String(callScope.classId) : "",
      track: callScope.track || "",
      audience: campaign.audience || "",
      instructions: campaign.instructions || "",
      startDate: toInputDate(assignment.startDate || timeline.startDate) || todayIso(),
      dueDate: toInputDate(assignment.endDate || timeline.dueDate) || "",
      active: assignment.active !== false,
    });
    setEditingAssignment(assignment);
    resetAlerts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildScopeMeta = (payload) => {
    const scopeMeta = {
      campaign: {
        callType: payload.callType || null,
        focusArea: payload.focusArea || null,
        audience: payload.audience || null,
        instructions: payload.instructions || null,
      },
      timeline: {
        startDate: payload.startDate || null,
        dueDate: payload.dueDate || null,
      },
      callScope: {
        mode: payload.scopeMode,
        classId: payload.scopeMode === "single_class" && payload.classId ? Number(payload.classId) : null,
        track: payload.scopeMode === "by_track" ? payload.track || null : null,
      },
    };
    if (payload.scopeMode === "single_class" && payload.classId) {
      const cls = classById.get(Number(payload.classId));
      if (cls) {
        scopeMeta.class = {
          id: cls.id,
          name: cls.name,
          section: cls.section,
          track: cls.track,
        };
        scopeMeta.callScope.classLabel = `Class ${cls.name}${cls.section ? ` ${cls.section}` : ""}`;
      }
    }
    return scopeMeta;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (busy) return;
    resetAlerts();

    if (!form.userId) {
      setError("Choose a caller to assign this drive to.");
      return;
    }
    if (!form.targetLabel.trim()) {
      setError("Provide a campaign name.");
      return;
    }
    if (form.scopeMode === "single_class" && !form.classId) {
      setError("Select a class for this campaign.");
      return;
    }
    if (form.scopeMode === "by_track" && !form.track) {
      setError("Select a track for this campaign.");
      return;
    }

    const payload = {
      ...form,
      scopeMeta: buildScopeMeta(form),
    };
    if (!payload.startDate) payload.startDate = todayIso();

    setBusy(true);
    try {
      if (editingAssignment) {
        const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: [
              {
                id: editingAssignment.id,
                userId: Number(payload.userId),
                targetLabel: payload.targetLabel,
                startDate: payload.startDate || null,
                endDate: payload.dueDate || null,
                active: payload.active,
                classId:
                  payload.scopeMode === "single_class" && payload.classId
                    ? Number(payload.classId)
                    : null,
                scopeMeta: payload.scopeMeta,
              },
            ],
          }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result?.error || `Failed with ${res.status}`);
        setMessage("Phone call drive updated.");
      } else {
        const body = {
          templateKey: TEMPLATE_KEY,
          userId: Number(payload.userId),
          targetLabel: payload.targetLabel,
          startDate: payload.startDate,
          endDate: payload.dueDate || null,
          classId:
            payload.scopeMode === "single_class" && payload.classId
              ? Number(payload.classId)
              : null,
          scopeMeta: payload.scopeMeta,
          active: payload.active,
        };
        const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result?.error || `Failed with ${res.status}`);
        setMessage("Phone call drive created.");
      }
      await mutateAssignments();
      resetForm();
    } catch (err) {
      console.error("phone-call-drive save error", err);
      setError(err.message || "Failed to save phone call drive.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (assignment, nextActive) => {
    resetAlerts();
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ id: assignment.id, active: nextActive }],
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || `Failed with ${res.status}`);
      setMessage(nextActive ? "Drive reactivated." : "Drive snoozed.");
      await mutateAssignments();
    } catch (err) {
      setError(err.message || "Failed to update status.");
    }
  };

  const renderTemplateDetails = () => {
    if (!template) {
      return (
        <p className="text-sm text-red-600">
          Phone call drive template missing. Run the latest migration to seed templates.
        </p>
      );
    }
    const formSections = Array.isArray(template.formSchema?.sections) ? template.formSchema.sections : [];
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Template summary</h2>
          <p className="mt-1 text-sm text-gray-600">
            Key: <span className="font-mono">{template.key}</span> • Frequency:{" "}
            {template.defaultFrequency || "adhoc"}
          </p>
          {template.description && (
            <p className="mt-2 text-sm text-gray-700">{template.description}</p>
          )}
          {template.instructions && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Instructions</p>
              <p className="whitespace-pre-wrap">{template.instructions}</p>
            </div>
          )}
        </div>
        {formSections.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Form sections</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {formSections.map((section) => (
                <div
                  key={section?.key || section?.title}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
                >
                  <p className="font-semibold text-gray-900">
                    {section?.title || section?.key || "Section"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Entry type: {section?.repeat ? "Multiple rows" : "Single entry"}
                  </p>
                  {Array.isArray(section?.fields) && section.fields.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {section.fields.map((field) => (
                        <li key={field?.id || field?.label}>
                          <span className="font-medium">{field?.label || field?.id}</span> (
                          {field?.type || "text"})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">No fields defined.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAssignments = () => {
    if (!assignments.length) {
      return (
        <p className="text-sm text-gray-600">
          No phone call drives assigned yet. Use the form above to create the first one.
        </p>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Campaign</th>
              <th className="px-4 py-2 text-left">Caller</th>
              <th className="px-4 py-2 text-left">Scope</th>
              <th className="px-4 py-2 text-left">Focus</th>
              <th className="px-4 py-2 text-left">Due</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const scopeMeta = assignment.scopeMeta || {};
              const campaign = scopeMeta.campaign || {};
              const callScope = scopeMeta.callScope || {};
              const scopeLabel = (() => {
                if (callScope.mode === "single_class") {
                  return callScope.classLabel || assignment.targetLabel || "Class-specific";
                }
                if (callScope.mode === "by_track") {
                  return callScope.track ? `Track: ${callScope.track}` : "Track campaign";
                }
                if (callScope.mode === "custom") {
                  return "Custom list";
                }
                return "All classes";
              })();
              return (
                <tr key={assignment.id} className="border-t border-gray-200">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-gray-900">{assignment.targetLabel}</span>
                      <span className="text-xs text-gray-500">
                        Created: {assignment.createdAt ? formatDate(assignment.createdAt) : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-gray-900">
                        {assignment.userName || "—"}
                      </span>
                      <span className="text-xs text-gray-500">{assignment.userEmail || ""}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{scopeLabel}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="flex flex-col gap-0.5">
                      <span>{campaign.callType || "—"}</span>
                      {campaign.focusArea ? (
                        <span className="text-xs text-gray-500">{campaign.focusArea}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(assignment.endDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        assignment.active
                          ? "bg-teal-100 text-teal-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {assignment.active ? "Active" : "Snoozed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="light" onClick={() => loadAssignmentIntoForm(assignment)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(assignment, !assignment.active)}
                      >
                        {assignment.active ? "Snooze" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guardian Phone Call Drives</h1>
          <p className="text-sm text-gray-600">
            Launch and assign outbound call campaigns for office assistants and managers. Capture the
            outcome inside Managers Common &rarr; Guardian Calls.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports")}>
          Back to MRI Reports
        </Button>
      </div>

      {(templateError || assignmentError) && (
        <p className="text-sm text-red-600">
          Failed to load report data. Refresh the page or inspect API logs.
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-gray-900">
              {editingAssignment ? "Edit phone call drive" : "Create phone call drive"}
            </h2>
            <p className="text-sm text-gray-600">
              Define the audience, focus area, and owner for this calling routine. Drives appear in the
              Guardian Calls workspace for the assigned member.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <form className="grid gap-4 lg:grid-cols-12" onSubmit={handleSubmit}>
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-campaign-name">
                Campaign name
              </label>
              <input
                id="pc-campaign-name"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.targetLabel}
                onChange={updateForm("targetLabel")}
                placeholder="e.g. July Fee Reminder Calls"
              />
            </div>
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-call-type">
                Call type
              </label>
              <select
                id="pc-call-type"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.callType}
                onChange={updateForm("callType")}
              >
                {CALL_TYPE_OPTIONS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-focus">
                Focus / objective
              </label>
              <input
                id="pc-focus"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.focusArea}
                onChange={updateForm("focusArea")}
                placeholder="e.g. Confirm PTM attendance"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-caller">
                Caller / owner
              </label>
              <select
                id="pc-caller"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.userId}
                onChange={updateForm("userId")}
              >
                <option value="">Select member</option>
                {callers.map((caller) => (
                  <option key={caller.id} value={caller.id}>
                    {caller.name} {caller.role === "team_manager" ? "(Manager)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-scope-mode">
                Audience
              </label>
              <select
                id="pc-scope-mode"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.scopeMode}
                onChange={handleScopeModeChange}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {form.scopeMode === "single_class" && (
              <div className="lg:col-span-4">
                <label className="text-sm font-medium text-gray-700" htmlFor="pc-class">
                  Target class
                </label>
                <select
                  id="pc-class"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.classId}
                  onChange={updateForm("classId")}
                >
                  <option value="">Select class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Class {cls.name}
                      {cls.section ? ` ${cls.section}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.scopeMode === "by_track" && (
              <div className="lg:col-span-4">
                <label className="text-sm font-medium text-gray-700" htmlFor="pc-track">
                  Track / division
                </label>
                <select
                  id="pc-track"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.track}
                  onChange={updateForm("track")}
                >
                  <option value="">Select track</option>
                  {trackOptions.map((track) => (
                    <option key={track} value={track}>
                      {track}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-audience">
                Audience notes
              </label>
              <input
                id="pc-audience"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.audience}
                onChange={updateForm("audience")}
                placeholder="e.g. Guardians with pending fees"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-start">
                Start date
              </label>
              <input
                id="pc-start"
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.startDate}
                max={form.dueDate || undefined}
                onChange={updateForm("startDate")}
              />
            </div>
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-due">
                Deadline
              </label>
              <input
                id="pc-due"
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.dueDate}
                min={form.startDate || todayIso()}
                onChange={updateForm("dueDate")}
              />
            </div>
            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-status">
                Status
              </label>
              <select
                id="pc-status"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.active ? "active" : "inactive"}
                onChange={(event) => updateForm("active")(event.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="inactive">Snoozed</option>
              </select>
            </div>

            <div className="lg:col-span-12">
              <label className="text-sm font-medium text-gray-700" htmlFor="pc-notes">
                Caller brief / notes
              </label>
              <textarea
                id="pc-notes"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={4}
                value={form.instructions}
                onChange={updateForm("instructions")}
                placeholder="Share call script pointers, data sources, or escalation steps."
              />
            </div>

            <div className="lg:col-span-12 flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-[1.5rem] text-sm">
                {message ? <span className="text-teal-600">{message}</span> : null}
                {error ? <span className="text-red-600">{error}</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editingAssignment && (
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={busy}>
                    Cancel edit
                  </Button>
                )}
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : editingAssignment ? "Update drive" : "Create drive"}
                </Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Phone call drive template</h2>
        </CardHeader>
        <CardBody>{renderTemplateDetails()}</CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Assigned drives</h2>
          <p className="text-sm text-gray-600">
            Drives appear in Managers Common &rarr; Guardian Calls for the assigned member on the
            selected dates.
          </p>
        </CardHeader>
        <CardBody>{renderAssignments()}</CardBody>
      </Card>
    </div>
  );
}
