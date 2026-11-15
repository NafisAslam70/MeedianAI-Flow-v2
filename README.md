# MeedianAI Flow

MeedianAI Flow is a school and community operations platform. The repository contains a large Next.js application with a dashboard, APIs, database integrations, and workflows for managing members and school operations.

## Platform areas
The codebase includes routes and services for dashboards, user and role management, school and hostel workflows, finance-related features, and communication integrations. Feature availability depends on configuration and connected services.

## Tech
Next.js, React, PostgreSQL, Drizzle ORM, Prisma, Redis, Tailwind CSS, and integrations including Cloudinary, Twilio, and translation/AI providers.

## Run locally
```bash
npm install
npm run dev
```

Configure the database and any required authentication, storage, messaging, and AI provider credentials in environment variables. Never commit secrets. See `TECH_STACK.txt` and the project configuration for details.
