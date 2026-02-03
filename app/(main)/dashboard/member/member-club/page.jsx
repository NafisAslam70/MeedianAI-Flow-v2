"use client";

import useSWR from "swr";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

const FEATURES = [
  {
    key: "guardianGateLogs",
    label: "Guardian & Visitor Register",
    description: "Log guardian/visitor entries and queues.",
    href: "/dashboard/managersCommon/guardian-register",
  },
  {
    key: "guardianCalls",
    label: "Guardian Call Log",
    description: "Log and review guardian calls.",
    href: "/dashboard/managersCommon/guardian-calls",
  },
  {
    key: "grm",
    label: "Guardian Relationship Manager",
    description: "King's Place for guardian follow-ups.",
    href: "/dashboard/managersCommon/guardian-relationship",
  },
  {
    key: "ptAssist",
    label: "CCD / CDD Help",
    description: "Access CCD/CDD help scripts and checklists.",
    href: "/dashboard/managersCommon/pt-assist",
  },
  {
    key: "hostelDueReport",
    label: "Hostel Due Report",
    description: "View hostel due report summaries.",
    href: "/dashboard/managersCommon/reports",
  },
  {
    key: "studentsRead",
    label: "Student Register (Read-only)",
    description: "View student registry without edits.",
    href: "/dashboard/member/student-register",
  },
  {
    key: "mgcpLeads",
    label: "Student Enquiry",
    description: "Log admission enquiries (Random Leads).",
    href: "/dashboard/managersCommon/student-enquiry",
  },
];

export default function MemberClubPage() {
  const { data } = useSWR("/api/admin/manageMeedian?section=memberClubShareSelf", fetcher);
  const grants = data?.grants || [];
  const grantSet = new Set(grants.map((g) => g.section));
  const allowed = FEATURES.filter((f) => grantSet.has(f.key));

  return (
    <div className="p-4 space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
          <Sparkles className="h-4 w-4" />
          Member Club
        </div>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Your shared tools</h1>
        <p className="text-sm text-slate-500">Admin-assigned tools for non-managers.</p>
      </header>

      {allowed.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {allowed.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{item.label}</h2>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
              </div>
              <p className="mt-2 text-xs text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No Member Club tools assigned yet. Ask admin to enable access.
        </div>
      )}
    </div>
  );
}
