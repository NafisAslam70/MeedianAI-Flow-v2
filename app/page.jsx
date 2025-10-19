"use client";

import Link from "next/link";
import Footer from "@/components/Footer";

const heroHighlights = [
  "Unified operations cockpit",
  "Role-aware workflows",
  "Proof-backed close of day",
];

const outcomes = [
  "One shared source of truth for routines, schedules, duties, and attendance",
  "Faster coordination with built-in chat, huddles, and nudges",
  "Evidence-backed close-of-day and lightweight approvals",
  "Clear dashboards for early warning and coaching",
];

const roleCards = [
  {
    title: "Frontline Members",
    description:
      "See what’s next, check in/out, collaborate live, and submit evidence at day-close.",
  },
  {
    title: "Managers",
    description:
      "Assign work, track progress, approve requests, escalate issues, and run reports instantly.",
  },
  {
    title: "Admins",
    description:
      "Define programs, slots, roles, compliance rules, and branding for every deployment.",
  },
];

const dailyRhythm = [
  {
    title: "Open Day",
    description: "Launch rituals, generate QR entry codes, and confirm required moderators are live.",
  },
  {
    title: "Work the Plan",
    description: "Follow Deep Calendar blocks while acting on Assigned Tasks and the Routine Tracker.",
  },
  {
    title: "Collaborate",
    description: "Use Work Together for quick huddles, shared notes, shared music, and status updates.",
  },
  {
    title: "Record Presence",
    description: "Scan at Gate for in/out movements and mark sessions via Take Attendance.",
  },
  {
    title: "Close Day",
    description: "Review outcomes and notes in Close My Day, then submit for approval.",
  },
];

const workspaces = [
  {
    title: "Member Dashboard",
    description: "Live view of Deep Calendar, tasks, and routine trackers so everyone stays on plan.",
  },
  {
    title: "My Meed Rituals",
    description: "Guided day-open workflow with QR codes and attendance confirmations.",
  },
  {
    title: "Shared Dashboard / Deep Calendar",
    description: "Timeline of blocks with “active now” callouts.",
  },
  {
    title: "Routine Tracker",
    description: "Ritual checklists, completion states, and close-day reminders in one place.",
  },
  {
    title: "Work Together",
    description: "Virtual war room for video huddles, shared notes, music, and quick status updates.",
  },
  {
    title: "Gate",
    description: "In/out logging via QR today, biometric-ready tomorrow.",
  },
  {
    title: "Take Attendance",
    description: "Personal tokens for scans that tie attendance to moderator sessions.",
  },
  {
    title: "Close My Day",
    description: "Evidence-backed review inside configurable submission windows.",
  },
  {
    title: "Managers Common",
    description: "Assign work, remind, approve, ticket, escalate, and report from one console.",
  },
  {
    title: "Manage Meedian",
    description: "Programs, Daily Slot Management, Meta Roles, code library, and day-close rules.",
  },
  {
    title: "My Performance",
    description: "Streaks, leave, day-close history, and trends for targeted coaching.",
  },
];

const featurePillars = [
  "Task follow-up – assign, track, remind, and drill into work from both member and manager consoles.",
  "Schedule orchestration – Deep Calendar aligns blocks, responsibilities, and timers across the day.",
  "Attendance capture – QR scans, Gate in/out logs, and manager attendance reports (CSV/PDF).",
  "Live collaboration & comms – floating chat dock, notifications drawer, and video huddles.",
  "Approvals & escalations – close-day approvals, leave flows, tickets, and escalation hooks.",
  "Reporting – member performance snapshots plus manager compliance and attendance exports.",
];

const aiHighlights = [
  {
    title: "DELU-GPT Assistant",
    detail:
      "Role-aware help for quick intents, drafting notes, and guided steps that stay in context.",
  },
  {
    title: "Smart Reminders",
    detail:
      "One-click WhatsApp nudges for tasks or attendance, with delivery logged for accountability.",
  },
  {
    title: "Configurable by Design",
    detail:
      "Keep AI features on for analytics and nudging or off for a minimal rollout—no rework required.",
  },
];

const customization = [
  "Programs & slots – define your own day structure per division or site.",
  "Forms & evidence – choose what’s required at open/close (photos, notes, checklists).",
  "Roles & permissions – assign admin, manager, and member access by team or location.",
  "Feature flags – toggle close-day windows, bypass buttons, chat policies, and mobile rules.",
  "Branding – swap logos, colors, welcome copy, and imagery to match your identity.",
];

