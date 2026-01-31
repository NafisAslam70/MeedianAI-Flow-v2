"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  NotebookPen,
  PhoneCall,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

const CLUB_TOOLS = [
  {
    key: "guardian-register",
    label: "Guardian & Visitor Register",
    description: "Log visitors, guardians, and handovers without the paper chase.",
    icon: ClipboardList,
    accent: "from-sky-500/90 via-cyan-500/85 to-emerald-400/90",
    href: "/dashboard/managersCommon/guardian-register",
  },
  {
    key: "guardian-calls",
    label: "Guardian Call Log",
    description: "Track call outcomes and callbacks to keep guardians in the loop.",
    icon: PhoneCall,
    accent: "from-fuchsia-500/90 via-violet-500/85 to-indigo-500/85",
    href: "/dashboard/managersCommon/guardian-calls",
  },
  {
    key: "guardian-relationship",
    label: "Guardian Relationship Manager",
    description: "Mini-CRM for touchpoints, notes, and next steps with guardians.",
    icon: Users,
    accent: "from-amber-400/90 via-orange-400/85 to-rose-500/85",
    href: "/dashboard/managersCommon/guardian-relationship",
    isNew: true,
  },
  {
    key: "student-enquiry",
    label: "Student Enquiry",
    description: "Log admission enquiry calls; auto-convert to MGCP random leads.",
    icon: UserPlus,
    accent: "from-emerald-500/90 via-teal-500/85 to-cyan-400/90",
    href: "/dashboard/managersCommon/student-enquiry",
    isNew: true,
  },
  {
    key: "pt-assist",
    label: "CCD / CDD Help",
    description: "Checklists, scripts, and playbooks for CCD / CDD support.",
    icon: NotebookPen,
    accent: "from-emerald-500/90 via-teal-500/85 to-cyan-400/90",
    href: "/dashboard/managersCommon/pt-assist",
  },
  {
    key: "routine-tasks",
    label: "Routine Tasks",
    description: "Daily rituals and SOPs, ready to tick off in seconds.",
    icon: ClipboardCheck,
    accent: "from-indigo-500/90 via-blue-500/85 to-cyan-400/85",
    href: "/dashboard/managersCommon/routineTasks",
  },
  {
    key: "ads",
    label: "AD Tracker",
    description: "Flag anomalies, follow through, and keep everyone accountable.",
    icon: AlertTriangle,
    accent: "from-rose-500/90 via-red-500/85 to-orange-400/85",
    href: "/dashboard/managersCommon/ads",
    isNew: true,
  },
  {
    key: "hostel-due-report",
    label: "Hostel Due Report",
    description: "Live hostel dues with quick filters and export-ready views.",
    icon: FileText,
    accent: "from-cyan-500/90 via-teal-500/85 to-emerald-400/85",
    href: "/dashboard/managersCommon/reports",
    isNew: true,
  },
  {
    key: "recruitment-pro",
    label: "Meed Recruitment",
    description: "Pipeline view for Meed leads, interviews, and conversions.",
    icon: UserPlus,
    accent: "from-blue-500/90 via-sky-500/85 to-cyan-400/85",
    href: "/dashboard/managersCommon/recruitment-pro",
    isNew: true,
  },
  {
    key: "resources",
    label: "Resources",
    description: "All the SOPs, files, and decks your team needs at hand.",
    icon: Boxes,
    accent: "from-slate-600/90 via-slate-700/85 to-slate-900/85",
    href: "/dashboard/managersCommon/resources",
  },
  {
    key: "student-register",
    label: "Student Register",
    description: "Roster, quick lookups, and one-click student actions.",
    icon: GraduationCap,
    accent: "from-purple-500/90 via-violet-500/85 to-fuchsia-500/85",
    href: "/dashboard/admin/students",
  },
];

export default function ManagerialClubPage() {
  return (
    <div className="space-y-10 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 shadow-2xl">
        <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-14 h-52 w-52 rounded-full bg-emerald-400/25 blur-3xl" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3 text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 ring-1 ring-white/15">
              <Sparkles size={14} />
              Managerial Club
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Leadership tools, ready on one canvas</h1>
            <p className="max-w-2xl text-sm text-slate-200/80 md:text-base">
              Jump into the daily operating kit for managers. Everything from guardian follow-ups to recruitment and resources
              now lives in a responsive, touch-friendly deck of cards.
            </p>
            <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-100">
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/10">Responsive · Mobile first</span>
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/10">Lucide icons</span>
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/10">Hover & tap feedback</span>
            </div>
          </div>

          <Link
            href="/dashboard/managersCommon"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Open my dashboard
            <ArrowUpRight className="transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          <Sparkles size={16} className="text-amber-500" />
          <span>Club tools</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CLUB_TOOLS.map(({ key, label, description, icon: Icon, href, external, accent, isNew }) => {
            const CardInner = (
              <span
                className="relative block overflow-hidden rounded-2xl border border-slate-100/80 bg-white/80 p-5 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.6)] backdrop-blur-md transition duration-300 ease-out group hover:-translate-y-1 hover:border-transparent hover:shadow-[0_28px_70px_-24px_rgba(14,165,233,0.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <span className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen transition duration-300 group-hover:opacity-100">
                  <span className={`absolute inset-0 bg-gradient-to-br ${accent} blur-3xl`} />
                </span>

                {isNew && (
                  <span
                    className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 via-emerald-300 to-cyan-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-300/80"
                    style={{ backgroundSize: "240% 240%", animation: "flag-sheen 2s ease-in-out infinite" }}
                  >
                    <Sparkles size={12} className="text-emerald-900 drop-shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
                    New
                  </span>
                )}

                <span className="relative flex items-start gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg ring-2 ring-white/70 transition duration-300 group-hover:rotate-1 group-hover:scale-105`}>
                    <Icon size={22} />
                  </span>
                </span>

                <span className="relative mt-4 space-y-2">
                  <span className="block text-base font-semibold text-slate-900">{label}</span>
                  <span className="block text-sm leading-relaxed text-slate-600">{description}</span>
                </span>
              </span>
            );

            if (external) {
              return (
                <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="group">
                  {CardInner}
                </a>
              );
            }

            return (
              <Link key={key} href={href} className="group">
                {CardInner}
              </Link>
            );
          })}
        </div>
      </section>
      <style jsx global>{`
        @keyframes flag-sheen {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}
