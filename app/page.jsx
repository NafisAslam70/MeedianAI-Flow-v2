"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain } from "lucide-react";
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
  {
    title: "About the Developer",
    description:
      "Flow is crafted by Nafees Aslam, blending frontline operations and product craft so teams ship proof-backed outcomes with heart.",
    image: "/me1.jpg",
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

const featureCards = [
  {
    title: "Task follow-up cockpit",
    description:
      "Assign, track, and nudge from member and manager consoles without losing the audit trail.",
  },
  {
    title: "Deep Calendar rhythm",
    description:
      "Coordinate schedules, blocks, and responsibilities so every role works from the same plan.",
  },
  {
    title: "Proof-backed close day",
    description:
      "Collect evidence, approvals, and escalations in one flow—ready for reports or compliance checks.",
  },
];

const tabSections = [
  {
    id: "why",
    label: "Why Flow",
    kicker: "Why Flow",
    heading: "Operations aligned from open to close",
    description:
      "Flow replaces scattered trackers with a guided operations hub. Every team member, manager, and admin works from the same live plan.",
    listTitle: "Feature pillars that keep teams moving",
    list: featurePillars,
    secondary: {
      title: "Automations & smart nudges",
      items: aiHighlights,
    },
  },
  {
    id: "roles",
    label: "Roles",
    kicker: "Role-aware by default",
    heading: "Every role gets the right cockpit",
    description:
      "Members see the next ritual, managers drive execution, and admins configure the playbook—without stepping on each other’s toes.",
    cards: roleCards,
  },
  {
    id: "rhythm",
    label: "Daily Rhythm",
    kicker: "Day rhythm",
    heading: "A guided rhythm your teams can trust",
    description:
      "Flow steers teams from opening rituals to final approvals with clear checkpoints and evidence capture built in.",
    timeline: dailyRhythm,
  },
  {
    id: "workspaces",
    label: "Workspace Tour",
    kicker: "Workspaces",
    heading: "The complete MeedianAI Flow suite",
    description:
      "Everything from rituals, attendance, and tickets to performance dashboards lives inside Flow—ready to launch in a single click.",
    grid: workspaces,
  },
];

export default function Home() {
  const brandStyles = `
    .beta-badge {
      font-size: 10px;
      padding: 2px 6px;
      margin-left: 6px;
      border-radius: 9999px;
      background: linear-gradient(180deg, rgba(16,185,129,0.35), rgba(56,189,248,0.25));
      border: 1px solid rgba(34,211,238,0.6);
      color: #ecfeff;
      text-shadow: 0 0 8px rgba(34,211,238,0.6);
      box-shadow: 0 0 12px rgba(34,211,238,0.25);
    }
    @media (max-width: 640px) {
      .beta-badge { font-size: 9px; padding: 1px 5px; }
    }
    .slogan {
      font-size: 11px;
      color: #c7f9ff;
      opacity: .95;
      letter-spacing: .2px;
      text-shadow: 0 0 6px rgba(34,211,238,.35);
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      align-self: flex-start;
      margin-top: 2px;
      padding: 2px 8px;
      border-radius: 9999px;
      border: 1px solid rgba(34,211,238,.25);
      background: linear-gradient(180deg, rgba(34,211,238,.20), rgba(59,130,246,.14));
      box-shadow: 0 6px 14px rgba(34,211,238,.18);
      backdrop-filter: blur(2px);
    }
    @media (max-width: 768px) {
      .slogan { font-size: 10px; padding: 1px 6px; gap: 3px; }
      .slogan-brain svg { width: 12px; height: 12px; }
    }
    .slogan-brain {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #facc15;
      margin-left: 2px;
      position: relative;
      top: .5px;
      filter: drop-shadow(0 0 6px rgba(250,204,21,.5));
      animation: brainPulse 2.4s ease-in-out infinite;
    }
    .slogan-brain svg { display: block; width: 14px; height: 14px; }
    @keyframes brainPulse {
      0%, 100% { transform: translateY(0) scale(1); opacity: .85; }
      50% { transform: translateY(-1px) scale(1.12); opacity: 1; }
    }
    .brand-wrap { position: relative; }
    .brand-wrap .brand-sweep {
      position: absolute;
      inset: -20% auto -20% -30%;
      width: 60px;
      background: linear-gradient(75deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0));
      filter: blur(6px);
      transform: skewX(-10deg);
      pointer-events: none;
      animation: brandSweep 3.2s linear infinite;
    }
    @keyframes brandSweep {
      0% { left: -30%; }
      100% { left: 120%; }
    }
    .brand-wrap .brand-star {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 9999px;
      pointer-events: none;
      background: radial-gradient(circle at 50% 50%, #fff 0 35%, rgba(255,255,255,0) 70%);
      filter: drop-shadow(0 0 6px rgba(255,255,255,0.8));
      animation: twinkleBrand 1.8s ease-in-out infinite;
    }
    .brand-wrap .brand-star.star1 { top: -4px; left: 32%; animation-delay: .15s; }
    .brand-wrap .brand-star.star2 { top: 60%; left: 88%; animation-delay: .6s; }
    .brand-wrap .brand-star.star3 { top: 90%; left: 8%; animation-delay: 1.05s; }
    @keyframes twinkleBrand {
      0%, 100% { opacity: 0.2; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }
  `;

  const [activeTab, setActiveTab] = useState(tabSections[0].id);
  const [contactOpen, setContactOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [contactError, setContactError] = useState("");
  const activeSection = tabSections.find((tab) => tab.id === activeTab) ?? tabSections[0];

  const openContactModal = () => {
    setContactOpen(true);
    setSent(false);
    setContactError("");
  };
  const closeContactModal = () => {
    setContactOpen(false);
    setIsSending(false);
    setSent(false);
    setContactError("");
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSending(true);
    setSent(false);
    setContactError("");

    const formData = new FormData(form);
    const name = formData.get("name") || "";
    const email = formData.get("email") || "";
    const organization = formData.get("organization") || "";
    const message = formData.get("message") || "";
    const publicToken = process.env.NEXT_PUBLIC_PUBLIC_ENQUIRY_TOKEN;

    try {
      // Send the email and also log a lead for Managerial Club → Student Enquiry.
      const [contactRes, leadRes] = await Promise.all([
        fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, organization, message }),
        }),
        fetch("/api/public/student-enquiry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(publicToken ? { "x-public-token": publicToken } : {}),
          },
          body: JSON.stringify({
            name,
            email,
            organization,
            message,
            source: "landing-popup",
          }),
        }),
      ]);

      if (!contactRes.ok) {
        const data = await contactRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send your message.");
      }

      if (!leadRes.ok) {
        console.error("Lead logging failed", await leadRes.text().catch(() => ""));
      }

      form.reset();
      setIsSending(false);
      setSent(true);
    } catch (error) {
      console.error(error);
      setContactError(error.message || "Unable to send your message. Please try again later.");
      setIsSending(false);
      setSent(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <style jsx global>{brandStyles}</style>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_60%)]" />
        <header className="relative z-10">
          <nav className="flex w-full items-center justify-between px-6 py-6 lg:px-12">
            <div className="brand-wrap flex items-center gap-1.5 sm:gap-2 min-w-0 text-slate-100">
              <img
                src="/flow1.png"
                alt="MeedianAI Flow logo"
                className="logo-animation w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-cyan-400 p-1 shadow-md"
              />
              <div className="flex flex-col items-start leading-tight min-w-0">
                <Link
                  href="/"
                  className="text-base sm:text-xl font-extrabold tracking-tight brand-text truncate max-w-[40vw] sm:max-w-none"
                >
                  MeedianAI‑Flow <span className="beta-badge">beta</span>
                </Link>
                <span className="slogan hidden sm:flex items-center gap-1 text-xs text-slate-300">
                  A team towards Mastery{" "}
                  <span className="slogan-brain" aria-hidden="true">
                    <Brain size={14} strokeWidth={2.25} />
                  </span>
                </span>
              </div>
              <span className="brand-sweep" aria-hidden />
              <span className="brand-star star1" aria-hidden />
              <span className="brand-star star2" aria-hidden />
              <span className="brand-star star3" aria-hidden />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openContactModal}
                className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400/70 hover:text-emerald-200 sm:inline-flex"
              >
                Talk to Us
              </button>
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
                    <button
                      type="button"
                      onClick={openContactModal}
                      className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                    >
                      Talk with Us
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Need a guided tour? Email{" "}
                    <a href="mailto:admin@mymeedai.org" className="font-semibold text-emerald-200 underline">
                      admin@mymeedai.org
                    </a>{" "}
                    and we’ll shape Flow around your teams.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-xl shadow-black/20 backdrop-blur relative overflow-hidden">
                  <div className="pointer-events-none absolute -left-12 top-10 h-24 w-32 rotate-12 bg-gradient-to-r from-emerald-400/25 via-cyan-400/25 to-transparent blur-3xl" />
                  <div className="pointer-events-none absolute -right-10 bottom-4 h-28 w-36 -rotate-6 bg-gradient-to-r from-transparent via-sky-400/25 to-purple-400/20 blur-3xl" />
                  <h2 className="text-lg font-semibold text-slate-50">Outcomes at a glance</h2>
                  <p className="mt-2 text-xs uppercase tracking-[0.3em] text-emerald-200/80">
                    Where Flow delivers clarity, speed, and proof
                  </p>
                  <ul className="relative mt-6 space-y-3 text-sm text-slate-200">
                    {outcomes.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-md shadow-emerald-500/10"
                      >
                        <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 overflow-hidden border-t border-white/5 bg-slate-950/80">
            <div className="pointer-events-none absolute -top-24 left-12 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl sm:left-32 sm:w-80" />
            <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl sm:right-24 sm:w-96" />
            <div className="relative mx-auto max-w-6xl px-6 py-12 lg:py-16">
              <div className="mb-8 max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                  Signature capabilities
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-50 sm:text-3xl">
                  The pillars that make Flow stick on day one
                </h2>
                <p className="mt-3 text-sm text-slate-300">
                  Every card translates into live workflows—so your teams feel the difference the moment they log in.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {featureCards.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur transition hover:border-emerald-400/40 hover:shadow-emerald-500/10"
                  >
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/80">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-200">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="explore" className="relative z-10 overflow-hidden border-y border-white/5 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/60">
            <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[32rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gradient-to-r from-emerald-500/15 via-sky-500/10 to-purple-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-1/3 h-72 w-72 -translate-y-1/2 rounded-full bg-purple-500/20 blur-[120px]" />
            <div className="relative mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-lg shadow-black/25 backdrop-blur">
                {tabSections.map((tab) => {
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border border-emerald-400/60 bg-emerald-500/20 text-emerald-100 shadow-inner shadow-emerald-500/40"
                          : "border border-transparent bg-transparent text-slate-300 hover:text-emerald-200"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 transition group-hover:scale-110" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/30 backdrop-blur">
                <div className="max-w-3xl space-y-2">
                  {activeSection.kicker && (
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                      {activeSection.kicker}
                    </p>
                  )}
                  <h3 className="text-2xl font-semibold text-slate-50 sm:text-3xl">{activeSection.heading}</h3>
                  <p className="text-sm text-slate-300">{activeSection.description}</p>
                </div>

                {activeSection.list && (
                  <div className="mt-8 space-y-4">
                    {activeSection.listTitle && (
                      <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
                        {activeSection.listTitle}
                      </h4>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      {activeSection.list.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-sm shadow-black/20"
                        >
                          <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                          <span className="text-sm text-slate-200">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSection.cards && (
                  <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {activeSection.cards.map((card) => (
                      <div
                        key={card.title}
                        className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-950/40 p-5 shadow-md shadow-black/20 transition hover:border-emerald-400/40 hover:shadow-emerald-500/10"
                      >
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-emerald-500/15 text-sm font-semibold text-emerald-200 overflow-hidden">
                          {card.image ? (
                            <img src={card.image} alt={card.title} className="h-full w-full object-cover" />
                          ) : (
                            card.title.split(" ")[0][0]
                          )}
                        </div>
                        <h4 className="mt-4 text-base font-semibold text-slate-50">{card.title}</h4>
                        <p className="mt-3 text-sm text-slate-300">{card.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeSection.timeline && (
                  <ol className="mt-8 grid gap-6 md:grid-cols-5">
                    {activeSection.timeline.map((item, index) => (
                      <li
                        key={item.title}
                        className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-md shadow-black/20"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-200">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h4 className="mt-3 text-sm font-semibold text-slate-50">{item.title}</h4>
                        <p className="mt-2 text-xs text-slate-300">{item.description}</p>
                      </li>
                    ))}
                  </ol>
                )}

                {activeSection.grid && (
                  <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {(activeSection.grid.slice ? activeSection.grid.slice(0, 6) : activeSection.grid).map((space) => (
                      <article
                        key={space.title}
                        className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-950/40 p-5 shadow-md shadow-black/20 transition hover:border-emerald-400/40 hover:shadow-emerald-500/10"
                      >
                        <h4 className="text-sm font-semibold text-emerald-200">{space.title}</h4>
                        <p className="mt-2 text-xs text-slate-300">{space.description}</p>
                      </article>
                    ))}
                  </div>
                )}

                {activeSection.secondary && (
                  <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-inner shadow-emerald-500/20">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
                      {activeSection.secondary.title}
                    </h4>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {activeSection.secondary.items.map((item) => (
                        <div
                          key={item.title}
                          className="rounded-xl border border-white/10 bg-slate-950/40 p-4 shadow-sm shadow-black/15"
                        >
                          <h5 className="text-sm font-semibold text-slate-50">{item.title}</h5>
                          <p className="mt-2 text-xs text-slate-300">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

        
          <section id="contact" className="relative bg-gradient-to-br from-emerald-500/10 via-slate-950 to-sky-500/10">
            <div className="pointer-events-none absolute inset-x-10 -top-24 h-64 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-24 bottom-0 h-56 translate-y-1/2 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="relative mx-auto max-w-6xl px-6 py-20">
              <div className="grid gap-8 rounded-[2.5rem] border border-white/10 bg-slate-950/85 p-10 shadow-[0_30px_120px_-40px_rgba(16,185,129,0.7)] backdrop-blur lg:grid-cols-2">
                <div className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 via-slate-950/85 to-sky-500/15 p-8 shadow-xl shadow-emerald-500/20">
                  <div className="pointer-events-none absolute -right-24 top-8 h-64 w-64 rounded-full bg-emerald-400/18 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-sky-400/18 blur-3xl" />
                  <div className="relative flex flex-col items-center gap-6 text-center">
                    <div className="relative h-44 w-44 overflow-hidden rounded-[2.25rem] border border-emerald-100/40 bg-slate-900/70 shadow-inner shadow-emerald-500/30 sm:h-52 sm:w-52">
                      <img src="/me1.jpg" alt="Nafees Aslam" className="h-full w-full object-cover" />
                      <span className="pointer-events-none absolute inset-0 border border-white/10" />
                    </div>
                    <div className="w-full max-w-lg space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                        About the developer
                      </p>
                      <a
                        href="https://www.nafisaslam.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-emerald-100 transition hover:text-emerald-50"
                      >
                        www.nafisaslam.com
                      </a>
                      <h3 className="text-xl font-semibold text-slate-50 sm:text-2xl">
                        Nafis Aslam builds Flow to keep teams grounded and accountable.
                      </h3>
                      <p className="text-sm text-emerald-50/80">
                        Data scientist cum AI developer.
                      </p>
                      <a
                        href="https://www.nafisaslam.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/20 transition hover:border-emerald-300 hover:text-emerald-50"
                      >
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                        nafisaslam.com
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-emerald-100/75">
                      <a
                        href="mailto:nafisaslam70@gmail.com"
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-emerald-300 hover:text-emerald-100"
                      >
                        nafisaslam70@gmail.com
                      </a>
                      <a
                        href="https://www.linkedin.com/in/nafis-aslam"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-emerald-300 hover:text-emerald-100"
                      >
                        LinkedIn
                      </a>
                      <a
                        href="https://github.com/nafees-aslam"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover-border-emerald-300 hover:text-emerald-100"
                      >
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-black/25 backdrop-blur">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
                      Shape it to your org
                    </h3>
                    <ul className="mt-4 space-y-2 text-sm text-slate-200">
                      {customization.slice(0, 4).map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-black/25 backdrop-blur">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100">Trust & control</h3>
                    <ul className="mt-4 space-y-2 text-sm text-slate-200">
                      {dataPrivacy.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-sky-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent p-6 shadow-lg shadow-emerald-500/20">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Keep momentum</p>
                    <p className="mt-2 text-sm text-slate-100/80">
                      Prefer a walkthrough or need rollout collateral? Email the Flow team or jump straight into your dashboard.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a
                        href="mailto:admin@mymeedai.org"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
                      >
                        Email Flow Team
                      </a>
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Log In as Your Role
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {contactOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
            <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/95 to-slate-900/80 p-8 shadow-2xl shadow-black/40">
              <button
                type="button"
                onClick={closeContactModal}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                aria-label="Close contact form"
              >
                Close
              </button>
              <div className="space-y-3 pr-10">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                  Contact us
                </p>
                <h2 className="text-2xl font-semibold text-slate-50">
                  Tell us about your teams and we’ll share a tailored walkthrough.
                </h2>
                <p className="text-sm text-slate-300">
                  We typically reply within one business day. Prefer email? Reach us at{" "}
                  <a href="mailto:admin@mymeedai.org" className="font-semibold text-emerald-200 underline">
                    admin@mymeedai.org
                  </a>
                  .
                </p>
              </div>
              <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-xs font-medium uppercase tracking-[0.25em] text-slate-300">
                    Name
                    <input
                      required
                      name="name"
                      type="text"
                      placeholder="Your name"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <label className="flex flex-col text-xs font-medium uppercase tracking-[0.25em] text-slate-300">
                    Email
                    <input
                      required
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                </div>
                <label className="flex flex-col text-xs font-medium uppercase tracking-[0.25em] text-slate-300">
                  Organization / Site
                  <input
                    name="organization"
                    type="text"
                    placeholder="School, clinic, agency, etc."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </label>
                <label className="flex flex-col text-xs font-medium uppercase tracking-[0.25em] text-slate-300">
                  What would you like to explore?
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Tell us about your teams and priorities."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-400">
                    We’ll reply from <span className="text-emerald-200">admin@mymeedai.org</span>
                  </span>
                  <button
                    type="submit"
                    disabled={isSending}
                    className={`rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:from-emerald-400 hover:to-sky-400 ${
                      isSending ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSending ? "Sending…" : sent ? "Sent!" : "Send message"}
                  </button>
                </div>
                {contactError && (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-inner shadow-rose-500/20">
                    {contactError}
                  </div>
                )}
                {sent && (
                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-inner shadow-emerald-500/20">
                    Message sent to <span className="font-semibold">admin@mymeedai.org</span>. We’ll get back to you shortly!
                  </div>
                )}
              </form>
              <p className="mt-8 text-center text-xs text-slate-400">
                Crafted with care by <span className="text-emerald-200">Nafees Aslam</span> — happy to collaborate on ideas.
              </p>
            </div>
          </div>
        )}

        <Footer className="border-t border-white/5" showFounders={false} />
      </div>
    </div>
  );
}
