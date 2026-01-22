"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { format } from "date-fns";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const PT_TEMPLATE_KEY = "pt_daily_report";
const PHONE_CALL_TEMPLATE_KEY = "phone_call_drive";
const HOSTEL_DAILY_DUE_TEMPLATE_KEY = "hostel_daily_due_report";

export default function ManageMriReportsPage() {
  const router = useRouter();
  const [selectedAdManagers, setSelectedAdManagers] = useState([]);
  const [savingAdAssignments, setSavingAdAssignments] = useState(false);
  const [adAssignmentMessage, setAdAssignmentMessage] = useState("");

  const { data: templateData, error: templateError } = useSWR(
    "/api/admin/manageMeedian?section=mriReportTemplates",
    fetcher,
    { dedupingInterval: 30000 }
  );
  const { data: assignmentData, error: assignmentError } = useSWR(
    `/api/admin/manageMeedian?section=mriReportAssignments&templateKey=${PT_TEMPLATE_KEY}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const { data: phoneAssignmentData, error: phoneAssignmentError } = useSWR(
    `/api/admin/manageMeedian?section=mriReportAssignments&templateKey=${PHONE_CALL_TEMPLATE_KEY}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const { data: hostelAssignmentData, error: hostelAssignmentError } = useSWR(
    `/api/admin/manageMeedian?section=mriReportAssignments&templateKey=${HOSTEL_DAILY_DUE_TEMPLATE_KEY}`,
    fetcher,
    { dedupingInterval: 15000 }
  );
  const { data: adAssignmentsData, error: adAssignmentsError, mutate: mutateAdAssignments } = useSWR(
    "/api/admin/manageMeedian?section=adTrackerAssignments",
    fetcher,
    { dedupingInterval: 30000 }
  );

  const templates = templateData?.templates || [];
  const assignments = assignmentData?.assignments || [];
  const phoneAssignments = phoneAssignmentData?.assignments || [];
  const hostelAssignments = hostelAssignmentData?.assignments || [];

  const ptTemplate = useMemo(
    () => templates.find((tpl) => tpl.key === PT_TEMPLATE_KEY),
    [templates]
  );
  const phoneTemplate = useMemo(
    () => templates.find((tpl) => tpl.key === PHONE_CALL_TEMPLATE_KEY),
    [templates]
  );
  const hostelTemplate = useMemo(
    () => templates.find((tpl) => tpl.key === HOSTEL_DAILY_DUE_TEMPLATE_KEY),
    [templates]
  );
  const adManagers = useMemo(() => adAssignmentsData?.managers || [], [adAssignmentsData?.managers]);
  const adGrantedIds = useMemo(() => adAssignmentsData?.granted || [], [adAssignmentsData?.granted]);

  useEffect(() => {
    setSelectedAdManagers(adGrantedIds);
  }, [adGrantedIds.join(",")]);

  const assignmentCount = assignments.length;
  const activeAssignments = assignments.filter((assignment) => assignment.active).length;
  const templateStatus = ptTemplate ? (ptTemplate.active ? "Active" : "Inactive") : "Missing";
  const lastUpdated = ptTemplate?.updatedAt
    ? format(new Date(ptTemplate.updatedAt), "yyyy-MM-dd")
    : "—";

  const phoneAssignmentCount = phoneAssignments.length;
  const phoneActiveAssignments = phoneAssignments.filter((assignment) => assignment.active).length;
  const phoneTemplateStatus = phoneTemplate ? (phoneTemplate.active ? "Active" : "Inactive") : "Missing";
  const phoneLastUpdated = phoneTemplate?.updatedAt
    ? format(new Date(phoneTemplate.updatedAt), "yyyy-MM-dd")
    : "—";

  const hostelAssignmentCount = hostelAssignments.length;
  const hostelActiveAssignments = hostelAssignments.filter((assignment) => assignment.active).length;
  const hostelTemplateStatus = hostelTemplate ? (hostelTemplate.active ? "Active" : "Inactive") : "Missing";
  const hostelLastUpdated = hostelTemplate?.updatedAt
    ? format(new Date(hostelTemplate.updatedAt), "yyyy-MM-dd")
    : "—";

  const toggleAdManager = (userId) => {
    setSelectedAdManagers((prev) => {
      const exists = prev.includes(userId);
      if (exists) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleSaveAdAssignments = async () => {
    setSavingAdAssignments(true);
    setAdAssignmentMessage("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=adTrackerAssignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedAdManagers }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      setAdAssignmentMessage("AD tracker access updated.");
      await mutateAdAssignments();
    } catch (error) {
      console.error(error);
      setAdAssignmentMessage(error.message || "Failed to save AD tracker access.");
    } finally {
      setSavingAdAssignments(false);
      setTimeout(() => setAdAssignmentMessage(""), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">MRI Reports</h1>
        <p className="text-sm text-gray-600">
          Overview of MRI report templates. Open a report to manage templates, assignments, and
          supporting data.
        </p>
      </div>

      {(templateError || assignmentError || phoneAssignmentError || hostelAssignmentError || adAssignmentsError) && (
        <p className="text-sm text-red-600">
          Failed to load report data. Refresh the page or check API logs.
        </p>
      )}

      <Card>
      	<CardHeader>
      	  <h2 className="text-base font-semibold text-gray-900">PT Daily Report</h2>
      	  <p className="text-sm text-gray-600">
      	    Parent Teacher (Class Teacher) daily MRI register capturing CDD and CCD updates.
          </p>
      	</CardHeader>
      	<CardBody>
      	  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
      	    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Template Status
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{templateStatus}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Active Assignments
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {activeAssignments} of {assignmentCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Updated
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{lastUpdated}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports/pt")}>
              Manage PT Daily Report
            </Button>
          </div>
      	</CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Guardian Phone Call Drive</h2>
          <p className="text-sm text-gray-600">
            Coordinate outbound phone call campaigns by assigning call briefs, targets, and deadlines to office teams.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Template Status
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{phoneTemplateStatus}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Active Campaigns
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {phoneActiveAssignments} of {phoneAssignmentCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Updated
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{phoneLastUpdated}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports/phone-calls")}>
              Manage Phone Call Drives
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Hostel Daily Due Report</h2>
          <p className="text-sm text-gray-600">
            Daily report by hostel incharge tracking dues, student involvement, actions taken, and authorization signatures.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Template Status
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{hostelTemplateStatus}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Active Assignments
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {hostelActiveAssignments} of {hostelAssignmentCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Updated
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{hostelLastUpdated}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports/hostel-daily-due")}>
              Manage Hostel Daily Due Report
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Academic Health Report</h2>
          <p className="text-sm text-gray-600">
            Evening dean report covering Slot 12 supervision, MHCP-2 conductance, deanship work, and shutdown actions.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Autosave</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Enabled</p>
              <p className="text-xs text-gray-500">Drafts persist every few seconds while the dean fills the form.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Data Pulls</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Attendance, escalations</p>
              <p className="text-xs text-gray-500">Fetches tonight’s MOP2 scan, open escalations, and member rosters.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status Workflow</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Draft → Submit → Approve/Reopen</p>
              <p className="text-xs text-gray-500">Managers can approve or reopen submissions for follow-up.</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports/academic-health")}>
              Open Academic Health Report
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Daily Gate Logs</h2>
          <p className="text-sm text-gray-600">
            Monitor team member gate scans and maintain guardian/visitor in-out registers from a single console.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team logs</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">QR driven</p>
              <p className="text-xs text-gray-500">Members scan OUT with a reason and IN on return.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Guardian ledger</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Manual entry</p>
              <p className="text-xs text-gray-500">Digitise the visitors register with quick forms.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Access control</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Grant by section</p>
              <p className="text-xs text-gray-500">Limit entry to designated office assistants.</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.push("/dashboard/admin/manageMeedian/daily-reports/gate-logs")}>
              Open Daily Gate Logs
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">AD Tracker Access</h2>
          <p className="text-sm text-gray-600">
            Choose which managers can log AD entries from the Managerial Club. Admins always have access.
          </p>
        </CardHeader>
        <CardBody>
          {adManagers.length === 0 ? (
            <p className="text-sm text-gray-600">No active managers found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adManagers.map((manager) => {
                const selected = selectedAdManagers.includes(manager.id);
                return (
                  <label
                    key={manager.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selected ? "border-teal-200 bg-teal-50/40" : "border-gray-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleAdManager(manager.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-gray-900">{manager.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveAdAssignments} disabled={savingAdAssignments}>
              {savingAdAssignments ? "Saving..." : "Save AD tracker access"}
            </Button>
            {adAssignmentMessage && (
              <span className="text-sm text-gray-600">{adAssignmentMessage}</span>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