const dataPrivacy = [
  "Your data, your controls – simple exports and admin tooling keep ownership with you.",
  "Accountability – approvals, logs, and day-close evidence maintain clean audit trails.",
  "Privacy – enable or limit AI and messaging features per policy, and redact sensitive fields.",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_60%)]" />
        <header className="relative z-10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">MeedianAI</span>
              <span className="hidden text-slate-100 sm:inline">Flow</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="#contact"
                className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400/70 hover:text-emerald-200 sm:inline-flex"
              >
                Talk to Us
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-sky-400"
              >
                Log In
              </Link>
            </div>
          </nav>
        </header>

        <main className="relative z-10">
          <section className="border-b border-white/5 bg-slate-950/70">
            <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
              <div className="grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
                <div className="space-y-7 text-left">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                    Operations OS
                  </span>
                  <h1 className="text-3xl font-bold leading-tight text-slate-50 sm:text-5xl">
                    MeedianAI Flow — Product Guide
                  </h1>
                  <p className="text-lg text-slate-300 sm:text-xl">
                    A role-aware operations workspace that keeps every team on the same schedule, the same priorities,
                    and the same close-of-day standards. It unifies planning, tasks, attendance, and collaboration into
                    one simple browser experience—adaptable to schools, clinics, NGOs, agencies, sites, and more.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {heroHighlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {highlight}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href="/login"
                      className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
                    >
                      Log In to Flow
                    </Link>
                    <a
                      href="mailto:admin@mymeedai.org"
                      className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                    >
                      Talk with Us
                    </a>
                  </div>
                  <p className="text-xs text-slate-400">
                    Need a guided tour? Email{" "}
                    <a href="mailto:admin@mymeedai.org" className="font-semibold text-emerald-200 underline">
                      admin@mymeedai.org
                    </a>{" "}
                    and we’ll shape Flow around your teams.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-200">
                      ROI
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-50">Outcomes at a glance</h2>
                      <p className="text-xs text-slate-300">Where Flow delivers clarity, speed, and proof.</p>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-4 text-sm text-slate-200">
                    {outcomes.map((item) => (
                      <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                        <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section id="who" className="bg-slate-900/50">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Who Flow is built for</h2>
                <p className="text-sm text-slate-300">
                  Each role gets the tools and permissions they need—without losing the shared, single source of truth.
                </p>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {roleCards.map((card) => (
                  <div
                    key={card.title}
                    className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20 transition hover:border-emerald-400/40 hover:shadow-emerald-500/10"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-200">
                      {card.title.split(" ")[0][0]}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-50">{card.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="rhythm" className="border-t border-white/5 bg-slate-950/40">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">A guided day rhythm</h2>
                <p className="text-sm text-slate-300">
                  Flow leads every team from a focused start to an evidence-backed close without losing momentum.
                </p>
              </div>
              <ol className="mt-10 grid gap-6 md:grid-cols-5">
                {dailyRhythm.map((item, index) => (
                  <li key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/15">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-200">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-slate-50">{item.title}</h3>
                    <p className="mt-3 text-xs text-slate-300">{item.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="workspaces" className="bg-slate-900/45">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Core workspaces</h2>
                <p className="text-sm text-slate-300">
                  Flow assembles every operational surface—tasks, rituals, attendance, approvals—into a calm, guided UI.
                </p>
              </div>
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {workspaces.map((space) => (
                  <article
                    key={space.title}
                    className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/15 transition hover:border-emerald-400/40 hover:shadow-emerald-500/10"
                  >
                    <h3 className="text-lg font-semibold text-emerald-200">{space.title}</h3>
                    <p className="mt-3 text-sm text-slate-300">{space.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="features" className="border-t border-white/5 bg-slate-950/40">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Feature pillars</h2>
                <p className="text-sm text-slate-300">
                  Purpose-built for daily execution, Flow focuses on the moments that matter most.
                </p>
              </div>
              <ul className="mt-10 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200 shadow-lg shadow-black/15 backdrop-blur md:grid-cols-2">
                {featurePillars.map((pillar) => (
                  <li key={pillar} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-sky-400" />
                    <span>{pillar}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="ai" className="bg-slate-900/55">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">AI & automations when you need them</h2>
                <p className="text-sm text-slate-300">
                  Flow’s assistants and reminders stay configurable so you can dial in how proactive the system should be.
                </p>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {aiHighlights.map((highlight) => (
                  <div
                    key={highlight.title}
                    className="h-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20 transition hover:border-sky-400/40 hover:shadow-sky-500/10"
                  >
                    <h3 className="text-lg font-semibold text-sky-200">{highlight.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-200">{highlight.detail}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-slate-400">
                Flip automations on for analytics and nudging—or keep them off for a minimal rollout. You stay in control.
              </p>
            </div>
          </section>

          <section id="customization" className="border-t border-white/5 bg-slate-950/35">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="grid gap-10 lg:grid-cols-2">
                <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/15">
                  <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">Customize & brand it</h2>
                  <p className="text-sm text-slate-300">
                    Configure how Flow speaks to each client or division—down to the rituals, evidence, and UI accents.
                  </p>
                  <ul className="space-y-3 text-sm text-slate-200">
                    {customization.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/15">
                  <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">Data, privacy & control</h2>
                  <p className="text-sm text-slate-300">
                    Flow keeps compliance simple with role-based access, clean audit trails, and configurable privacy controls.
                  </p>
                  <ul className="space-y-3 text-sm text-slate-200">
                    {dataPrivacy.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-purple-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section id="contact" className="bg-gradient-to-br from-emerald-500/10 via-slate-950 to-sky-500/10">
            <div className="mx-auto max-w-4xl px-6 py-20">
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-10 text-center shadow-xl shadow-black/30 backdrop-blur">
                <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
                  Ready to bring MeedianAI Flow to your teams?
                </h2>
                <p className="mt-4 text-sm text-slate-300">
                  We’ll help you tailor programs, slots, and dashboards to your mission. Email{" "}
                  <a href="mailto:admin@mymeedai.org" className="font-semibold text-emerald-200 underline">
                    admin@mymeedai.org
                  </a>{" "}
                  to start the conversation.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <a
                    href="mailto:admin@mymeedai.org"
                    className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
                  >
                    Contact Us
                  </a>
                  <Link
                    href="/login"
                    className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                  >
                    Log In as Your Role
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer className="border-t border-white/5" showFounders={false} />
      </div>
    </div>
  );
}
