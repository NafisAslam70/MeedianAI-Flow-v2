# MeedianAI‑Flow — Theoretical Model → System Mapping

Purpose: Capture the education model (theory), then map it 1:1 to data, APIs, and UI so features remain coherent and scalable.

## Core Philosophy
- Values‑led, whole‑child education integrating Islamic tradition, contemporary pedagogy, and cognitive science.
- Outcomes: strong character, academic excellence, well‑being; faith and academics interwoven.
- Sources: `delu-gpt-training/stage-1/base-context.json`, `delu-gpt-training/stage-1/training-data.jsonl`.

## Day Model
- MRI (Meed Rituals Installation) categories: A‑MRI (Academic), N‑MRI (Non‑Academic), R‑MRI (Role based eg nmri mdoerator role task, pt_moderator task), O‑MRI (office ).
- MRN (Me Right Now): user’s current active routine; anchors action and reflection.
- Slots/Blocks: full‑day template (e.g., Blocks 1..6, Slots 0–17) shapes time; N‑MRI slots can have TODs (Discipline, Language, etc.).

## Governance Taxonomy
- Families → Programs → Roles
  - Families (e.g., AMRI/NMRI/RMRI/Custom)
  - Programs (e.g., MSP) with scope per track (pre_primary/elementary/both)
  - Program Roles (open/close/substitute/approve/check)
- MSP Codes: canonical skills/content (families EMS/ESLC/EUA/EHO/PGL/PRL), assigned to users with start/end dates; stable across churn.
- PT model: class_parent_teachers + pt_moderator role ensures continuity for parents/teachers.

## Scheduling Model
- Matrix per track: Class × Period → { msp_code, subject }.
- Teacher‑wise view filters to owned cells (based on code assignments/ownership).
- Seed flows: default seed and AI‑generated seeds (Routine Manager); validators for collisions and leisure caps.

## AI Assist & Routine Manager
- DELU‑GPT: concise, role‑aware assistant with a safe allowlist of models.
- Routine Manager: prompts DELU‑GPT or OpenAI to draft matrix JSON; “Apply Seed” persists custom matrix.

---

## System Mapping (Where it lives in code)

### Data (schema)
- MSP codes and assignments: `lib/schema.js`
- Programs/families/roles: `lib/schema.js`
- Messages, direct_whatsapp_messages (DM/Chat): `drizzle/meta/0002_snapshot.json` (db-level), handlers below

### APIs
- Admin meta (families, programs, codes, team, schedule pieces):
  - `app/(main)/api/admin/manageMeedian/route.js`
- Members/managers common (announcements, assign-tasks, day‑close, messages):
  - `app/(main)/api/managersCommon/*`
- Chat (internal):
  - `app/(main)/api/others/chat/route.js` (GET/POST/PUT)
  - Socket server: `app/(main)/api/socket/route.js` (and `lib/useSocket.js` client)
- AI assist (role‑aware):
  - `app/(main)/api/ai/assist/route.js`

### UI
- Admin shell + ManageMeedian: sticky sidebar, content‑only scroll
  - Layout: `app/(main)/dashboard/admin/manageMeedian/layout.jsx` (see chat8 notes)
  - Sidebar: `components/manageMeedian/AdminSidebar.jsx`
- Programs → MSP‑R (matrix editor, seed flows, teacher/class views)
  - `app/(main)/dashboard/admin/manageMeedian/programs/[id]/page.jsx`
- MSP Codes management
  - `app/(main)/dashboard/admin/manageMeedian/msp-codes/page.jsx`
- Chat (member/manager/admin)
  - Floating dock + history + thread view: `components/ChatBox.jsx`
  - Socket client hook: `lib/useSocket.js`
- DELU‑GPT assistant
  - Floating modal: `components/DeluGPT.jsx`
  - Training sandbox: `app/(main)/dashboard/admin/manageMeedian/train-delu-gpt/page.jsx`

---

## Operating Principles (UX/Engineering)
- SPA feel: fixed shell, content‑only scroll, Navbar/Footer always visible.
- Role‑guarded routes and actions; UI hints where to click for privileged actions.
- Performance: trim chat context, render windows for long threads, socket for push; 
  server caps (turns/tokens) for predictable latency.

---

## Glossary
- MRI: Meed Routine Item (typed: A‑MRI/N‑MRI/R‑MRI/O‑NMRI)
- MRN: Me Right Now (active routine state)
- MSP: Program representing subject/skills map with coded content (MSP Codes)
- PT: Parent Teacher role (pt_moderator)

---

## Traceability (examples)
- AI system prompt and allowlist:
  - `app/(main)/api/ai/assist/route.js:43`
- Routine Manager model selector and prompt injection:
  - `app/(main)/dashboard/admin/manageMeedian/programs/[id]/page.jsx:720`
