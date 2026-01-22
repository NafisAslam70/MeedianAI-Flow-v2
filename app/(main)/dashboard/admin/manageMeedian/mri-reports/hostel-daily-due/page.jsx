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
    () => users.filter((user) => user.active !== false),
    [users]
  );

  const hostelAdmins = useMemo(
    () =>
      users.filter(
        (user) =>
          user.active !== false &&
          (user.role === "admin" ||
            (user.role === "team_manager" && user.team_manager_type !== "hostel_incharge"))
      ),
    [users]
  );

  const schoolOfficeUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.active !== false &&
          (user.role === "admin" || user.role === "team_manager")
      ),
    [users]
  );

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedHostelAdminId, setSelectedHostelAdminId] = useState("");
  const [selectedSchoolOfficeId, setSelectedSchoolOfficeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  const handleToggleAssignment = async (assignmentId, currentActive) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: parseInt(assignmentId, 10),
        }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Failed to delete: ${res.status}`);
      setSuccess("Assignment removed successfully!");
      setTimeout(() => setSuccess(""), 3000);
      await mutateAssignments();
      setConfirmDelete(null);
    } catch (err) {
      setError(`Error removing assignment: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">Hostel Daily Due Report</h1>
        <p className="text-sm text-gray-600">
          Manage the daily hostel due report template and assign hostel incharges to fill the report daily.
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
          <h2 className="text-base font-semibold text-gray-900">Assign Hostel Admin</h2>
          <p className="text-sm text-gray-600">
            Select hostel admins who can review and complete hostel due reports assigned to them by incharges.
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3">
            <Select
              value={selectedHostelAdminId}
              onChange={(e) => setSelectedHostelAdminId(e.target.value)}
              className="flex-1"
            >
              <option value="">Select Hostel Admin</option>
              {hostelAdmins.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayText(user)}
                </option>
              ))}
            </Select>
            <Button
              onClick={async () => {
                if (!selectedHostelAdminId) return;
                setSaving(true);
                setError("");
                setSuccess("");
                try {
                  const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      templateKey: HOSTEL_DAILY_DUE_TEMPLATE_KEY,
                      userId: parseInt(selectedHostelAdminId, 10),
                      active: true,
                      role: "hostel_admin",
                    }),
                  });
                  const responseData = await res.json();
                  if (!res.ok) throw new Error(responseData.error || `Failed to assign: ${res.status}`);
                  setSuccess("Hostel admin assigned successfully!");
                  setTimeout(() => setSuccess(""), 3000);
                  await mutateAssignments();
                  setSelectedHostelAdminId("");
                } catch (err) {
                  setError(`Error assigning hostel admin: ${err.message}`);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={!selectedHostelAdminId || saving}
              className="px-4 py-2"
            >
              {saving ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Assign School Office</h2>
          <p className="text-sm text-gray-600">
            Select school office users who can handle hostel issues transferred by hostel admins.
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3">
            <Select
              value={selectedSchoolOfficeId}
              onChange={(e) => setSelectedSchoolOfficeId(e.target.value)}
              className="flex-1"
            >
              <option value="">Select School Office</option>
              {schoolOfficeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayText(user)}
                </option>
              ))}
            </Select>
            <Button
              onClick={async () => {
                if (!selectedSchoolOfficeId) return;
                setSaving(true);
                setError("");
                setSuccess("");
                try {
                  const res = await fetch("/api/admin/manageMeedian?section=mriReportAssignments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      templateKey: HOSTEL_DAILY_DUE_TEMPLATE_KEY,
                      userId: parseInt(selectedSchoolOfficeId, 10),
                      active: true,
                      role: "school_office",
                    }),
                  });
                  const responseData = await res.json();
                  if (!res.ok) throw new Error(responseData.error || `Failed to assign: ${res.status}`);
                  setSuccess("School office assigned successfully!");
                  setTimeout(() => setSuccess(""), 3000);
                  await mutateAssignments();
                  setSelectedSchoolOfficeId("");
                } catch (err) {
                  setError(`Error assigning school office: ${err.message}`);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={!selectedSchoolOfficeId || saving}
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
          <p className="text-sm text-gray-600">Overview of all assigned Hostel Incharges, Hostel Admins, and School Office.</p>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {/* Hostel Incharges Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">HI</span>
                Hostel Incharges
              </h3>
              {(() => {
                const hiAssignments = assignments.filter(
                  (a) =>
                    !a.role ||
                    a.role === "hostel_incharge" ||
                    (a.role !== "hostel_admin" && a.role !== "hostel_authority" && a.role !== "school_office")
                );

                return (
                  <div className="space-y-3">
                    {hiAssignments.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No hostel incharges assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {hiAssignments.map((assignment) => {
                          const user = users.find((u) => u.id === assignment.userId);
                          return (
                            <div key={assignment.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div>
                                <p className="font-medium text-blue-900">{user?.name || "Unknown User"}</p>
                                <p className="text-xs text-blue-700">{user?.email || ""}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">Active</span>
                                {confirmDelete?.id === assignment.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-700">Remove?</span>
                                    <Button
                                      size="sm"
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      onClick={() => handleToggleAssignment(assignment.id, assignment.active)}
                                      disabled={saving}
                                    >
                                      Yes
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setConfirmDelete(null)}
                                      disabled={saving}
                                    >
                                      No
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setConfirmDelete({ id: assignment.id, name: user?.name })}
                                    disabled={saving}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Hostel Admins Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">HA</span>
                Hostel Admins
              </h3>
              {(() => {
                const haAssignments = assignments.filter(
                  (a) => a.role === "hostel_admin" || a.role === "hostel_authority"
                );

                return (
                  <div className="space-y-3">
                    {haAssignments.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No hostel higher authorities assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {haAssignments.map((assignment) => {
                          const user = users.find((u) => u.id === assignment.userId);
                          return (
                            <div key={assignment.id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <div>
                                <p className="font-medium text-purple-900">{user?.name || "Unknown User"}</p>
                                <p className="text-xs text-purple-700">{user?.email || ""}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded">Active</span>
                                {confirmDelete?.id === assignment.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-700">Remove?</span>
                                    <Button
                                      size="sm"
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      onClick={() => handleToggleAssignment(assignment.id, assignment.active)}
                                      disabled={saving}
                                    >
                                      Yes
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setConfirmDelete(null)}
                                      disabled={saving}
                                    >
                                      No
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setConfirmDelete({ id: assignment.id, name: user?.name })}
                                    disabled={saving}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* School Office Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">SO</span>
                School Office
              </h3>
              {(() => {
                const officeAssignments = assignments.filter((a) => a.role === "school_office");

                return (
                  <div className="space-y-3">
                    {officeAssignments.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No school office users assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {officeAssignments.map((assignment) => {
                          const user = users.find((u) => u.id === assignment.userId);
                          return (
                            <div key={assignment.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <div>
                                <p className="font-medium text-amber-900">{user?.name || "Unknown User"}</p>
                                <p className="text-xs text-amber-700">{user?.email || ""}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">Active</span>
                                {confirmDelete?.id === assignment.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-700">Remove?</span>
                                    <Button
                                      size="sm"
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      onClick={() => handleToggleAssignment(assignment.id, assignment.active)}
                                      disabled={saving}
                                    >
                                      Yes
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setConfirmDelete(null)}
                                      disabled={saving}
                                    >
                                      No
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setConfirmDelete({ id: assignment.id, name: user?.name })}
                                    disabled={saving}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
