"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users, GraduationCap, Boxes, CalendarDays, Workflow } from "lucide-react";
import useSWR from "swr";

const groups = [
	{
		title: "Calendar",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/calendar",
				label: "School Calendar",
				icon: CalendarDays,
			},
		],
	},
	{
		title: "MRI, Codes & Roles",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/mri-roles",
				label: "MRI & Roles",
				icon: Workflow,
			},
			{
				href: "/dashboard/admin/manageMeedian/mri-programs",
				label: "Program Design",
				icon: Boxes,
			},
			{
				href: "/dashboard/admin/manageMeedian/msp-codes",
				label: "MSP Codes",
				icon: Boxes,
			},
			{
				href: "/dashboard/admin/manageMeedian/class-teachers",
				label: "Class Teachers",
				icon: Users,
			},
		],
	},
	{
		title: "Team",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/team",
				label: "Manage Team",
				icon: Users,
			},
		],
	},
	// Programs rendered dynamically; Academics excludes Slots/TOD
	{
		title: "Academics",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/students",
				label: "Students",
				icon: GraduationCap,
			},
		],
	},
];

export default function AdminSidebar() {
	const pathname = usePathname();
	const { data: session } = useSession();
	// Only rail navigation is shown now

	const fetcher = (u) =>
		fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());
	const { data: progData } = useSWR(
		"/api/admin/manageMeedian?section=metaPrograms",
		fetcher,
		{ dedupingInterval: 30000 }
	);
  const { data: myGrants } = useSWR(
    "/api/admin/manageMeedian?section=controlsShareSelf",
    fetcher,
    { dedupingInterval: 30000 }
  );
	const programs = React.useMemo(
		() =>
			(progData?.programs || []).slice().sort((a, b) =>
				String(a.programKey).localeCompare(String(b.programKey))
			),
		[progData]
	);

	const railItems = React.useMemo(() => {
		const role = session?.user?.role;
		const canSeeManagerial = role === "admin" || role === "team_manager";
		// flatten all defined groups; dedupe by href
    const flat = groups
      .filter((g) => (g.title === "Managerial" ? canSeeManagerial : true))
      .flatMap((g) => g.items);
    let out = [];
    const seen = new Set();
    for (const i of flat) {
      if (!seen.has(i.href)) {
        seen.add(i.href);
        out.push(i);
      }
    }
    // Filter for team_manager based on grants
    if (role === 'team_manager' && myGrants?.grants) {
      const allowed = new Set((myGrants.grants || []).map(g => g.section));
      const mapHrefToSection = (href) => {
        if (href.endsWith('/slots')) return 'slots';
        if (href.endsWith('/mri-programs')) return 'metaPrograms';
        if (href.endsWith('/msp-codes')) return 'mspCodes';
        if (href.endsWith('/class-teachers')) return 'classTeachers';
        return null;
      };
      out = out.filter(item => {
        const sec = mapHrefToSection(item.href);
        return !!sec && allowed.has(sec);
      });
    }
    return out;
  }, [session?.user?.role, myGrants?.grants]);

	return (
		<div className="w-full h-full flex bg-transparent text-gray-800 dark:text-zinc-200">
			{/* Expanded rail with labels */}
			<div className="h-full w-48 bg-white/70 dark:bg-zinc-900/60 backdrop-blur border-r border-gray-200/70 dark:border-zinc-800 flex flex-col items-stretch py-3 gap-2">
				{/* Controls Share (Admin) */}
				{session?.user?.role === 'admin' && (
					<Link
						key="controls-share"
						href="/dashboard/admin/manageMeedian/controls-share"
						title="Controls Share"
						aria-label="Controls Share"
						className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
							pathname?.startsWith('/dashboard/admin/manageMeedian/controls-share')
								? "bg-teal-50 text-teal-700 border-teal-200"
								: "text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent"
						}`}
					>
						<Workflow className="w-5 h-5" />
						{pathname?.startsWith('/dashboard/admin/manageMeedian/controls-share') && (
							<span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-teal-500" />
						)}
						<span className="text-[12px] font-medium truncate">Controls Share</span>
					</Link>
				)}

				{railItems.map(({ href, icon: Icon, label }) => {
					const active = pathname?.startsWith(href);
					return (
						<Link
							key={href}
							href={href}
							title={label}
							aria-label={label}
							className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
								active
									? "bg-teal-50 text-teal-700 border-teal-200"
									: "text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent"
							}`}
							aria-current={active ? "page" : undefined}
						>
							<Icon className="w-5 h-5" />
							{active && (
								<span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-teal-500" />
							)}
							<span className="text-[12px] font-medium truncate">{label}</span>
						</Link>
					);
				})}

				{/* Programs section */}
				<div className="mt-1 pt-2 border-t border-gray-200/70 dark:border-zinc-800" />
				<div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
					Programs
				</div>
				{!progData && (
					<>
						<div className="mx-3 h-8 rounded-lg bg-gray-200/70 dark:bg-zinc-800 animate-pulse" />
						<div className="mx-3 h-8 rounded-lg bg-gray-200/70 dark:bg-zinc-800 animate-pulse" />
					</>
				)}
				{/* Daily Slots under Programs */}
				{(() => {
					const href = "/dashboard/admin/manageMeedian/slots";
					const active = pathname?.startsWith(href);
          const role = session?.user?.role;
          const allowedForMgr = (myGrants?.grants || []).some(g => g.section === 'slots');
          if (role === 'team_manager' && !allowedForMgr) return null;
					return (
						<Link
							key={href}
							href={href}
							title="Daily Slots"
							aria-label="Daily Slots"
							className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
								active
									? "bg-teal-50 text-teal-700 border-teal-200"
									: "text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent"
							}`}
							aria-current={active ? "page" : undefined}
						>
							<Workflow className="w-5 h-5" />
							{active && (
								<span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-teal-500" />
							)}
							<span className="text-[12px] font-medium truncate">Daily Slots</span>
						</Link>
					);
				})()}
    {programs.filter((p) => {
        const role = session?.user?.role;
        if (role !== 'team_manager') return true;
        const gs = (myGrants?.grants || []).filter(g => g.section === 'metaPrograms');
        const hasGlobal = gs.some(g => !g.programId);
        if (hasGlobal) return true;
        const allowedIds = new Set(gs.filter(g => g.programId).map(g => g.programId));
        return allowedIds.has(p.id);
      }).map((p) => {
					const base = `/dashboard/admin/manageMeedian/programs/${p.id}`;
					const active = pathname?.startsWith(base);
					const label = String(p.programKey || p.name);
					return (
						<Link
							key={p.id}
							href={base}
							title={label}
							aria-label={label}
							className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
								active
									? "bg-teal-50 text-teal-700 border-teal-200"
									: "text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent"
							}`}
							aria-current={active ? "page" : undefined}
						>
							<Boxes className="w-5 h-5" />
							{active && (
								<span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-teal-500" />
							)}
							<span className="text-[12px] font-medium truncate">{label}</span>
						</Link>
					);
      })}

				{/* Train DeluGPT Button */}
				<div className="mt-4 px-3">
					<Link
						href="/dashboard/admin/manageMeedian/train-delu-gpt"
						className="group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent"
					>
						<span className="text-[12px] font-medium truncate">Train DeluGPT</span>
					</Link>
				</div>

				{/* Bottom placeholder removed per request */}
			</div>

			{/* Flyout panel removed per request */}
		</div>
	);
}
