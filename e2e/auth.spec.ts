/**
 * E2E tests for authentication flows.
 *
 * Setup assumptions
 * -----------------
 * - global-setup.ts runs `prisma migrate deploy` then the seed script.
 * - The seed creates two users in the test DB (helpdesk_test):
 *     admin@example.com / admin123!  (role: ADMIN, emailVerified: true)
 *     agent@example.com / agent123!  (role: AGENT, emailVerified: true)
 * - Sign-up via the UI is intentionally disabled (disableSignUp: true in
 *   Better Auth config). New users are created through POST /api/users
 *   (admin-only) or via the seed. Tests that need a fresh one-off user
 *   create it through the API before asserting UI behaviour.
 * - Rate limiting is production-only, so tests run without throttling.
 *
 * Test isolation
 * --------------
 * Every test starts from a clean browser context (Playwright's default).
 * Tests that mutate shared state (e.g. create a user) use a unique email
 * derived from the test's own timestamp so they never collide.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { LoginPage, AppShell } from "./pages/auth.page";

// ---------------------------------------------------------------------------
// Credentials — sourced from .env.test seed values. Never hardcode in
// assertions; always reference these constants.
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123!";

const AGENT_EMAIL = "agent@example.com";
const AGENT_PASSWORD = "agent123!";

const API_BASE = "http://localhost:3002";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a verified agent user via the admin-only POST /api/users endpoint.
 * Returns the email and password for use in subsequent test steps.
 */
async function createTestUser(
  request: APIRequestContext,
  opts: { email: string; name?: string; password?: string }
) {
  const password = opts.password ?? "TestPassword1!";

  // Obtain an admin session cookie via the Better Auth sign-in endpoint
  const signInRes = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(signInRes.ok(), "Admin sign-in for setup must succeed").toBeTruthy();

  // Extract the session cookie so subsequent requests are authenticated
  const cookieHeader = signInRes.headers()["set-cookie"] ?? "";

  const createRes = await request.post(`${API_BASE}/api/users`, {
    data: {
      name: opts.name ?? "Test User",
      email: opts.email,
      password,
    },
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
  });
  expect(
    createRes.status(),
    `Creating test user ${opts.email} should return 201`
  ).toBe(201);

  return { email: opts.email, password };
}

/**
 * Performs a programmatic login via the Better Auth HTTP endpoint so that
 * subsequent page.goto() calls start in an authenticated browser context.
 * Uses page.request (same browser context) so cookies are shared.
 */
