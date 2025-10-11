"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { format } from "date-fns";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const PT_TEMPLATE_KEY = "pt_daily_report";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, "yyyy-MM-dd");
};

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function ManagePtDailyReportPage() {
  const router = useRouter();

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
    `/api/admin/manageMeedian?section=mriReportAssignments&templateKey=${PT_TEMPLATE_KEY}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const { data: classTeachersData } = useSWR(
    "/api/admin/manageMeedian?section=classTeachers",
    fetcher,
    { dedupingInterval: 60000 }
  );
  const { data: teamData } = useSWR(
    "/api/admin/manageMeedian?section=team",
    fetcher,
    { dedupingInterval: 60000 }
  );
  const { data: classesData } = useSWR(
    "/api/member/student?type=classes",
    fetcher,
    { dedupingInterval: 60000 }
  );

  const templates = templateData?.templates || [];
  const assignments = assignmentData?.assignments || [];
  const ptTemplate = useMemo(
    () => templates.find((tpl) => tpl.key === PT_TEMPLATE_KEY),
    [templates]
  );

  const classTeachers = classTeachersData?.classTeachers || [];
  const classes = classesData?.classes || [];
  const teamMembers = teamData?.users || [];

  const teamMembersSorted = useMemo(
    () =>
      [...teamMembers]
        .filter((member) => member.role === "member" || member.role === "team_manager")
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [teamMembers]
  );

  const assistantOptions = teamMembersSorted;

  const assistantNameById = useMemo(() => {
    const map = new Map();
    for (const member of teamMembersSorted) {
      map.set(Number(member.id), member.name);
    }
    return map;
  }, [teamMembersSorted]);

  const activeCptByClass = useMemo(() => {
    const map = new Map();
    for (const row of classTeachers) {
      if (row.active) map.set(Number(row.classId), Number(row.userId));
    }
    return map;
  }, [classTeachers]);

  const [form, setForm] = useState({
    userId: "",
    classId: "",
    targetLabel: "",
    startDate: "",
    endDate: "",
    assistantId: "",
    active: true,
  });
  const [syncBusy, setSyncBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingAssignment, setEditingAssignment] = useState(null);
  const isEditing = Boolean(editingAssignment?.id);

  const getAssistantId = (assignment) => {
    if (!assignment) return null;
    const meta = assignment.scopeMeta;
    if (meta && typeof meta === "object") {
      const val = meta.assistantUserId;
      const num = Number(val);
      return Number.isFinite(num) && num > 0 ? num : null;
    }
    return null;
  };

  const editingAssistantId = getAssistantId(editingAssignment);
  const editingAssistantName = editingAssistantId
    ? editingAssignment?.assistantName || assistantNameById.get(editingAssistantId) || `User #${editingAssistantId}`
    : null;

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const assignFromForm = async (event) => {
    event?.preventDefault?.();
    resetAlerts();
    if (!isEditing && !form.userId) {
      setError("Select a member to assign.");
      return;
    }
    setAssignBusy(true);
    try {
      if (isEditing) {
        const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: [
              {
                id: editingAssignment.id,
                targetLabel: form.targetLabel,
                startDate: form.startDate || null,
                endDate: form.endDate || null,
                assistantUserId: form.assistantId ? Number(form.assistantId) : null,
                active: form.active,
              },
            ],
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
        setMessage("Assignment updated.");
        setEditingAssignment(null);
        setForm({
          userId: "",
          classId: "",
          targetLabel: "",
          startDate: "",
          endDate: "",
          assistantId: "",
          active: true,
        });
        await mutateAssignments();
      } else {
        const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateKey: PT_TEMPLATE_KEY,
            userId: Number(form.userId),
            classId: form.classId ? Number(form.classId) : null,
            targetLabel: form.targetLabel || undefined,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
            assistantUserId: form.assistantId ? Number(form.assistantId) : null,
            active: form.active,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
        setMessage("Assignment saved.");
        setForm({
          userId: "",
          classId: "",
          targetLabel: "",
          startDate: "",
          endDate: "",
          assistantId: "",
          active: true,
        });
        await mutateAssignments();
      }
    } catch (err) {
      setError(err.message || "Failed to save assignment.");
    } finally {
      setAssignBusy(false);
    }
  };

  const syncClassTeachers = async () => {
    resetAlerts();
    setSyncBusy(true);
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "syncClassTeachers" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
      setMessage(
        `Synced ${payload?.syncedUsers ?? 0} class teachers. Assignments ensured: ${
          payload?.assignmentsEnsured ?? 0
        }.`
      );
      await mutateAssignments();
      mutate("/api/admin/manageMeedian?section=classTeachers");
    } catch (err) {
      setError(err.message || "Failed to sync class teachers.");
    } finally {
      setSyncBusy(false);
    }
  };

  const renderTemplateDetails = () => {
    if (!ptTemplate) {
      return (
        <p className="text-sm text-red-600">
          PT Daily MRI template not found. Run the latest migration to seed templates.
        </p>
      );
    }

    const formSections = Array.isArray(ptTemplate.formSchema?.sections)
      ? ptTemplate.formSchema.sections
      : [];

    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-gray-900">{ptTemplate.name}</h3>
          <p className="text-sm text-gray-600">
            Key: <span className="font-mono">{ptTemplate.key}</span> • Frequency:{" "}
            {ptTemplate.defaultFrequency || "daily"}
          </p>
        </div>
        {ptTemplate.description && (
          <p className="text-sm text-gray-700">{ptTemplate.description}</p>
        )}
        {ptTemplate.instructions && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-indigo-800">
            <h4 className="font-semibold">Instructions</h4>
            <p className="mt-1 whitespace-pre-wrap">{ptTemplate.instructions}</p>
          </div>
        )}
        {formSections.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-800">Form Sections</h4>
            <div className="space-y-2">
              {formSections.map((section) => (
                <div
                  key={section?.key || section?.title}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <p className="text-sm font-semibold text-gray-800">
                    {section?.title || section?.key || "Section"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Repeatable: {section?.repeat ? "Yes" : "No"}
                  </p>
                  {Array.isArray(section?.fields) && section.fields.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {section.fields.map((field) => (
                        <li key={field?.id || field?.label}>
                          <span className="font-medium">{field?.label || field?.id}</span>{" "}
                          ({field?.type || "text"})
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

  const renderAssignmentsTable = () => {
    if (assignments.length === 0) {
      return <p className="text-sm text-gray-600">No assignments recorded yet.</p>;
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Class / Target</th>
              <th className="px-4 py-2 text-left">Assigned To</th>
              <th className="px-4 py-2 text-left">Assistant</th>
              <th className="px-4 py-2 text-left">Start</th>
              <th className="px-4 py-2 text-left">End</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t border-gray-200">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">
                      {assignment.className
                        ? `Class ${assignment.className}${
                            assignment.classSection ? ` ${assignment.classSection}` : ""
                          }`
                        : assignment.targetLabel || "—"}
                    </span>
                    <span className="text-xs text-gray-500">
                      Template: {assignment.templateName || assignment.templateKey}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">
                      {assignment.userName || "—"}
                    </span>
                    <span className="text-xs text-gray-500">{assignment.userEmail || ""}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {(() => {
                    const assistantId = getAssistantId(assignment);
                    if (!assistantId) return "—";
                    return (
                      assignment.assistantName ||
                      assistantNameById.get(assistantId) ||
                      `User #${assistantId}`
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-gray-700">{formatDate(assignment.startDate)}</td>
                <td className="px-4 py-3 text-gray-700">{formatDate(assignment.endDate)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      assignment.active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-100 text-gray-600 border border-gray-200"
                    }`}
                  >
                    {assignment.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingAssignment(assignment);
                        const assistantId = getAssistantId(assignment);
                        setForm({
                          userId: String(assignment.userId || ""),
                          classId: assignment.classId ? String(assignment.classId) : "",
                          targetLabel: assignment.targetLabel || "",
                          startDate: toInputDate(assignment.startDate),
                          endDate: toInputDate(assignment.endDate),
                          assistantId: assistantId ? String(assistantId) : "",
                          active: assignment.active,
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={async () => {
                        const confirm = window.confirm("Remove this assignment?");
                        if (!confirm) return;
                        resetAlerts();
                        try {
                          const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: assignment.id }),
                          });
                          const payload = await res.json();
                          if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
                          setMessage("Assignment removed.");
                          if (editingAssignment?.id === assignment.id) {
                            setEditingAssignment(null);
                            setForm({
                              userId: "",
                              classId: "",
                              targetLabel: "",
                              startDate: "",
                              endDate: "",
                              assistantId: "",
                              active: true,
                            });
                          }
                          await mutateAssignments();
                        } catch (err) {
                          setError(err.message || "Failed to remove assignment.");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PT Daily Report</h1>
          <p className="text-sm text-gray-600">
            Manage the Parent Teacher daily MRI report template, assignments, and supporting
            class teacher data.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports")}>
          ← Back to MRI Reports
        </Button>
      </div>

      {(templateError || assignmentError) && (
        <p className="text-sm text-red-600">
          Failed to load PT report data. Refresh the page or check API logs.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Template</h2>
        </CardHeader>
        <CardBody>{renderTemplateDetails()}</CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Current Assignments</h2>
        </CardHeader>
        <CardBody>{renderAssignmentsTable()}</CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Assign PT Daily Report Holders
              </h2>
              <p className="text-sm text-gray-600">
                Sync all class teachers or manually add office helpers, substitutes, and coordinators. Use the PT Assistant dropdown to designate who can pre-fill CCD / CDD entries in the PT assistant workspace.
              </p>
            </div>
            <Button variant="secondary" disabled={syncBusy} onClick={syncClassTeachers}>
              {syncBusy ? "Syncing…" : "Sync Class Teachers"}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {isEditing && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Editing assignment for <strong>{editingAssignment?.userName || "Member"}</strong>
              {editingAssignment?.className
                ? ` • Class ${editingAssignment.className}${
                    editingAssignment.classSection ? ` ${editingAssignment.classSection}` : ""
                  }`
                : ""}
              {editingAssistantName ? ` • Assistant: ${editingAssistantName}` : ""}
            </div>
          )}
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
            onSubmit={assignFromForm}
          >
            <Select
              label="Member"
              value={form.userId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, userId: event.target.value }))
              }
              required={!isEditing}
              disabled={isEditing}
            >
              <option value="">Select member</option>
              {teamMembersSorted.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>

            <Select
              label="Class (optional)"
              value={form.classId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, classId: event.target.value }))
              }
              disabled={isEditing}
            >
              <option value="">Unlinked / Office helper</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </Select>

            <Select
              label="PT Assistant (optional)"
              value={form.assistantId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, assistantId: event.target.value }))
              }
            >
              <option value="">No assistant</option>
              {assistantOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Target Label (optional)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Office Desk Team"
                value={form.targetLabel}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, targetLabel: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.startDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">End Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.endDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endDate: event.target.value }))
                }
              />
            </div>

            <div className="flex items-center gap-2 text-sm md:col-span-1">
              <input
                type="checkbox"
                id="pt-active"
                checked={form.active}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              <label htmlFor="pt-active" className="text-xs font-medium text-gray-600">
                Active
              </label>
            </div>

            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-3">
              <Button disabled={assignBusy}>
                {assignBusy ? "Saving…" : isEditing ? "Update Assignment" : "Save Assignment"}
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingAssignment(null);
                    setForm({
                      userId: "",
                      classId: "",
                      targetLabel: "",
                      startDate: "",
                      endDate: "",
                      assistantId: "",
                      active: true,
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {classTeachers.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-700">Tip</p>
              <p className="mt-1">
                There are {classTeachers.length} class teacher mappings in the system. Use &quot;Sync
                Class Teachers&quot; regularly so new sections automatically receive the PT report.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {classes.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">Class Teacher Snapshot</h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Class</th>
                    <th className="px-4 py-2 text-left">Current PT Holder</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((klass) => {
                    const userId = activeCptByClass.get(Number(klass.id));
                    const teacher = teamMembersSorted.find((member) => member.id === userId);
                    return (
                      <tr key={klass.id} className="border-t border-gray-200">
                        <td className="px-4 py-2 font-semibold text-gray-900">{klass.name}</td>
                        <td className="px-4 py-2 text-gray-700">{teacher ? teacher.name : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
