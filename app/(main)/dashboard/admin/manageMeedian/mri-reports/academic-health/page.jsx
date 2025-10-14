"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { format } from "date-fns";
import { Loader2, Edit3, RotateCcw } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const TEMPLATE_KEY = "academic_health_report";

const formatDate = (value, fallback = "—") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, "yyyy-MM-dd");
};

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const initialFormState = {
  userId: "",
  siteId: "",
  targetLabel: "",
  startDate: "",
  endDate: "",
  active: true,
};

export default function ManageAcademicHealthReportPage() {
  const { data: templateData, error: templateError } = useSWR(
    "/api/admin/manageMeedian?section=mriReportTemplates",
    fetcher,
    { dedupingInterval: 30000 }
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
  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    dedupingInterval: 60000,
  });

  const template = useMemo(
    () => (templateData?.templates || []).find((tpl) => tpl.key === TEMPLATE_KEY),
    [templateData?.templates]
  );

  const assignments = assignmentData?.assignments || [];
  const teamMembers = useMemo(() => {
    const rows = teamData?.users || [];
    return rows
      .filter((member) => member?.name)
      .map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [teamData?.users]);

  const memberNameById = useMemo(() => {
    const map = new Map();
    teamMembers.forEach((member) => map.set(Number(member.id), member.name));
    return map;
  }, [teamMembers]);

  const [form, setForm] = useState(initialFormState);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setForm(initialFormState);
    setEditingAssignment(null);
  };

  const startEditing = (assignment) => {
    setEditingAssignment(assignment);
    const meta = assignment?.scopeMeta && typeof assignment.scopeMeta === "object" ? assignment.scopeMeta : {};
    const siteId = Number(meta.siteId) || "";
    setForm({
      userId: assignment?.userId ? String(assignment.userId) : "",
      siteId: siteId ? String(siteId) : "",
      targetLabel: assignment?.targetLabel || "",
      startDate: toInputDate(assignment?.startDate),
      endDate: toInputDate(assignment?.endDate),
      active: assignment?.active !== false,
    });
  };

  const handleChange = (field) => (event) => {
    const value =
      event?.target?.type === "checkbox"
        ? event.target.checked
        : typeof event?.target?.value !== "undefined"
        ? event.target.value
        : event;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setMessage("");
    setError("");

    const userIdNum = Number(form.userId);
    if (!userIdNum || Number.isNaN(userIdNum)) {
      setError("Select a dean to assign.");
      return;
    }

    const trimmedSite = typeof form.siteId === "string" ? form.siteId.trim() : "";
    const existingMeta =
      editingAssignment?.scopeMeta && typeof editingAssignment.scopeMeta === "object"
        ? editingAssignment.scopeMeta
        : {};
    const existingSiteId = Number(existingMeta?.siteId) || null;

    let scopeMetaPayload;
    if (trimmedSite) {
      const parsedSite = Number(trimmedSite);
      if (!Number.isFinite(parsedSite)) {
        setError("Site ID must be a number.");
        return;
      }
      scopeMetaPayload = { siteId: parsedSite };
    } else if (editingAssignment && existingSiteId) {
      scopeMetaPayload = { siteId: null };
    }

    setSubmitting(true);
    try {
      if (editingAssignment?.id) {
        const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: [
              {
                id: editingAssignment.id,
                targetLabel: form.targetLabel || "",
                startDate: form.startDate || null,
                endDate: form.endDate || null,
                active: form.active,
                ...(scopeMetaPayload ? { scopeMeta: scopeMetaPayload } : {}),
              },
            ],
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
        setMessage("Assignment updated.");
      } else {
        const body = {
          templateKey: TEMPLATE_KEY,
          userId: userIdNum,
          targetLabel: form.targetLabel || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          active: form.active,
        };
        if (scopeMetaPayload) {
          body.scopeMeta = scopeMetaPayload;
        }
        const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
        setMessage("Assignment created.");
      }
      await mutateAssignments();
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "Failed to save assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (assignment) => {
    if (!assignment?.id) return;
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ id: assignment.id, active: !assignment.active }],
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
      setMessage(`Assignment ${assignment.active ? "disabled" : "re-activated"}.`);
      await mutateAssignments();
    } catch (submitError) {
      setError(submitError.message || "Failed to update assignment.");
    }
  };

  const assignmentRows = useMemo(
    () =>
      assignments
        .map((assignment) => {
          const meta = assignment?.scopeMeta && typeof assignment.scopeMeta === "object" ? assignment.scopeMeta : {};
          const siteId = Number(meta.siteId) || null;
          return {
            ...assignment,
            displayName: assignment?.userName || memberNameById.get(Number(assignment?.userId)) || `User #${assignment?.userId}`,
            siteId,
          };
        })
        .sort((a, b) => {
          if (a.active === b.active) {
            return (b.updatedAt || "").localeCompare(a.updatedAt || "");
          }
          return a.active ? -1 : 1;
        }),
    [assignments, memberNameById]
  );

  const templateMetaList = useMemo(() => {
    if (!template?.meta || typeof template.meta !== "object") return [];
    return Object.entries(template.meta).map(([key, value]) => ({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
  }, [template]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900">Academic Health Report</h1>
        <p className="text-sm text-gray-600">
          Assign the evening-dean who must complete the Academic Health Report and review the current template details.
        </p>
        {(templateError || assignmentError) && (
          <p className="text-xs text-red-600">Failed to load template or assignment data. Refresh to retry.</p>
        )}
        {message && <p className="text-xs text-green-600">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Assign Report Owners</h2>
                <p className="text-sm text-gray-600">
                  Map the Academic Health Report to an evening dean. Optional: add a site ID and validity window.
                </p>
              </div>
              {editingAssignment && (
                <Button variant="light" size="xs" onClick={resetForm}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Select
                label="Dean / Member"
                value={form.userId}
                onChange={handleChange("userId")}
                disabled={Boolean(editingAssignment)}
              >
                <option value="">Select team member</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} {member.role === "team_manager" ? "• Manager" : ""}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  label="Site ID (optional)"
                  placeholder="e.g. 1"
                  value={form.siteId}
                  onChange={handleChange("siteId")}
                />
                <Input
                  label="Target label"
                  placeholder="e.g. Evening Dean – Downtown"
                  value={form.targetLabel}
                  onChange={handleChange("targetLabel")}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  type="date"
                  label="Start date"
                  value={form.startDate}
                  onChange={handleChange("startDate")}
                />
                <Input
                  type="date"
                  label="End date"
                  value={form.endDate}
                  onChange={handleChange("endDate")}
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={handleChange("active")}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                Assignment active
              </label>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </span>
                ) : editingAssignment ? (
                  "Update Assignment"
                ) : (
                  "Assign Report"
                )}
              </Button>
            </form>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">Current assignments</h3>
              {!assignmentRows.length && (
                <p className="text-xs text-gray-500">No assignments yet. Create the first mapping above.</p>
              )}
              {!!assignmentRows.length && (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Member</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Site</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Window</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {assignmentRows.map((assignment) => (
                        <tr key={assignment.id} className={!assignment.active ? "opacity-70" : ""}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{assignment.displayName}</div>
                            {assignment.targetLabel && (
                              <div className="text-xs text-gray-500">{assignment.targetLabel}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{assignment.siteId ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatDate(assignment.startDate, "—")} → {formatDate(assignment.endDate, "Open")}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                assignment.active
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {assignment.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() => startEditing(assignment)}
                              >
                                <Edit3 className="mr-1 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                variant={assignment.active ? "ghost" : "primary"}
                                size="xs"
                                onClick={() => toggleActive(assignment)}
                              >
                                {assignment.active ? "Disable" : "Activate"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">Template Overview</h2>
            <p className="text-sm text-gray-600">
              Review the Academic Health Report template metadata and open a preview of the current reporting form.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{template?.name || "Academic Health Report"}</div>
              <p className="mt-1 text-sm text-gray-600">{template?.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Frequency</p>
                <p className="text-sm font-semibold text-gray-900">
                  {template?.defaultFrequency ? String(template.defaultFrequency).toUpperCase() : "Daily"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pre-submit</p>
                <p className="text-sm font-semibold text-gray-900">
                  {template?.allowPreSubmit ? "Allowed" : "Disabled"}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Instructions</h3>
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                {template?.instructions ||
                  "Assign the evening dean and have them fill the Academic Health Report from Close My Day → MRI Clearance."}
              </p>
            </div>
            {!!templateMetaList.length && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Template meta</h3>
                <ul className="mt-1 space-y-1 text-xs text-gray-500">
                  {templateMetaList.map((entry) => (
                    <li key={entry.key}>
                      <span className="font-semibold text-gray-700">{entry.key}:</span> {entry.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  window.open("/dashboard/admin/manageMeedian/daily-reports/academic-health", "_blank", "noopener")
                }
              >
                Preview Report Form
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={() => window.open("/dashboard/member/closeMyDay", "_blank", "noopener")}
              >
                Open Close My Day (Member View)
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
