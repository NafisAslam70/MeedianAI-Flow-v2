"use client";

import Link from "next/link";
import { ClipboardList, NotebookPen, ClipboardCheck, UserPlus, Boxes } from "lucide-react";

const CLUB_TOOLS = [
  {
    key: "guardian-register",
    label: "Guardian & Visitor Register",
    icon: ClipboardList,
    href: "/dashboard/managersCommon/guardian-register",
  },
  {
    key: "pt-assist",
    label: "CCD / CDD Help",
    icon: NotebookPen,
    href: "/dashboard/managersCommon/pt-assist",
  },
  {
    key: "routine-tasks",
    label: "Routine Tasks",
    icon: ClipboardCheck,
    href: "/dashboard/managersCommon/routineTasks",
  },
  {
    key: "recruit",
    label: "Recruit",
    icon: UserPlus,
    href: "https://meed-recruitment.onrender.com/login",
    external: true,
  },
  {
    key: "resources",
    label: "Resources",
    icon: Boxes,
    href: "/dashboard/managersCommon/resources",
  },
];

export default function ManagerialClubPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Managerial Club</h1>
        <p className="text-sm text-slate-600">
          Quick access to the Club tools that were previously grouped in the Managerial sheet.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Club tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CLUB_TOOLS.map(({ key, label, icon: Icon, href, external }) => {
            const inner = (
              <span className="flex flex-col items-start gap-2">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700">
                  <Icon size={20} />
                </span>
                <span className="text-sm font-medium text-slate-900">{label}</span>
              </span>
            );

            if (external) {
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
                >
                  {inner}
                </a>
              );
            }

            return (
              <Link
                key={key}
                href={href}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
