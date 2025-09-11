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
				href: "/dashboard/admin/manageMeedian/slots",
				label: "Daily Slots",
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
		const out = [];
		const seen = new Set();
		for (const i of flat) {
			if (!seen.has(i.href)) {
				seen.add(i.href);
				out.push(i);
			}
		}
		return out;
	}, [session?.user?.role]);

	return (
		<div className="w-full h-full flex bg-transparent text-gray-800 dark:text-zinc-200">
			{/* Expanded rail with labels */}
			<div className="h-full w-48 bg-white/70 dark:bg-zinc-900/60 backdrop-blur border-r border-gray-200/70 dark:border-zinc-800 flex flex-col items-stretch py-3 gap-2">
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
				{programs.map((p) => {
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
			</div>

			{/* Flyout panel removed per request */}
		</div>
	);
}
