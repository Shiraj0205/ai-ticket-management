---
name: E2E test infrastructure
description: File locations, POM structure, global-setup changes, and selector patterns established for this project
type: project
---

**Test files:**
- `e2e/auth.spec.ts` — 25 auth tests (happy paths, validation, session, RBAC, API guards)
- `e2e/users.spec.ts` — user management CRUD happy paths (list, create, edit, delete/soft-delete)
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

**API base URL for direct requests:** `http://localhost:3002`

**Why:** Vite proxy handles `/api` → `localhost:3002` in browser context, but Playwright's `request` fixture bypasses the proxy and needs the full origin.

**How to apply:** Use `page.request.post()` for programmatic login (uses browser cookie jar). Use the `request` fixture directly for pure API assertions (no browser context needed).
