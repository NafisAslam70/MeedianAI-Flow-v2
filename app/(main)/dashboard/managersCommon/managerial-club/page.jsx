"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  NotebookPen,
  ClipboardCheck,
  UserPlus,
  Boxes,
  CalendarCheck2,
  CalendarX2,
  ArrowRight,
} from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((response) => {
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  });

export default function ManagerialClubPage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";

  const { data: escalationData } = useSWR("/api/managersCommon/escalations?section=counts", fetcher);
  const { data: ticketsData } = useSWR("/api/managersCommon/tickets?view=queue", fetcher);
  const { data: dayCloseCounts } = useSWR("/api/managersCommon/dayCloseRequests?section=counts", fetcher);
  const { data: leaveData } = useSWR("/api/managersCommon/approve-leave-request", fetcher);

  const openEscalations = useMemo(() => {
    if (!escalationData) return 0;
    return role === "admin" ? (escalationData.openTotalCount ?? 0) : (escalationData.forYouCount ?? 0);
  }, [escalationData, role]);

  const openTickets = useMemo(() => {
    if (!ticketsData?.statusSummary) return 0;
    return Object.entries(ticketsData.statusSummary).reduce((acc, [status, count]) => {
      const normalized = String(status).toLowerCase();
      if (normalized === "resolved" || normalized === "closed") return acc;
      return acc + Number(count || 0);
    }, 0);
  }, [ticketsData]);

  const pendingDayClose = dayCloseCounts?.pendingCount ?? 0;
  const pendingLeaves = useMemo(() => {
    if (!Array.isArray(leaveData?.requests)) return 0;
    return leaveData.requests.filter((request) => String(request.status || "").toLowerCase() === "pending").length;
  }, [leaveData]);

  const quickActions = [
    {
      key: "escalations",
      title: "Escalations",
      description: "Raise, act, and review matters",
      href: "/dashboard/managersCommon/escalations",
      icon: AlertTriangle,
      badge: openEscalations,
    },
    {
      key: "tickets",
      title: "Support Tickets",
      description: "Open and pending tickets",
      href: "/dashboard/managersCommon/tickets",
      icon: MessageSquare,
      badge: openTickets,
    },
    {
      key: "assign-task",
      title: "Assign Task",
      description: "Create & dispatch tasks",
      href: "/dashboard/managersCommon/assignTask",
      icon: ClipboardCheck,
    },
    {
      key: "day-close",
      title: "Day Close Requests",
      description: "Review and approve day closures",
      href: "/dashboard/managersCommon/approveCloseDay",
      icon: CalendarCheck2,
      badge: pendingDayClose,
    },
    {
      key: "leave",
      title: "Leave Requests",
      description: "Pending approvals",
      href: "/dashboard/managersCommon/approveLeave",
      icon: CalendarX2,
      badge: pendingLeaves,
    },
    {
      key: "attendance",
      title: "Daily Attendance Report",
      description: "View and export present/absent lists",
      href: "/dashboard/managersCommon/attendance-report",
      icon: ClipboardList,
    },
  ];

  const clubTiles = [
    {
      key: "pt-reports",
      label: "PT Daily Reports",
      icon: ClipboardList,
      href: "/dashboard/admin/manageMeedian/mri-reports/pt",
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Managerial Club</h1>
        <p className="text-sm text-slate-600">
          One place to handle escalations, approvals, and supporting tools for your daily coordination.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Priority workflows</h2>
        <div className="grid gap-3">
          {quickActions.map(({ key, title, description, href, icon: Icon, badge }) => (
            <Link
              key={key}
              href={href}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <Icon size={20} />
                </span>
                <div>
                  <div className="font-medium text-slate-900">{title}</div>
                  <p className="text-sm text-slate-600">{description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {typeof badge === "number" && (
                  <span className="inline-flex min-w-[36px] justify-center rounded-full bg-teal-600 px-2 py-1 text-xs font-semibold text-white">
                    {badge}
                  </span>
                )}
                <ArrowRight
                  size={18}
                  className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-600"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Club tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubTiles.map(({ key, label, icon: Icon, href, external }) => {
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

      {(role === "admin" || role === "team_manager") && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin tools</h2>
          <Link
            href="/dashboard/admin/manageMeedian"
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700">
                <Boxes size={20} />
              </span>
              <div>
                <div className="font-medium text-slate-900">Manage Meedian</div>
                <p className="text-sm text-slate-600">Open the admin sidebar for advanced configuration</p>
              </div>
            </div>
            <ArrowRight
              size={18}
              className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-600"
            />
          </Link>
        </section>
      )}
    </div>
  );
}
