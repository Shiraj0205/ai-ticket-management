---
name: E2E test infrastructure
description: File locations, POM structure, global-setup changes, and selector patterns established for this project
type: project
---

**Test files:**
- `e2e/auth.spec.ts` — 25 auth tests (happy paths, validation, session, RBAC, API guards)
- `e2e/users.spec.ts` — user management CRUD happy paths (list, create, edit, delete/soft-delete)
- `e2e/webhooks.spec.ts` — inbound-email webhook (secret auth, payload validation, DB persistence)
- `e2e/ticket-agent-assignment.spec.ts` — 7 tests covering agent assignment on TicketDetailPage
- `e2e/pages/auth.page.ts` — LoginPage and AppShell Page Object Models
- `e2e/global-setup.ts` — updated to run seed after migrations
- `e2e/global-teardown.ts` — resets test DB with `prisma migrate reset --force`

**Page Object Models:**
- `LoginPage`: wraps `/login` form; has `login(email, password)` method that waits for `/api/auth/sign-in` response before returning
- `AppShell`: wraps the authenticated Layout shell; has `signOut()` that waits for `/api/auth/sign-out` response

**Selector patterns used:**
- Email field: `page.getByLabel("Email address")` — matches the `<label>` in LoginPage.tsx
- Password field: `page.getByLabel("Password")` — matches the `<label>` in LoginPage.tsx
- Submit button: `page.getByRole("button", { name: /sign in/i })`
- Sign-out button: `page.getByRole("button", { name: /sign out/i })`
- Server error: `div.bg-red-50 p.text-sm.text-red-700`
- Client validation errors: `p.text-red-600` filtered by text content
- UsersPage table rows scoped by email: `page.getByRole("row").filter({ hasText: email })`
- Modal container: `page.locator("div.fixed.inset-0")`
- CreateUserModal/EditUserModal inputs: target by type within modal (`input[type='text']`, `input[type='email']`, `input[type='password']`) — labels lack `htmlFor` so `getByLabel` is unreliable
- Role select in EditUserModal: `modal.getByRole("combobox")`
- "New Agent" button on UsersPage: `page.getByRole("button", { name: /new agent/i })`
- TicketDetailPage agent select (no `htmlFor`): `page.locator("label").filter({ hasText: "Assigned Agent" }).locator("..")` to scope to the panel, then `.getByRole("combobox")` within it
- TicketDetailPage heading for load check: `page.getByRole("heading", { name: /ticket management/i })`

**TicketDetailPage — agent assignment notes:**
- `PATCH /api/tickets/:id` with `{ assignedAgentId }` is ADMIN-only (adminUpdateSchema). Tests must log in as admin.
- `GET /api/tickets/agents` returns `{ id, name }` only — no `email`. The email shown below the select comes from `ticket.assignedAgent.email` on the ticket object itself.
- Each test creates its own ticket via `POST /api/tickets` through the Vite proxy (same session cookie) and pre-conditions "already assigned" state via direct API call before navigating to the detail page.
- Use `page.route(url, handler)` with an artificial delay + `resolveRoute` promise to observe the `disabled` state on selects while a TanStack Query mutation is in-flight.
- `getAgentId(page, name)` helper fetches `/api/tickets/agents` and looks up by name — used to get the seeded "Agent" user's DB id at runtime (UUIDs are not hardcodable).

**API base URL for direct requests:** `http://localhost:3002`

**Why:** Vite proxy handles `/api` → `localhost:3002` in browser context, but Playwright's `request` fixture bypasses the proxy and needs the full origin.

**How to apply:** Use `page.request.post()` for programmatic login (uses browser cookie jar). Use the `request` fixture directly for pure API assertions (no browser context needed).

**Webhook / secret-header pattern:**
- Pass `secret: null` to `postWebhook` helper to omit the `X-Webhook-Secret` header entirely (tests the missing-header 403 case).
- Pass `secret: "wrong-value"` to test wrong-secret 403.
- To verify a webhook-created ticket persists, call `adminSessionCookie(request)` to get a session cookie, then `GET /api/tickets/:id` with `Cookie` header — the tickets route requires auth even for reads.
- `server/.env.test` must contain `WEBHOOK_SECRET="change-this-to-a-long-random-string"` for webhook tests to pass.
