# Pam Golding Rentals Organiser

A mobile-first internal workspace for rental managers, agents and assistants.

## Current prototype

- Daily dashboard with automatic urgency ordering
- Red overdue and urgent indicators
- Assignable tasks with property, date, time and priority
- Task completion and filters for mine, urgent and completed
- Team workload summary
- Outlook calendar connection placeholder
- Responsive desktop and mobile navigation

## Next production phase

The production version will add authenticated manager and team profiles, a shared database, recurring reminders, task notifications, an audit trail and Microsoft Graph OAuth for live Outlook calendars. The recommended Vercel stack is Next.js with Supabase/Postgres and Microsoft Entra ID.

## Local development

```bash
npm install
npx next dev
```

## Vercel

Import the GitHub repository in Vercel. Before enabling live data, configure the database and Microsoft Graph environment variables in Vercel.