async function loginViaApi(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  const res = await page.request.post(`${API_BASE}/api/auth/sign-in/email`, {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok(), `Programmatic login for ${email} must succeed`).toBeTruthy();
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test.describe("Happy paths", () => {
  test("1. signs in with valid credentials and lands on the dashboard", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(AGENT_EMAIL, AGENT_PASSWORD);

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("2. the app shell shows the user name and a sign-out button after login", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(AGENT_EMAIL, AGENT_PASSWORD);

    const shell = new AppShell(page);
    await shell.expectLoggedIn();
    // The user name "Agent" is rendered in the header by Layout.tsx
    await expect(page.getByText("Agent", { exact: true })).toBeVisible();
  });

  test("3. signs out and is redirected to /login", async ({ page }) => {
    // Start authenticated
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/");

    const shell = new AppShell(page);
    await shell.expectLoggedIn();

    await shell.signOut();

    await expect(page).toHaveURL("/login");
    // The login form should be visible again
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();
  });

  test("4. authenticated user visiting a protected route stays on that route", async ({
    page,
  }) => {
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/tickets");

    // Should stay on /tickets, not redirect to /login
    await expect(page).toHaveURL("/tickets");
    // The Tickets page heading
    await expect(
      page.getByRole("heading", { name: /tickets/i })
    ).toBeVisible();
  });

  test("5. unauthenticated user visiting a protected route is redirected to /login", async ({
    page,
  }) => {
    // No login — navigate directly to a protected route
    await page.goto("/tickets");

    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Validation / error paths
// ---------------------------------------------------------------------------

test.describe("Validation and error paths", () => {
  test("6. signing in with the wrong password shows a server error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(AGENT_EMAIL, "wrongpassword");

    await expect(loginPage.serverErrorAlert).toBeVisible();
    // Better Auth returns "Invalid email or password" for credential failures
    await expect(loginPage.serverErrorAlert).toContainText(/invalid/i);
  });

  test("7. signing in with a non-existent email shows a server error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login("nobody@example.com", "SomePassword1!");

    await expect(loginPage.serverErrorAlert).toBeVisible();
    await expect(loginPage.serverErrorAlert).toContainText(/invalid/i);
  });

  test("8. submitting an invalid email format shows a client-side validation error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.fillEmail("not-an-email");
    await loginPage.fillPassword("somepassword");
    await loginPage.submit();

    // react-hook-form validates before the network request is made
    await expect(loginPage.emailError).toBeVisible();
    await expect(loginPage.emailError).toContainText(
      /valid email/i
    );
    // No server request should have fired
    await expect(loginPage.serverErrorAlert).not.toBeVisible();
  });

  test("9. submitting with an empty password shows a client-side validation error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.fillEmail(AGENT_EMAIL);
    // Leave password empty
    await loginPage.submit();

    await expect(loginPage.passwordError).toBeVisible();
    await expect(loginPage.passwordError).toContainText(/required/i);
    await expect(loginPage.serverErrorAlert).not.toBeVisible();
  });

  test("10. submitting a completely empty form shows errors for both fields", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Click submit without filling anything
    await loginPage.submit();

    await expect(loginPage.emailError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
    await expect(loginPage.serverErrorAlert).not.toBeVisible();
  });

  test("11. after a failed login the error clears when the user corrects credentials", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // First: wrong password
    await loginPage.login(AGENT_EMAIL, "wrongpassword");
    await expect(loginPage.serverErrorAlert).toBeVisible();

    // Correct the password — the error should clear on the next submit
    await loginPage.fillPassword(AGENT_PASSWORD);

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/sign-in") &&
        res.request().method() === "POST"
    );
    await loginPage.submit();
    await responsePromise;

    // Successful login — no error, redirected to dashboard
    await expect(loginPage.serverErrorAlert).not.toBeVisible();
    await expect(page).toHaveURL("/");
  });

  /**
   * Sign-up via the UI is disabled (`disableSignUp: true`).
   * There is no sign-up page to test on the frontend; new users are created
   * exclusively through the admin API. Tests 12 and 13 below cover the admin
   * API-level duplicate email / short password rules.
   */
  test("12. admin API rejects duplicate email with 409", async ({
    request,
  }) => {
    // Sign in as admin to get a session cookie
    const signInRes = await request.post(
      `${API_BASE}/api/auth/sign-in/email`,
      {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(signInRes.ok()).toBeTruthy();
    const cookieHeader = signInRes.headers()["set-cookie"] ?? "";

    // Try to create a user with the already-seeded agent email
    const createRes = await request.post(`${API_BASE}/api/users`, {
      data: {
        name: "Duplicate Agent",
        email: AGENT_EMAIL,
        password: "SomePassword1!",
      },
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
    });

    expect(createRes.status()).toBe(409);
    const body = await createRes.json();
    expect(body.error).toMatch(/already in use/i);
  });

  test("13. admin API rejects a password shorter than 8 characters with 400", async ({
    request,
  }) => {
    const signInRes = await request.post(
      `${API_BASE}/api/auth/sign-in/email`,
      {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(signInRes.ok()).toBeTruthy();
    const cookieHeader = signInRes.headers()["set-cookie"] ?? "";

    const createRes = await request.post(`${API_BASE}/api/users`, {
      data: {
        name: "Short Pass",
        email: `shortpass-${Date.now()}@example.com`,
        password: "abc",
      },
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
    });

    expect(createRes.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Session / persistence
// ---------------------------------------------------------------------------

test.describe("Session persistence", () => {
  test("14. authenticated user refreshes the page and remains logged in", async ({
    page,
  }) => {
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/");

    const shell = new AppShell(page);
    await shell.expectLoggedIn();

    // Full page reload
    await page.reload();

    // Should still show the authenticated dashboard, not the login page
    await expect(page).toHaveURL("/");
    await expect(shell.signOutButton).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("15. after sign-out, back-button navigation to a protected route redirects to /login", async ({
    page,
  }) => {
    // Start on the dashboard
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/");
    await expect(page).toHaveURL("/");

    // Navigate to the tickets page so there is a meaningful back-stack entry
    await page.goto("/tickets");
    await expect(page).toHaveURL("/tickets");

    // Sign out
    const shell = new AppShell(page);
    await shell.signOut();
    await expect(page).toHaveURL("/login");

    // Use the browser back button — this should bounce back to /login because
    // the session is gone and ProtectedRoute redirects unauthenticated users.
    await page.goBack();

    // React Router immediately redirects to /login once it detects no session.
    // Wait briefly for the redirect to complete.
    await expect(page).toHaveURL("/login");
  });

  test("16. session is scoped to the browser context — a new context starts unauthenticated", async ({
    browser,
  }) => {
    // Context A — signs in
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginViaApi(pageA, AGENT_EMAIL, AGENT_PASSWORD);
    await pageA.goto("/");
    await expect(pageA).toHaveURL("/");

    // Context B — shares no cookies with context A
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto("/");
    await expect(pageB).toHaveURL("/login");

    await contextA.close();
    await contextB.close();
  });

  test("17. session persists across navigating to multiple protected routes", async ({
    page,
  }) => {
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);

    await page.goto("/");
    await expect(page).toHaveURL("/");

    await page.goto("/tickets");
    await expect(page).toHaveURL("/tickets");
    await expect(
      page.getByRole("heading", { name: /tickets/i })
    ).toBeVisible();

    // Navigate back to dashboard via the sidebar link
    await page.getByRole("link", { name: /dashboard/i }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Role-based access control
// ---------------------------------------------------------------------------

test.describe("Role-based access", () => {
  test("18. admin user can access /users route", async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    // Users page should load; not redirect to /login or /
    await expect(page).toHaveURL("/users");
    await expect(
      page.getByRole("heading", { name: /users/i })
    ).toBeVisible();
  });

  test("19. agent user is redirected away from /users to the dashboard", async ({
    page,
  }) => {
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/users");

    // AdminRoute redirects non-admins to /
    await expect(page).toHaveURL("/");
  });

  test("20. unauthenticated user trying /users is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/login");
  });

  test("21. admin sidebar shows Users link; agent sidebar does not", async ({
    page,
    browser,
  }) => {
    // Agent — no Users link
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /users/i })
    ).not.toBeVisible();

    // Admin — Users link present
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginViaApi(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminPage.goto("/");
    await expect(
      adminPage.getByRole("link", { name: /users/i })
    ).toBeVisible();

    await adminContext.close();
  });
});

// ---------------------------------------------------------------------------
// Authenticated redirect (already-logged-in user visiting /login)
// ---------------------------------------------------------------------------

test.describe("Authenticated user on /login", () => {
  test("22. visiting /login while already authenticated redirects to the dashboard", async ({
    page,
  }) => {
    await loginViaApi(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/login");

    // AppRoutes renders <Navigate to="/" replace /> when user is set
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// API-level auth guard (non-browser)
// ---------------------------------------------------------------------------

test.describe("API auth guards", () => {
  test("23. unauthenticated request to protected API returns 401", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/tickets`);
    expect(res.status()).toBe(401);
  });

  test("24. authenticated request to /api/tickets succeeds", async ({
    request,
  }) => {
    const signInRes = await request.post(
      `${API_BASE}/api/auth/sign-in/email`,
      {
        data: { email: AGENT_EMAIL, password: AGENT_PASSWORD },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(signInRes.ok()).toBeTruthy();
    const cookieHeader = signInRes.headers()["set-cookie"] ?? "";

    const ticketsRes = await request.get(`${API_BASE}/api/tickets`, {
      headers: { Cookie: cookieHeader },
    });
    expect(ticketsRes.ok()).toBeTruthy();
  });

  test("25. non-admin request to admin-only /api/users returns 403", async ({
    request,
  }) => {
    const signInRes = await request.post(
      `${API_BASE}/api/auth/sign-in/email`,
      {
        data: { email: AGENT_EMAIL, password: AGENT_PASSWORD },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(signInRes.ok()).toBeTruthy();
    const cookieHeader = signInRes.headers()["set-cookie"] ?? "";

    const res = await request.get(`${API_BASE}/api/users`, {
      headers: { Cookie: cookieHeader },
    });
    expect(res.status()).toBe(403);
  });
});
