"use client";

import { useMemo, useState } from "react";
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

export default function ManageMriReportsPage() {
  const { data: templateData, error: templateError } = useSWR(
    "/api/admin/manageMeedian?section=mriReportTemplates",
    fetcher,
    { dedupingInterval: 30000 }
  );
  const { data: assignmentData, error: assignmentError, mutate: mutateAssignments } = useSWR(
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

  const classById = useMemo(() => {
    const map = new Map();
    for (const klass of classes) map.set(Number(klass.id), klass);
    return map;
  }, [classes]);

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
  });
  const [syncBusy, setSyncBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const assignFromForm = async (event) => {
    event?.preventDefault?.();
    resetAlerts();
    if (!form.userId) {
      setError("Select a member to assign.");
      return;
    }
    setAssignBusy(true);
    try {
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
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Failed with ${res.status}`);
      setMessage("Assignment saved.");
      setForm({ userId: "", classId: "", targetLabel: "", startDate: "", endDate: "" });
      await mutateAssignments();
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

  const renderTemplateMeta = () => {
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
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-gray-900">{ptTemplate.name}</h2>
            <p className="text-sm text-gray-600">
              Key: <span className="font-mono">{ptTemplate.key}</span> • Frequency:{" "}
              {ptTemplate.defaultFrequency || "daily"}
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {ptTemplate.description && (
            <p className="text-sm text-gray-700">{ptTemplate.description}</p>
          )}
          {ptTemplate.instructions && (
            <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 text-sm text-indigo-800">
              <h3 className="font-semibold">Instructions</h3>
              <p className="mt-1 whitespace-pre-wrap">{ptTemplate.instructions}</p>
            </div>
          )}
          {formSections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Form Sections</h3>
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
        </CardBody>
      </Card>
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
              <th className="px-4 py-2 text-left">Start</th>
              <th className="px-4 py-2 text-left">End</th>
              <th className="px-4 py-2 text-left">Status</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">MRI Reports</h1>
        <p className="text-sm text-gray-600">
          Configure MRI report templates and control which members are responsible for filling
          the PT Daily report each day.
        </p>
      </div>

      {(templateError || assignmentError) && (
        <p className="text-sm text-red-600">
          Failed to load MRI report data. Refresh the page or check API logs.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      {renderTemplateMeta()}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Assign PT Daily Report Holders
              </h2>
              <p className="text-sm text-gray-600">
                Sync all class teachers or manually add office helpers, substitutes, and coordinators.
              </p>
            </div>
            <Button variant="secondary" disabled={syncBusy} onClick={syncClassTeachers}>
              {syncBusy ? "Syncing…" : "Sync Class Teachers"}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
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
              required
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
            >
              <option value="">Unlinked / Office helper</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
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

            <div className="flex items-end md:col-span-2 lg:col-span-3">
              <Button disabled={assignBusy}>{assignBusy ? "Saving…" : "Save Assignment"}</Button>
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

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Current Assignments</h2>
        </CardHeader>
        <CardBody>{renderAssignmentsTable()}</CardBody>
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