- Socket bindings (chat):
  - server `app/(main)/api/socket/route.js`
  - client `lib/useSocket.js`

---

## Roadmap hooks (from Codex notes)
- taxonomy_codex_chat6/7/8/9.txt capture milestones and pending items.
- Use this doc as the stable mental model; link features back here before adding tables/APIs.

...///full copyy///.......

1) Purpose & First Principles

Purpose. Median AI Flow orchestrates a school day across people, places, and programs. It guarantees that:

every program launches on time with the right people in the room,

learning & rituals run per SOP,

accountability is captured by role and by code (post), not hard-wired to a person,

each individual’s day is opened and closed with evidence.

Design principles.

Hierarchy before details. We reason top-down: MRI Family → Program → (Aims, SOP, Schedule).

Posts (codes) not people. Duty is attached to a code (e.g., EMS1), which is assigned to a person. People can churn; the post endures.

Local integrity. Identity & presence are proved at the scanner (QR today, biometric later).

One source of truth per artifact. Aims/SOP/Schedules live with the Program; attendance with Attendance; defaulters with NMRI; day-close with Day Close.

Evolvable. New programs/roles/subjects should be addable without schema upheaval.

2) The School Day, Conceptually

A typical day flows through four phases:

Day Open (Personal)

Each staff member opens their day (time window per user type).

Identity is proven at the local scanner (QR now; fingerprint later).

Successful open → “Present & Available” for schedules.

Program Windows (Institutional)

Day is partitioned into slots/periods (by division).

Slots host Programs (e.g., MSP under A-MRI).

Each Program runs by Aims, SOP, and Schedule (matrix of period × class → code/subject).

Closers (Program & Role)

Certain roles have RMRI closers (e.g., Moderator submits logs, checks lab records).

Programs may require evidence (e.g., GK/Computer lab log line).

Day Close (Personal)

An individual’s day “counts” only after they complete Day Close:
(1) MRI clearance (A-MRI, N-MRI, R-MRI), (2) assigned tasks, (3) routine tasks, (4) general log.

The app blocks “done” until these are cleared/submitted.

3) Hierarchy: MRI Families → Programs → Aims/SOP/Schedule
3.1 MRI Families (top layer)

A-MRIs (Academic). Programs like MSP (Morning School Program), MHCP-1/2 (Hostel Coaching), Exams, etc.

N-MRIs (Non-academic rituals). Prayer/Namaz, Meals, Breaks, Games.

NMRI Moderator + Guide TOD log discipline/punctuality/language defaulters during these windows.

R-MRIs (Role-based). Opener/Closer/Moderator/Conductor/Shutdown, approvals.

O-MRIs (Office). MOP-1 (morning office), MOP-1L (long day), MOP-2 (evening), MOP-3 (night) for managerial cadre.

3.2 Program anatomy (for every Program)

Aims/Objectives. Why it runs; outcomes to measure.

SOP (rules). Who may open/close; opener time-window; checks (e.g., PCC1 07:25–07:35, PCC2 12:00–12:10); substitution policy; compliance artifacts; escalation.

Schedule. The period grid (times) and, for each class×period, the post (code) and subject that must be present.

Today’s focus Program: A-MRI → MSP. It has two tracks: MSP-Pre (Pre-Primary) and MSP-Ele (Elementary). They share aims/SOP; their schedules differ.

4) Posts (Codes) & Families

We attach duty to codes (“posts”), then assign codes to people.

4.1 Pre-Primary (MSP-Pre) — two families only

PGL = Pre-Primary General (English, English-Writing, Math, GK, basic Science)
Posts: PGL1, PGL2, PGL3 (three needed → three classes simultaneously need general in some periods).

PRL = Pre-Primary Regional (Hindi, Hindi-Writing, Urdu)
Posts: PRL1, PRL2 (two needed → two language classes can run at once).

Identity examples (current staff mapping you gave):
PGL1→Bidhya, PGL2→Neha, PGL3→Jemi; PRL1→Jemi(Hindi), PRL2→Abid(Urdu).
(Any person may hold multiple codes if no period conflicts.)

4.2 Elementary (MSP-Ele) — four families

EMS (Math & Science) → EMS1, EMS2

ESLC (English & S.St) → ESLC1, ESLC2

EUA (Urdu/QT & Arabic) → EUA1, EUA2 (+ EUA3, EUA4 if staffing requires)

EHO (Hindi & GK/Computer) → EHO1, EHO2

Identity examples (per your list):
EMS1→Rajen (Sci), EMS2→Yasmine (Math); ESLC1→Najmeh (+ half-relief via ESLC1(2)→Bidhya); ESLC2→Pemba.
EUA1→Abid, EUA2→Habib, EUA3→Tariq, (EUA4 reserve).
EHO1→Wasim (Hindi), EHO2→Aurangzeb (GK) with Computer slices delegated to Asad.

