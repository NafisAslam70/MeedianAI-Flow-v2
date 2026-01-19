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

const HOSTEL_DAILY_DUE_TEMPLATE_KEY = "hostel_daily_due_report";

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

export default function ManageHostelDailyDueReportPage() {
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
    `/api/admin/manageMeedian?section=mriReportAssignments&templateKey=${HOSTEL_DAILY_DUE_TEMPLATE_KEY}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher, {
    dedupingInterval: 60000,
  });

  const templates = templateData?.templates || [];
  const assignments = assignmentData?.assignments || [];
  const users = teamData?.users || [];

  const template = useMemo(
    () => templates.find((tpl) => tpl.key === HOSTEL_DAILY_DUE_TEMPLATE_KEY),
    [templates]
  );

  const hostelIncharges = useMemo(
    () => users.filter((user) => user.active !== false && user.role === 'team_manager' && user.team_manager_type === 'hostel_incharge'),
    [users]
  );

  const hostelAuthorities = useMemo(
    () => users.filter((user) => user.active !== false && ((user.role === 'admin') || (user.role === 'team_manager' && user.team_manager_type !== 'hostel_incharge'))),
    [users]
  );

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedHAUserId, setSelectedHAUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getUserDisplayText = (user) => {
    const roleText = user.role === 'team_manager' && user.team_manager_type
      ? `${user.role} (${user.team_manager_type.replace('_', ' ')})`
      : user.role;
    return `${user.name} - ${roleText}`;
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: HOSTEL_DAILY_DUE_TEMPLATE_KEY,
          userId: parseInt(selectedUserId, 10),
          active: true,
        }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Failed to assign: ${res.status}`);
      setSuccess("Hostel incharge assigned successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutateAssignments();
      setSelectedUserId("");
    } catch (err) {
      setError(`Error assigning hostel incharge: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignHA = async () => {
    if (!selectedHAUserId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: HOSTEL_DAILY_DUE_TEMPLATE_KEY,
          userId: parseInt(selectedHAUserId, 10),
          active: true,
        }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Failed to assign: ${res.status}`);
      setSuccess("Hostel higher authority assigned successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutateAssignments();
      setSelectedHAUserId("");
    } catch (err) {
      setError(`Error assigning hostel higher authority: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAssignment = async (assignmentId, currentActive) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: parseInt(assignmentId, 10),
          active: !currentActive,
        }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Failed to update: ${res.status}`);
      setSuccess(`Assignment ${!currentActive ? "activated" : "deactivated"} successfully!`);
      setTimeout(() => setSuccess(""), 3000);
      await mutateAssignments();
    } catch (err) {
      setError(`Error updating assignment: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activeAssignments = assignments.filter((a) => a.active);
  const inactiveAssignments = assignments.filter((a) => !a.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">Hostel Daily Due Report</h1>
        <p className="text-sm text-gray-600">
          Manage the daily hostel due report template and assign hostel incharges and higher authorities to handle reports.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Report Template</h2>
          <p className="text-sm text-gray-600">
            Columns: SN, Particulars, Any Student Involved (select), Action, Auth Sign
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Template Status
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {template ? (template.active ? "Active" : "Inactive") : "Missing"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Frequency
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Daily</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Updated
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {template?.updatedAt ? formatDate(template.updatedAt) : "—"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Assign Hostel Incharge</h2>
          <p className="text-sm text-gray-600">
            Select a hostel incharge to assign this daily report. They will fill it through Managers Club.
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3">
            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1"
            >
              <option value="">Select Hostel Incharge</option>
              {hostelIncharges.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayText(user)}
                </option>
              ))}
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || saving}
              className="px-4 py-2"
            >
              {saving ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Assign Hostel Higher Authority</h2>
          <p className="text-sm text-gray-600">
            Select a hostel higher authority to handle escalated reports and complete assigned reports.
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3">
            <Select
              value={selectedHAUserId}
              onChange={(e) => setSelectedHAUserId(e.target.value)}
              className="flex-1"
            >
              <option value="">Select Hostel Higher Authority</option>
              {hostelAuthorities.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayText(user)}
                </option>
              ))}
            </Select>
            <Button
              onClick={handleAssignHA}
              disabled={!selectedHAUserId || saving}
              className="px-4 py-2"
            >
              {saving ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Current Assignments</h2>
          <p className="text-sm text-gray-600">
            Hostel incharges assigned to fill the daily due report.
          </p>
        </CardHeader>
        <CardBody>
          {activeAssignments.length === 0 && inactiveAssignments.length === 0 ? (
            <p className="text-sm text-gray-500">No assignments yet.</p>
          ) : (
            <div className="space-y-4">
              {activeAssignments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Active Assignments</h3>
                  <div className="space-y-2">
                    {activeAssignments.map((assignment) => {
                      const user = users.find((u) => u.id === assignment.userId);
                      return (
                        <div key={assignment.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div>
                            <p className="font-semibold text-green-900">{user?.name || "Unknown User"}</p>
                            <p className="text-sm text-green-700">{user?.email || ""}</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleToggleAssignment(assignment.id, assignment.active)}
                            disabled={saving}
                          >
                            Deactivate
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {inactiveAssignments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Inactive Assignments</h3>
                  <div className="space-y-2">
                    {inactiveAssignments.map((assignment) => {
                      const user = users.find((u) => u.id === assignment.userId);
                      return (
                        <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div>
                            <p className="font-semibold text-gray-900">{user?.name || "Unknown User"}</p>
                            <p className="text-sm text-gray-700">{user?.email || ""}</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleToggleAssignment(assignment.id, assignment.active)}
                            disabled={saving}
                          >
                            Reactivate
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}