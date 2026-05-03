/**
 * E2E tests for user management (CRUD) — happy paths only.
 *
 * Setup assumptions
 * -----------------
 * - global-setup.ts runs `prisma migrate deploy` then the seed script.
 * - The seed creates two users in the test DB (helpdesk_test):
 *     admin@example.com / admin123!  (role: ADMIN, emailVerified: true)
 *     agent@example.com / agent123!  (role: AGENT, emailVerified: true)
 * - All tests run as the admin because /users is admin-only.
 *
 * Test isolation
 * --------------
 * Tests that create users use unique emails derived from Date.now() to
 * avoid collisions across parallel runs. The global teardown resets the
 * database so state never bleeds between full suite runs.
 */

import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123!";
const AGENT_EMAIL = "agent@example.com";

// Vite dev proxy — all browser-context requests go through here so the
// session cookie is set for localhost:5174 (the app's origin).
const APP_BASE = "http://localhost:5174";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Performs a programmatic login via Better Auth so that subsequent
 * page.goto() calls start in an authenticated browser context.
 * Uses page.request (same browser context) so cookies are shared.
 * Posts through the Vite proxy so the cookie domain matches the app.
 */
async function loginViaApi(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  const res = await page.request.post(`${APP_BASE}/api/auth/sign-in/email`, {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok(), `Programmatic login for ${email} must succeed`).toBeTruthy();
}

/**
 * Creates a user via the admin API using the page's existing browser session.
 * Call this AFTER loginViaApi so page.request already carries the admin cookie.
 */
async function createUserViaApi(
  page: import("@playwright/test").Page,
  opts: { name: string; email: string; password?: string }
): Promise<{ id: string; name: string; email: string; role: string }> {
  const res = await page.request.post(`${APP_BASE}/api/users`, {
    data: {
      name: opts.name,
      email: opts.email,
      password: opts.password ?? "TestPassword1!",
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status(), `Creating user ${opts.email} should return 201`).toBe(201);
  return res.json();
}

// ---------------------------------------------------------------------------
// List users
// ---------------------------------------------------------------------------

test.describe("List users", () => {
  test("admin navigates to /users and sees the seeded users in the table", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();

    // The admin row is present
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
    // The agent row is present
    await expect(page.getByText(AGENT_EMAIL)).toBeVisible();
  });

  test("the users count in the sub-heading reflects the number of users", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    // Heading below the page title shows "<n> users total"
    await expect(page.getByText(/\d+ users? total/i)).toBeVisible();
  });

  test("the current admin user row is tagged with (you)", async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    // The UsersPage renders "(you)" next to the row belonging to the signed-in user
    await expect(page.getByText("(you)")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Create user
// ---------------------------------------------------------------------------

test.describe("Create user", () => {
  test("admin opens the create modal, fills the form, and the new user appears in the table", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    const uniqueEmail = `newagent-${Date.now()}@example.com`;
    const userName = "New Test Agent";

    // Open the create modal via the "New Agent" button
    await page.getByRole("button", { name: /new agent/i }).click();

    // Modal heading confirms we are in create mode
    await expect(
      page.getByRole("heading", { name: /create agent/i })
    ).toBeVisible();

    const modal = page.locator("div.fixed.inset-0");
    await modal.getByText("Name", { exact: true }).waitFor();

    await modal.locator("input[type='text']").fill(userName);
    await modal.locator("input[type='email']").fill(uniqueEmail);
    await modal.locator("input[type='password']").fill("SecurePass1!");

    // Wait for the POST /api/users response before asserting the table
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/users") &&
        res.request().method() === "POST"
    );

    await page.getByRole("button", { name: /create agent/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Modal should close after success
    await expect(
      page.getByRole("heading", { name: /create agent/i })
    ).not.toBeVisible();

    // The new user should appear in the table, scoped by the unique email row
    const newRow = page.getByRole("row").filter({ hasText: uniqueEmail });
    await expect(newRow.getByText(userName)).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Edit / update user
// ---------------------------------------------------------------------------

test.describe("Edit user", () => {
  test("admin opens the edit modal for a user, changes the name, and the table reflects the update", async ({
    page,
  }) => {
    // Login first so page.request carries the admin session for createUserViaApi
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const uniqueEmail = `editable-${Date.now()}@example.com`;
    const originalName = "Editable Agent";
    await createUserViaApi(page, { name: originalName, email: uniqueEmail });

    await page.goto("/users");

    // Confirm the user row is visible
    await expect(page.getByText(originalName)).toBeVisible();

    // Locate the row for this specific user and click its Edit button
    const userRow = page.getByRole("row").filter({ hasText: uniqueEmail });
    await userRow.getByRole("button", { name: /edit/i }).click();

    // The edit modal should appear
    await expect(
      page.getByRole("heading", { name: /edit user/i })
    ).toBeVisible();

    const updatedName = "Updated Agent Name";
    const nameInput = page.locator("div.fixed.inset-0").locator("input[type='text']").first();

    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Wait for the PATCH response before asserting the table
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/users/") &&
        res.request().method() === "PATCH"
    );

    await page.getByRole("button", { name: /save changes/i }).click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: /edit user/i })
    ).not.toBeVisible();

    // Updated name should appear in the user's row; original name should be gone from that row
    const updatedRow = page.getByRole("row").filter({ hasText: uniqueEmail });
    await expect(updatedRow.getByText(updatedName)).toBeVisible();
    await expect(updatedRow.getByText(originalName)).not.toBeVisible();
  });

  test("admin promotes an agent to ADMIN role via the edit modal", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const uniqueEmail = `promote-${Date.now()}@example.com`;
    await createUserViaApi(page, {
      name: "Promotable Agent",
      email: uniqueEmail,
    });

    await page.goto("/users");

    await expect(page.getByText(uniqueEmail)).toBeVisible();

    // Open the edit modal for this user
    const userRow = page.getByRole("row").filter({ hasText: uniqueEmail });
    await userRow.getByRole("button", { name: /edit/i }).click();

    await expect(
      page.getByRole("heading", { name: /edit user/i })
    ).toBeVisible();

    // Change the role selector to ADMIN
    const modal = page.locator("div.fixed.inset-0");
    await modal.getByRole("combobox").selectOption("ADMIN");

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/users/") &&
        res.request().method() === "PATCH"
    );

    await page.getByRole("button", { name: /save changes/i }).click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    // Modal closes
    await expect(
      page.getByRole("heading", { name: /edit user/i })
    ).not.toBeVisible();

    // The user's row should now show the Admin role badge
    const updatedRow = page.getByRole("row").filter({ hasText: uniqueEmail });
    await expect(updatedRow.getByText("Admin")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Delete user (soft delete)
// ---------------------------------------------------------------------------

test.describe("Delete user", () => {
  test("admin deletes a user, confirms the dialog, and the user disappears from the table", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const uniqueEmail = `deletable-${Date.now()}@example.com`;
    const userName = "Deletable Agent";
    await createUserViaApi(page, { name: userName, email: uniqueEmail });

    await page.goto("/users");

    // Confirm the user is present before we delete
    await expect(page.getByText(uniqueEmail)).toBeVisible();

    // Register the dialog handler before clicking so it fires synchronously
    page.once("dialog", (dialog) => dialog.accept());

    // Click the Delete button in the user's row
    const userRow = page.getByRole("row").filter({ hasText: uniqueEmail });
    await userRow.getByRole("button", { name: /delete/i }).click();

    // Wait for the DELETE API call to complete
    const deleteResponse = await page.waitForResponse(
      (res) =>
        res.url().includes("/api/users/") &&
        res.request().method() === "DELETE"
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // The row should be removed from the table via the optimistic cache update
    await expect(page.getByText(uniqueEmail)).not.toBeVisible();
    await expect(page.getByText(userName)).not.toBeVisible();
  });

  test("the soft-deleted user no longer appears after a page reload", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const uniqueEmail = `softdelete-${Date.now()}@example.com`;
    const { id: userId } = await createUserViaApi(page, {
      name: "Soft Delete Agent",
      email: uniqueEmail,
    });

    // Delete via API using the existing browser session
    const deleteRes = await page.request.delete(`${APP_BASE}/api/users/${userId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Load the Users page fresh — the deleted user should not be listed
    await page.goto("/users");

    await expect(
      page.getByRole("heading", { name: /users/i })
    ).toBeVisible();

    // Confirm the soft-deleted email is absent from the page
    await expect(page.getByText(uniqueEmail)).not.toBeVisible();
  });

  test("the Delete button is absent from the admin's own row (cannot self-delete)", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    // Find the admin's own row — it carries the "(you)" marker
    const adminRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
    await expect(adminRow).toBeVisible();

    // The UsersPage hides the Delete button when u.id === currentUser.id
    await expect(
      adminRow.getByRole("button", { name: /delete/i })
    ).not.toBeVisible();
  });
});