Leisure rule (Ele). Each code teaches max 7 of 8 periods → exactly one leisure daily.
Substitution rule. If a teacher is absent, propose the leisure code first; Moderator approves one-tap swap.

5) Program: MSP (A-MRI) — Aims, SOP, Schedule
5.1 Aims

Start every academic day with verified co-presence; end with complete evidence.

Deliver all planned periods with the right code in place; guarantee coverage despite churn.

Enforce PCC1/PCC2 classroom compliance and, where applicable, GK/Computer lab log entries.

Keep absences/substitutions transparent (code never double-booked).

5.2 SOP

Opener: authorized Moderators (MSP-MOD, MSP-Pre-MOD) launch a scanner session (daily, 06:30–06:55).

Identity (today): QR/Webcam ritual:

Manager laptop shows a rotating session QR (nonce, short TTL).

Each member (logged in) shows their personal daily QR on phone.

The webcam scans the phone’s QR → /api/attendance/ingest creates a signed, one-time attendance event.

Hard constraints: time-window, device fingerprinting, on-premise signals (Wi-Fi SSID/latency), and optional face snapshot to deter spoofing.

Identity (later): Biometric via E-Time Office Z500V2W:

Poll TIMEOFFICE_API_BASE with TIMEOFFICE_TOKEN, TIMEZONE, ATTENDANCE_SYNC_LOOKBACK_MIN to fetch device punches.

Map device user codes ↔ users; dedupe by transaction id; upsert as attendance events.

Fallback to QR if machine is down (your current state).

Checks:

PCC1 07:25–07:35: attendance, absence notes, journals/diaries verified.

PCC2 12:00–12:10: CCD/CDD/diary re-check.

Substitution: leisure-first; Moderator approval recorded.

Compliance artifacts: EHO GK/Computer → lab log line per session.

Incidents: quick tap defects (late start, missing log) recorded to general logs and visible at Day Close.

5.3 Schedule (two tracks)
MSP-Pre (Pre-Primary)

Families: PGL (PGL1–3), PRL (PRL1–2) only.

Grid: For each class (Nursery, LKG, UKG) and period (P1..P8) we bind code + subject.

Concurrency math: peak PGL=3 (P3 GK across all three classes), PRL=2 (P6/P7 language).

Loads: light (3–5 periods per code per day); many free slots.

Flexibility: micro-rebind within family (e.g., free PGL3 covers PGL1 at P1–P2 if Bidhya is delegated to ESLC1).

MSP-Ele (Elementary)

Families: EMS/ESLC/EUA/EHO (two posts each).

Grid: Period matrix per Class 1..7 (we already produced a clash-free matrix).

Leisure guarantee: each code has exactly one leisure period; family peak concurrency = 2 → two posts are sufficient.

Special compliance: EHO handles GK/Computer; add lab-log checklist to those cells.

6) N-MRI (Rituals) — Moderator & Guide TOD

Whenever N-MRI windows occur (e.g., Break/Namaz):

NMRI Moderator opens the slot and logs defaulters for Punctuality, Language, Discipline.

Guide TOD co-signs execution (ritual conducted; space orderly).

Artifacts: One row per defaulter (date, student, type, reportedBy).

Downstream: Counts feed student discipline analytics and teacher coaching.

7) R-MRI (Role-based) — Openers, Closers, Approvals

Openers/Closers are role-tasks that travel with roles (not people).

Examples: MSP-MOD (program opener + PCC checks), Shutdown Conductor (device off, space closed), Day-Close Owner (personal close).

Approvals: certain submissions (e.g., late substitution) require a role’s approval.

8) O-MRI (Office) — MOP-1/MOP-1L/MOP-2

MOP-1 aligns with morning academic window; MOP-1L extends to 5pm for some roles; MOP-2 4–10pm for managers.

Each is a program with its own Aims/SOP/Schedule (e.g., counters open, logs, cash handling), and attendance is captured by the same opener ritual (QR now; biometric later).

9) Governance & Admin

Calendars: schoolCalendar (terms & weeks) activates programs per week type (“General”, “Exam”, “Event”, “Holiday”).

Roles & Tasks:

RMRI roles (e.g., MSP Moderator, MHCP1 Moderator) → grant opener/closer rights.

Role-tasks map roles to default tasks (e.g., MSP Moderator → Day opener task, PCC1/PCC2 checks).

Code assignments (team creation):

Create codes once; assign to people with start/end dates.

Use period delegations for partial reliefs (e.g., Najmeh → Bidhya for half of ESLC1).

Optionally sub-codes for UI clarity (ESLC1(1), ESLC1(2)), still rolling up to parent ESLC1.

Change management: New subject or teacher? Update the matrix (Schedule) or the code assignment—reports stay continuous because they attach to codes.

10) Identity & Integrity (attendance)

Now (QR/Webcam).

