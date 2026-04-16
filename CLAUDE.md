# AI Ticket Management — Claude Code Instructions

## Project Overview

An AI-powered ticket management system built as a monorepo with `/client` (React) and `/server` (Express) directories.

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, React Router
- **Backend**: Node.js + Express + TypeScript, session-based auth
- **Database**: PostgreSQL via Prisma ORM
- **AI**: Claude API (Anthropic) — ticket classification, summaries, suggested replies
- **Email**: SendGrid or Mailgun — inbound webhooks + outbound replies
- **Deployment**: Docker + cloud provider

## Documentation

Always use the **context7 MCP server** to fetch up-to-date documentation before working with any library, framework, or API. This applies to all libraries in this project:

- `react`, `react-router`
- `tailwindcss`
- `express`
- `prisma`
- `@anthropic-ai/sdk`
- `typescript`
- Any other third-party package used in `/client` or `/server`

Use context7 even for well-known libraries — training data may not reflect the current API.

### How to use context7

1. Resolve the library ID: `mcp__context7__resolve-library-id` with the library name
2. Fetch the docs: `mcp__context7__query-docs` with the resolved ID and a focused topic query

## Project Structure

```
/client     — React frontend
/server     — Express backend
```

## Testing

### E2E Tests (Playwright)

Always use the **`playwright-e2e-writer` agent** when writing end-to-end tests. Invoke it via the Agent tool with `subagent_type: "playwright-e2e-writer"`.

Use this agent for:
- Writing new E2E tests for completed features
- Expanding test coverage for existing user flows
- Creating test suites for critical paths (auth, ticket creation, dashboard, etc.)

The test environment uses isolated ports (5174 for client, 3002 for server) and a separate test database (`helpdesk_test`). See `playwright.config.ts` and `e2e/global-setup.ts` for configuration details.

## Implementation Plan

See `implementaion-plan.md` for the full phase-by-phase plan (Phases 1–8).
