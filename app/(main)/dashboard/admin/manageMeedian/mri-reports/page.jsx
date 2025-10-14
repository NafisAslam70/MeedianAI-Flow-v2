"use client";

import { useMemo } from "react";
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

export default function ManageMriReportsPage() {
  const router = useRouter();

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

  const templates = templateData?.templates || [];
  const assignments = assignmentData?.assignments || [];

  const ptTemplate = useMemo(
    () => templates.find((tpl) => tpl.key === PT_TEMPLATE_KEY),
    [templates]
  );

  const assignmentCount = assignments.length;
  const activeAssignments = assignments.filter((assignment) => assignment.active).length;
  const templateStatus = ptTemplate ? (ptTemplate.active ? "Active" : "Inactive") : "Missing";
  const lastUpdated = ptTemplate?.updatedAt
    ? format(new Date(ptTemplate.updatedAt), "yyyy-MM-dd")
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">MRI Reports</h1>
        <p className="text-sm text-gray-600">
          Overview of MRI report templates. Open a report to manage templates, assignments, and
          supporting data.
        </p>
      </div>

      {(templateError || assignmentError) && (
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
    </div>
  );
}
