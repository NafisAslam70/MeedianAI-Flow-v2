Escalations (Managerial) — Product & System Design (No Code)

Purpose
- Create a two‑level, auditable escalation workflow under Managerial where managers raise matters, assignees act (escalate to L2 or close), and the system records a full timeline. If any member is involved in an active escalation, their Day Close is paused until all related escalations are closed (admin override allowed).

Navigation & IA
- Managerial → Escalations (tabs)
  - New Escalation
  - For You
  - Raised by Me
  - All (Admin)

Roles & Permissions
- Create escalation: manager, coordinator, principal, admin
- Act (Escalate/Close): current assignee or admin
- View All: admin
- View For You: authenticated user (current assignee)
- View Raised by Me: authenticated user (creator)

Core Concepts & States
- Matter: title, description, createdBy, currentAssignee, level (1/2), status, timestamps
- Involved Members: users directly implicated; Day‑Close pause population
- Steps (Timeline): immutable action log: CREATED, ESCALATE, CLOSE (who, when, note)
- Status: OPEN → ESCALATED (if moved to L2) → CLOSED
- Level: 1 or 2 (cap at 2 for MVP)
- currentAssignee: who must act next (null after close)

Allowed Actions
- Create: level=1, status=OPEN, currentAssignee=L1; add step CREATED
- Escalate (L1 only): level=2, status=ESCALATED, currentAssignee=L2; add step ESCALATE (optional note)
- Close: status=CLOSED, currentAssignee=null; add step CLOSE (required note)

Day‑Close Integration (Pause Rule)
- If a user is listed in any active (non‑closed) Matter, their Day Close is PAUSED
- Effects: block submit/finalize; show banner and links to matters; allow view/drafts
- Unpause when all their matters are CLOSED
- Admin override (audited reason) lets Day Close proceed despite open matters; ends manually or when all matters close
- Badges: PAUSED / OVERRIDDEN in user header and Day‑Close card

Forms & Screens (UX)
- New Escalation (Form)
  - Fields: Title (req), Description (opt), Members Involved (multi), Level‑1 Assignee (req), Suggested L2 (opt)
  - On submit: create Matter, assign L1, record CREATED, pause involved members
- For You: list where currentAssignee=me; show title, level, status, creator, createdAt, involved, buttons: Escalate (if L1), Close
- Raised by Me: list matters I created
- All (Admin): filter by status/level/creator/assignee/date; counts and aging
- Detail: header pills, involved members with pause icons, timeline, actions; admin override/reassign controls

Notifications (hooks; optional now)
- On create → L1 assignee
- On escalate → L2 assignee
- On close → creator and involved members
- Delivery: in‑app first; later email/WhatsApp/push

Data Model (proposed; no code)
- escalations_matters
  - id (pk)
  - title text, description text
  - created_by_id int → users.id
  - current_assignee_id int null → users.id
  - suggested_level2_id int null → users.id
  - status enum('OPEN','ESCALATED','CLOSED')
  - level int (1|2)
  - created_at, updated_at timestamptz
- escalations_matter_members
  - id (pk)
  - matter_id int → escalations_matters.id
  - user_id int → users.id
  - created_at timestamptz
- escalations_steps
  - id (pk)
  - matter_id int → escalations_matters.id
  - level int (1|2)
  - action enum('CREATED','ESCALATE','CLOSE')
  - from_user_id int null → users.id
  - to_user_id int null → users.id
  - note text null (required for CLOSE)
  - created_at timestamptz default now()
- day_close_overrides (optional materialization for audits)
  - id (pk)
  - user_id int → users.id
  - matter_id int null → escalations_matters.id
  - reason text
  - active boolean default true
  - created_by int → users.id (admin)
  - created_at, ended_at timestamptz

APIs (proposed; no code)
- Base: /api/managersCommon/escalations
- POST / (create)
  - body: { title, description?, involvedUserIds: number[], l1AssigneeId: number, suggestedL2Id? }
- GET /for-you
  - lists where currentAssigneeId = me
- GET /raised-by-me
  - lists where createdById = me
- GET /all (admin)
  - query: status?, level?, creatorId?, assigneeId?, dateFrom?, dateTo?
- GET /:id (detail)
- PATCH /:id/escalate
  - body: { l2AssigneeId: number, note?: string }
  - preconditions: current level = 1 and current assignee = me (or admin)
- PATCH /:id/close
  - body: { note: string }
  - allowed: current assignee or admin
- PATCH /overrides (admin)
  - upsert override: { userId, active, reason }

Day‑Close Pause (derived MVP)
- Compute isPaused(userId) via query:
  - SELECT count(*) FROM escalations_matters em
    JOIN escalations_matter_members mm ON mm.matter_id = em.id
    WHERE mm.user_id = $userId AND em.status <> 'CLOSED'
  - paused if count > 0 unless an active override exists for user
- Show banner + disable finalize in Day‑Close UI when paused and no override

Business Rules & Validation
- Title length ≥ 3
- L1 assignee required on create
- Escalate allowed only at level=1; requires L2 assignee
- Close requires action note
- Steps are append‑only; never mutate
- Closing re‑evaluates pause for all involved members

Reporting & Metrics (Phase 1)
- Counts: Open@L1, Open@L2, Closed(7d/30d)
- Aging: time in status; highlight >N days
- Top creators/assignees; most involved members
- Day‑Close impact: users paused now; avg pause duration

Auditability & Observability
- Steps record who/when/action/note immutably
- Log admin overrides with reason start/end
- Minimal error logs for failed transitions

Edge Cases & Conflict Handling
- Simultaneous actions: single‑writer per matter; conflicting PATCH returns 409/"refresh"
- Edit involved list: allowed by creator only while steps count == 1 (CREATED); afterwards admin only
- Reassign: admin can reassign `currentAssigneeId`; record REASSIGN step (future)
- Multiple matters: pause until all closed

UAT Scenarios (MVP)
- Create @L1 pauses involved; For You shows for L1; escalate to L2; close unpauses when last closes; multiple matters keep pause; admin override allows Day‑Close; permissions enforced; early edit allowed; all per spec.

Phase Plan
- Phase 1: core entities, L1/L2 transitions, timeline, derived pause, admin override, minimal in‑app notifications
- Phase 2: SLAs, analytics, bulk, exports, external channels, >2 levels, labels, attachments

Implementation Brief (Copy‑ready)
- Managerial → Escalations with tabs New/For You/Raised by Me/All (Admin)
- Matter: { title, description, createdById, currentAssigneeId, suggestedLevel2Id, status OPEN|ESCALATED|CLOSED, level 1|2, timestamps }
- Involved users: many‑to‑many; steps timeline append‑only
- Actions: Create (L1), Escalate (L1→L2), Close (note)
- Day‑Close Pause: derived from open matters; admin override with reason; badges
- Views and notifications as above; UAT scenarios 1–7 define Done

Notes
- This document defines scope and interfaces without code changes. Schema and API names may be adjusted during implementation to match existing conventions.