Session QR on manager laptop (rotates every 15–30s; contains session id + nonce + signature).

Personal QR on member phone (short-lived, includes user id + day + nonce + HMAC keyed by server).

Webcam scan pairs (session, user) and posts a one-time attendance with geo/Wi-Fi fingerprint.

Optional face snapshot for extra assurance; automatic tamper signals (replay/duplicate/expired).

Later (Biometric).

Sync from E-Time Office Z500V2W via REST (TIMEOFFICE_API_BASE, TIMEOFFICE_TOKEN, TIMEZONE, ATTENDANCE_SYNC_LOOKBACK_MIN).

Map device users to app users; ingest as the same attendance event type; keep QR as fallback.

11) Day Close (personal, mandatory)

Each person’s day closes only after:

MRI Clearance:

A-MRI: program duties checked off (e.g., MSP periods delivered; if any missing → substitution/justification).

N-MRI: NMRI defaulter submissions (if role-holder).

R-MRI: required role closers (e.g., Moderator report).

Assigned Tasks: anything assigned that day is resolved or moved to status with comment.

Routine Tasks: daily routines updated (statuses, notes).

General Log: quick free-text summary (what worked, blockers).

Only then can Day Close mark the person complete.

12) Data Model — conceptual entities (no code)

MRI Family (A/N/R/O) → has many Programs.

Program → has Aims, SOP, Schedules (per track).

Schedule (track) → defines periods and a matrix: (class × period → {code, subject}).

Code (post) → belongs to a Family; is assigned to Users over time.

Delegation (optional) → overrides (code, date, period, class) to a delegate user.

Rebind (optional) → swaps (fromCode → toCode) within a family for a specific slot (pre-primary micro-rotation).

Attendance Event → produced by QR or Biometric; ties to user & time.

Defaulter Log (NMRI) → (date, student, type, reportedBy).

Open/Close Tasks & Evidence → generated from SOP; attached to roles and programs.

Day Close → aggregates completion across a person’s artifacts.

13) Evolution Playbook

Add a new Family: create it once; then add Programs under it.

Add a new Program: fill Aims, SOP, Schedules (matrix by codes).

Change subjects/periods: edit the matrix; codes remain stable.

Teacher churn: end a code assignment; start a new one.

Partial relief: add a delegation for those period slices (or express as sub-codes in the matrix).

Grow Pre-Primary: still just PGL/PRL; increase posts if concurrency grows (PGL4, PRL3…).

Integrate new devices: add a new attendance source that produces the same Attendance Event type.

14) Controls, Risks, and Safeguards

No double-booking. The scheduler enforces one code per period; delegations/rebinds are applied after the base matrix and validated.

Max-load. Elementary codes capped at 7/8 periods (one leisure).

Anti-spoof attendance. Short-TTL QR, server HMACs, replay detection, on-prem checks; biometric sync when live.

Auditability. Everything critical (openers, substitutions, lab logs, NMRI defaulters) produces immutable entries.

Privacy. Only capture the minimum (optional face snapshot behind an explicit toggle and retention policy).

15) Example Walk-Through (one day)

06:30–06:55 Moderator starts the scanner session. Staff queue, show personal QR, get “Day Opened”.
07:25–07:35 (PCC1) Moderator checks attendance, journals/diaries.
Morning periods auto-spawn from MSP schedules: each class×period resolves to a code; the person holding that code gets the duty.

Example: ESLC1 P1 (Class 2 S.St) is delegated to Bidhya today; PGL1 P1/P2 rebound to PGL3 to free her.
12:00–12:10 (PCC2) Final checks (CCD/CDD).
Later NMRI windows log defaulters (Moderator + Guide TOD).
Afternoon/evening MHCP/MOP windows run similarly (own Programs).
Day Close each staff member clears MRI → Assigned → Routine → General; the app marks them done only after completion.

16) Glossary (quick)

MRI Family: A/N/R/O clusters of institutional activity.

Program: A runbook under a Family with Aims/SOP/Schedule.

Code (Post): A seat of responsibility (e.g., EMS1) that a person can occupy.

Track: A division variant of a Program (e.g., pre_primary vs elementary).

PCC1/PCC2: Classroom compliance checkpoints (morning/noon).

Delegation/Rebind: Temporary override of who covers a slice / which sibling code covers a slot.

Moderator: Role that opens, checks, substitutes, and closes a Program window.

TL;DR

We run by hierarchy (Family→Program→Aims/SOP/Schedule).

We staff by codes (posts), not people, so churn is painless.

MSP is live now: PGL/PRL for Pre-Primary; EMS/ESLC/EUA/EHO for Elementary; QR attendance today, biometric later.

Everyone opens locally, executes per schedule, and closes with evidence.

Admin defines roles, codes, and programs; the scheduler binds periods to codes and the app enforces integrity.