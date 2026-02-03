"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo } from "react";
import { ShieldCheck, BarChart2, Activity } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => res.json());

export default function AdminClubHome() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin";

  const { data: managerGrants } = useSWR(
    role === "team_manager" ? "/api/admin/manageMeedian?section=controlsShareSelf" : null,
    fetcher,
    { dedupingInterval: 60_000 }
  );

  const adminClubGrant = useMemo(() => {
    if (role !== "team_manager") return false;
    if (!managerGrants) return null;
    return (managerGrants.grants || []).some(
      (grant) => grant.section === "adminClub" && grant.canWrite !== false
    );
  }, [role, managerGrants]);

  const accessLoading = status === "loading" || (role === "team_manager" && adminClubGrant === null);

  const cards = [
    {
      key: "academic-health",
      title: "AHR Pulse",
      description:
        "Audit Academic Health Report completion, spot missing days, and scan daily health signals at a glance.",
      href: "/dashboard/admin/admin-club/academic-health",
      icon: Activity,
      requiresGrant: true,
    },
    {
      key: "analyse-team",
      title: "Analyse Meed / Team",
      description:
        "Dive into PT completion, campus gate movement, MRI journals, and attendance pulse — the complete daily leadership dashboard.",
      href: "/dashboard/admin/admin-club/analyse-team",
      icon: BarChart2,
      requiresGrant: true,
    },
    {
      key: "analyse-class",
      title: "Analyse Class",
      description:
        "Pick a class, review CCD/CDD capture trends, and drill into students. Start with PT daily report signals.",
      href: "/dashboard/admin/admin-club/analyse-class",
      icon: ShieldCheck,
      requiresGrant: true,
    },
  ];

  const resolveAllowed = (card) => {
    if (isAdmin) return true;
    if (role !== "team_manager") return false;
    if (!card.requiresGrant) return true;
    return adminClubGrant === true;
  };

  if (accessLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Loading access…</p>
      </div>
    );
  }

  const cardGrid = cards.map((card) => {
    const allowed = resolveAllowed(card);
    const Icon = card.icon || ShieldCheck;
    const content = (
      <div
        className={`flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition ${
          allowed ? "hover:border-teal-200 hover:shadow-md" : "opacity-60"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Icon size={20} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
            <p className="text-xs text-slate-500">
              {allowed
                ? card.description
                : "Access not shared yet. Ask an admin to enable this control for you in Manage Meedian → Controls Share."}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <span
            className={`inline-flex items-center gap-2 text-xs font-medium ${
              allowed ? "text-teal-600" : "text-slate-400"
            }`}
          >
            View details →
          </span>
        </div>
      </div>
    );

    if (!allowed) {
      return (
        <button
          key={card.key}
          type="button"
          className="text-left"
          onClick={() => window.alert("You are not allowed for this")}
        >
          {content}
        </button>
      );
    }

    return (
      <Link key={card.key} href={card.href} className="block">
        {content}
      </Link>
    );
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-6 md:space-y-0">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
            <ShieldCheck size={16} />
            {isAdmin ? "Admin Only" : "Shared Access"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Admin Club</h1>
          <p className="mt-1 text-sm text-slate-600">
            Central hub for leadership analysis. Pick a workspace to continue.
          </p>
        </div>
      </header>

      <section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cardGrid}</div>
      </section>
    </div>
  );
}
