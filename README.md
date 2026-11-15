# MeedianAI Flow (v2)

A role-based operations platform that brings schedules, routines, tasks, attendance, communication, and reporting into one workspace for school and community teams. This is the most feature-rich iteration among the MeedianAI Flow repositories reviewed.

## Verified capabilities
- Role-based admin, team-manager, and member dashboards
- Deep Calendar schedule and active-block views
- Task assignment, routine tracking, leave/day-close approvals, tickets, and escalations
- QR-based attendance and campus gate in/out workflows
- Community posts, announcements, direct messaging, and collaboration tools
- Student enrollment/enquiry and guardian workflows
- Hostel daily-due reporting with role-based review and escalation
- Finance-related student ledger and dues integration

## Tech
Next.js 15, React 19, NextAuth, PostgreSQL, Drizzle ORM, Prisma, Redis, Tailwind CSS, and integrations including Cloudinary, Twilio, and AI/translation providers.

## Run locally
```bash
npm install
npm run dev
```

The application needs database and external-service credentials for data-backed features. Review `TECH_STACK.txt`, `docs/Overview.md`, and `docs/Features.md` for architecture and setup context.
