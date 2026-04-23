---
name: Auth testing patterns
description: Key facts about the auth setup that every auth test must know — sign-up is disabled, seeded users exist, session cookies needed for API helpers
type: project
---

Sign-up via the UI is disabled (`disableSignUp: true` in Better Auth config). There is no sign-up page on the frontend. New users are created only through `POST /api/users` (admin-only) or via the seed script.

The seed creates two verified users in the test DB:
- `admin@example.com / admin123!` (role: ADMIN)
- `agent@example.com / agent123!` (role: AGENT)

`global-setup.ts` was updated to run `bun src/prisma/seed.ts` after migrations so these users always exist at test start.

**Why:** `emailVerification: requireEmailVerification: true` means only seeded/admin-created users can actually log in. The seed marks them `emailVerified: true`.

**How to apply:** Tests that need a fresh user must call `POST /api/users` with an admin session cookie, not try to sign up via the UI. The helper `createTestUser()` in `auth.spec.ts` handles this pattern.

Programmatic login (for setting up browser session state) uses `page.request.post()` to `http://localhost:3002/api/auth/sign-in/email` — this reuses the browser context's cookie jar so subsequent `page.goto()` calls are authenticated.
