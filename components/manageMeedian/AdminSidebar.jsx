"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users, GraduationCap, Boxes, CalendarDays, Workflow, Sparkles, Megaphone, ClipboardList } from "lucide-react";
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
				href: "/dashboard/admin/manageMeedian/mri-reports",
				label: "MRI Reports",
				icon: ClipboardList,
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
		],
	},
	{
		title: "Team",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/class-teachers",
				label: "Class Teachers",
				icon: Users,
			},
			{
				href: "/dashboard/admin/manageMeedian/team",
				label: "Manage Team",
				icon: Users,
			},
		],
	},
	{
		title: "Community",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/community",
				label: "Meed Community",
				icon: Megaphone,
			},
		],
	},
	{
		title: "Managerial Club",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/managerial-admin-controls",
				label: "Managerial Controls",
				icon: Workflow,
			},
			{
				href: "/dashboard/admin/students",
				label: "Student Register",
				icon: GraduationCap,
			},
		],
	},
	{
		title: "Daily Reports",
		items: [
			{
				href: "/dashboard/admin/manageMeedian/daily-reports/gate-logs",
				label: "Gate Logs",
				icon: ClipboardList,
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

	const allowedSections = React.useMemo(
		() => new Set((myGrants?.grants || []).map((g) => g.section)),
		[myGrants]
	);

	const railItems = React.useMemo(() => {
		// Show all admin items for admin + managers. Middleware already guards the area.
		const flat = groups.flatMap((g) => g.items);
		const out = [];
		const seen = new Set();
		for (const i of flat) {
			if (!seen.has(i.href)) {
				seen.add(i.href);
				out.push(i);
			}
		}
		return out;
	}, []);

	return (
		<div className="w-full h-full flex bg-transparent text-gray-800 dark:text-zinc-200">
			{/* Expanded rail with labels */}
			<div className="h-full w-48 bg-white/70 dark:bg-zinc-900/60 backdrop-blur border-r border-gray-200/70 dark:border-zinc-800 flex flex-col items-stretch py-3 gap-2">
				{(() => {
					const role = session?.user?.role;
					const items = [
						{
							key: "controls-share",
							href: "/dashboard/admin/manageMeedian/controls-share",
							label: "Controls Share",
							icon: Workflow,
							shouldRender: role === 'admin' || role === 'team_manager',
							disabled: role !== 'admin',
						},
						{
							key: "randoms-lab",
							href: "/dashboard/admin/manageMeedian/randoms",
							label: "Randoms Lab",
							icon: Sparkles,
							shouldRender: role === 'admin' || role === 'team_manager',
							disabled: role === 'team_manager' && !allowedSections.has('randomsLab'),
						},
					];
					return items
						.filter(({ shouldRender }) => shouldRender)
						.map(({ key, href, label, icon: Icon, disabled }) => {
						const active = pathname?.startsWith(href);
						return (
							<Link
								key={key}
								href={href}
								title={label}
								aria-label={label}
								onClick={(e)=>{ if(disabled){ e.preventDefault(); e.stopPropagation(); window.alert('You are not allowed for this'); } }}
								aria-disabled={disabled}
								className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
									active
										? "bg-teal-50 text-teal-700 border-teal-200"
										: `text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
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
						});
				})()}

				{railItems.map(({ href, icon: Icon, label }) => {
					const active = pathname?.startsWith(href);
					const role = session?.user?.role;
					const allowed = allowedSections;
					const mapHrefToSection = (h) => {
						if (h.endsWith("/calendar")) return "schoolCalendar";
						if (h.endsWith("/mri-roles")) return "mriRoles";
						if (h.endsWith("/mri-programs")) return "metaPrograms";
						if (h.endsWith("/mri-reports")) return ["mriReportTemplates", "mriReportAssignments"];
						if (h.endsWith("/msp-codes")) return "mspCodes";
						if (h.endsWith("/class-teachers")) return "classTeachers";
						if (h.endsWith("/team")) return "team";
						if (h === "/dashboard/admin/students") return "students";
						if (h.endsWith("/randoms")) return "randomsLab";
						if (h.includes("/daily-reports/gate-logs")) return ["campusGateStaff", "guardianGateLogs"];
						return null;
					};
					const sec = mapHrefToSection(href);
					let disabled = false;
					if (role === 'team_manager' && sec) {
						if (Array.isArray(sec)) {
							disabled = !sec.some((s) => allowed.has(s));
						} else {
							disabled = !allowed.has(sec);
						}
					}
					return (
						<Link
							key={href}
							href={href}
							title={label}
							aria-label={label}
							onClick={(e)=>{ if(disabled){ e.preventDefault(); e.stopPropagation(); window.alert('You are not allowed for this'); } }}
							aria-disabled={disabled}
							className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
								active
									? "bg-teal-50 text-teal-700 border-teal-200"
									: `text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
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
					const allowed = new Set((myGrants?.grants || []).map(g => g.section));
					const disabled = role === 'team_manager' && !allowed.has('slots');
					return (
						<Link
							key={href}
							href={href}
							title="Daily Slots"
							aria-label="Daily Slots"
							onClick={(e)=>{ if(disabled){ e.preventDefault(); e.stopPropagation(); window.alert('You are not allowed for this'); } }}
							aria-disabled={disabled}
							className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
								active
									? "bg-teal-50 text-teal-700 border-teal-200"
									: `text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
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
    {programs.map((p) => {
					const base = `/dashboard/admin/manageMeedian/programs/${p.id}`;
					const active = pathname?.startsWith(base);
					const label = String(p.programKey || p.name);
					const role = session?.user?.role;
					// Disable program link if manager lacks global or per-program grant
					let progDisabled = false;
					if (role === 'team_manager') {
						const grants = myGrants?.grants || [];
						const hasGlobal = grants.some(g => g.section === 'metaPrograms' && !g.programId);
						const hasProg = grants.some(g => g.section === 'metaPrograms' && g.programId === p.id);
						progDisabled = !(hasGlobal || hasProg);
					}
					return (
						<Link
							key={p.id}
							href={base}
							title={label}
							aria-label={label}
							onClick={(e)=>{ if(progDisabled){ e.preventDefault(); e.stopPropagation(); window.alert('You are not allowed for this'); } }}
							aria-disabled={progDisabled}
							className={`group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border ${
								active
									? "bg-teal-50 text-teal-700 border-teal-200"
									: `text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent ${progDisabled ? 'opacity-50 cursor-not-allowed' : ''}`
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

				{/* Train DeluGPT Button (admin only) */}
				{session?.user?.role === 'admin' && (
					<div className="mt-4 px-3">
						<Link
							href="/dashboard/admin/manageMeedian/train-delu-gpt"
							className="group relative flex items-center gap-3 h-10 w-full px-3 rounded-xl transition border text-gray-600 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60 border-transparent"
						>
							<span className="text-[12px] font-medium truncate">Train DeluGPT</span>
						</Link>
					</div>
				)}

				{/* Bottom placeholder removed per request */}
			</div>

			{/* Flyout panel removed per request */}
		</div>
	);
}
