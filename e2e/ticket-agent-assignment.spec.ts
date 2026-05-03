/**
 * E2E tests for agent assignment on the Ticket Detail page (/tickets/:id).
 *
 * Setup assumptions
 * -----------------
 * - global-setup.ts runs `prisma migrate deploy` then the seed script.
 * - The seed creates two users in the test DB (helpdesk_test):
 *     admin@example.com / admin123!  (role: ADMIN, emailVerified: true)
 *     agent@example.com / agent123!  (role: AGENT, emailVerified: true)
 * - Each test creates its own ticket via POST /api/tickets so tests are
 *   independent and never share mutable state.
 *
 * Auth note
 * ---------
 * PATCH /api/tickets/:id with { assignedAgentId } is restricted to ADMIN role
 * by adminUpdateSchema in the server route. All tests therefore run as admin.
 * Login uses page.request (same browser context, cookies on 5174) via the Vite
 * proxy — the same pattern used in users.spec.ts.
 *
 * Selector strategy for the "Assigned Agent" select
 * --------------------------------------------------
 * The two <select> elements in the Ticket Management card sit inside a
 * grid-cols-2 container. Their <label> elements use no htmlFor attribute, so
 * getByLabel() does not work. Instead we scope to the card section that
 * contains the "Assigned Agent" text and call getByRole("combobox") within
 * that scope. The agent-panel locator targets the <div> that holds the label
 * and the select together.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123!";

// The seeded agent used as the assignee in most tests.
const AGENT_NAME = "Agent";
const AGENT_EMAIL = "agent@example.com";

// All browser-context requests go through the Vite proxy on 5174 so that
// session cookies are scoped to the same origin as the app.
const APP_BASE = "http://localhost:5174";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Performs a programmatic login via Better Auth through the Vite proxy.
 * The resulting session cookie is stored in the page's browser context and
 * is automatically forwarded with all subsequent page.request calls and
 * page.goto() navigations.
 */
async function loginViaApi(page: Page, email: string, password: string) {
  const res = await page.request.post(`${APP_BASE}/api/auth/sign-in/email`, {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok(), `Programmatic login for ${email} must succeed`).toBeTruthy();
}

/**
 * Creates a ticket via POST /api/tickets using the page's existing browser
 * session (so the admin cookie is forwarded automatically).
 * Returns the created ticket's id.
 */
async function createTicketViaApi(
  page: Page,
  opts: { subject?: string; body?: string; fromEmail?: string } = {}
): Promise<string> {
  const res = await page.request.post(`${APP_BASE}/api/tickets`, {
    data: {
      subject: opts.subject ?? "Test ticket subject",
      body: opts.body ?? "Test ticket body content.",
      fromEmail: opts.fromEmail ?? "customer@example.com",
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status(), "Creating test ticket should return 201").toBe(201);
  const ticket = await res.json();
  return ticket.id as string;
}

/**
 * Looks up the agent user's id from GET /api/tickets/agents using the
 * page's existing session. Fails the test if the seeded agent is not found.
 */
async function getAgentId(page: Page, name: string): Promise<string> {
  const res = await page.request.get(`${APP_BASE}/api/tickets/agents`);
  expect(res.ok(), "Fetching agents list must succeed").toBeTruthy();
  const agents: Array<{ id: string; name: string }> = await res.json();
  const match = agents.find((a) => a.name === name);
  expect(match, `Agent named "${name}" must exist in the agents list`).toBeDefined();
  return match!.id;
}

/**
 * Assigns an agent to a ticket directly via the API, bypassing the UI.
 * Useful for setting up the pre-condition of "already assigned" tests.
 */
async function assignAgentViaApi(
  page: Page,
  ticketId: string,
  agentId: string | null
): Promise<void> {
  const res = await page.request.patch(`${APP_BASE}/api/tickets/${ticketId}`, {
    data: { assignedAgentId: agentId },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok(), "Direct agent assignment via API must succeed").toBeTruthy();
}

/**
 * Returns a locator scoped to the "Assigned Agent" panel — the <div> that
 * wraps the "Assigned Agent" label text and its sibling select element.
 * Using this scope avoids confusion with the sibling "Status" select.
 *
 * Strategy: find the <label> element whose exact text is "Assigned Agent",
 * then walk up one level to its parent <div> which also contains the select
 * and the agent email paragraph.
 */
function agentPanel(page: Page) {
  // The <label> with text "Assigned Agent" is a direct child of the <div>
  // column we want. locator("..") traverses to that parent div.
  return page.locator("label").filter({ hasText: "Assigned Agent" }).locator("..");
}

/**
 * Navigates to a ticket detail page and waits until the Ticket Management
 * card (which contains the agent select) is visible.
 */
async function gotoTicketDetail(page: Page, ticketId: string) {
  await page.goto(`/tickets/${ticketId}`);
  // Wait for the Ticket Management section heading to confirm the page is loaded.
  await expect(
    page.getByRole("heading", { name: /ticket management/i })
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Agent assignment on ticket detail page", () => {
  // Each test logs in as admin and creates its own isolated ticket so tests
  // can run in parallel without interfering with each other.

  test("1. a new ticket shows 'Unassigned' selected in the agent dropdown", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const ticketId = await createTicketViaApi(page);
    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");
    await expect(agentSelect).toBeVisible();

    // The default value is the empty-string option labelled "Unassigned"
    await expect(agentSelect).toHaveValue("");
  });

  test("2. selecting an agent saves the assignment and shows the agent's email below the select", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const agentId = await getAgentId(page, AGENT_NAME);
    const ticketId = await createTicketViaApi(page);
    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");

    // Wait for the agents list to be populated — the async query adds agent
    // options after the initial render, so wait for the second option to exist
    // (index 1 is the first real agent after the "Unassigned" placeholder).
    await expect(agentSelect.locator("option").nth(1)).toBeAttached();

    // Select the seeded agent by their id value
    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}`) &&
        res.request().method() === "PATCH"
    );
    await agentSelect.selectOption(agentId);
    const patchRes = await patchPromise;
    expect(patchRes.ok(), "PATCH /api/tickets/:id must succeed").toBeTruthy();

    // The select should now show the agent's name as selected
    await expect(agentSelect).toHaveValue(agentId);

    // The assigned agent's email is rendered below the select
    await expect(panel.getByText(AGENT_EMAIL)).toBeVisible();
  });

  test("3. selecting a different agent reassigns the ticket to the new agent", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create a second agent to reassign to
    const secondAgentEmail = `reassign-agent-${Date.now()}@example.com`;
    const createRes = await page.request.post(`${APP_BASE}/api/users`, {
      data: {
        name: "Reassign Agent",
        email: secondAgentEmail,
        password: "TestPassword1!",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(createRes.status(), "Creating second agent should return 201").toBe(201);
    const secondAgent = await createRes.json();
    const secondAgentId: string = secondAgent.id;
    const secondAgentName: string = secondAgent.name;

    const firstAgentId = await getAgentId(page, AGENT_NAME);
    const ticketId = await createTicketViaApi(page);

    // Assign the first agent via API so we start in the "already assigned" state
    await assignAgentViaApi(page, ticketId, firstAgentId);

    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");

    // Confirm the ticket starts assigned to the first agent
    await expect(agentSelect).toHaveValue(firstAgentId);

    // Reassign to the second agent
    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}`) &&
        res.request().method() === "PATCH"
    );
    await agentSelect.selectOption(secondAgentId);
    const patchRes = await patchPromise;
    expect(patchRes.ok(), "PATCH for reassignment must succeed").toBeTruthy();

    // The select should now reflect the second agent
    await expect(agentSelect).toHaveValue(secondAgentId);

    // The second agent's name should be the selected option text
    await expect(
      agentSelect.locator(`option[value="${secondAgentId}"]`)
    ).toHaveText(secondAgentName);

    // The second agent's email appears below the select
    await expect(panel.getByText(secondAgentEmail)).toBeVisible();

    // The first agent's email should no longer be shown
    await expect(panel.getByText(AGENT_EMAIL)).not.toBeVisible();
  });

  test("4. selecting 'Unassigned' clears an existing agent assignment", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const agentId = await getAgentId(page, AGENT_NAME);
    const ticketId = await createTicketViaApi(page);

    // Pre-condition: ticket is already assigned to the agent
    await assignAgentViaApi(page, ticketId, agentId);

    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");

    // Confirm the ticket starts assigned
    await expect(agentSelect).toHaveValue(agentId);
    // The agent email is shown
    await expect(panel.getByText(AGENT_EMAIL)).toBeVisible();

    // Select "Unassigned" (empty-string option)
    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}`) &&
        res.request().method() === "PATCH"
    );
    await agentSelect.selectOption("");
    const patchRes = await patchPromise;
    expect(patchRes.ok(), "PATCH to unassign must succeed").toBeTruthy();

    // The select should revert to the "Unassigned" value
    await expect(agentSelect).toHaveValue("");

    // The agent email below the select should disappear
    await expect(panel.getByText(AGENT_EMAIL)).not.toBeVisible();
  });

  test("5. agent assignment persists after navigating away and back", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const agentId = await getAgentId(page, AGENT_NAME);
    const ticketId = await createTicketViaApi(page);

    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");

    // Assign the agent via the UI
    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}`) &&
        res.request().method() === "PATCH"
    );
    await agentSelect.selectOption(agentId);
    await patchPromise;

    // Confirm assignment is visible before navigating away
    await expect(agentSelect).toHaveValue(agentId);

    // Navigate to the tickets list
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: /tickets/i })).toBeVisible();

    // Navigate back to the same ticket detail
    await page.goto(`/tickets/${ticketId}`);
    await expect(
      page.getByRole("heading", { name: /ticket management/i })
    ).toBeVisible();

    // The server-persisted assignment should be reflected on fresh page load
    const freshPanel = agentPanel(page);
    const freshSelect = freshPanel.getByRole("combobox");
    await expect(freshSelect).toHaveValue(agentId);
    await expect(freshPanel.getByText(AGENT_EMAIL)).toBeVisible();
  });

  test("6. the agent select is disabled while a save is in progress", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const agentId = await getAgentId(page, AGENT_NAME);
    const ticketId = await createTicketViaApi(page);
    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");

    // Use page.route to intercept the PATCH and hold the response artificially
    // so we have a window to assert the disabled state while the mutation is
    // isPending = true (i.e. before the server responds).
    let resolveRoute!: () => void;
    const routeHeld = new Promise<void>((res) => { resolveRoute = res; });

    await page.route(`**/api/tickets/${ticketId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        // Signal that the request was intercepted, then wait before continuing
        resolveRoute();
        // Hold the response for a short window so the test can observe disabled
        await new Promise((r) => setTimeout(r, 300));
      }
      await route.continue();
    });

    // Trigger the onChange → mutate() call
    const patchDone = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}`) &&
        res.request().method() === "PATCH"
    );
    await agentSelect.selectOption(agentId);

    // Wait until the route handler has received the request (mutation is in-flight)
    await routeHeld;

    // While isPending=true the select must carry the disabled attribute
    await expect(agentSelect).toBeDisabled();

    // After the response is delivered the select re-enables
    await patchDone;
    await expect(agentSelect).not.toBeDisabled();
  });

  test("7. the seeded agent appears as an option in the agent dropdown", async ({
    page,
  }) => {
    await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const ticketId = await createTicketViaApi(page);
    await gotoTicketDetail(page, ticketId);

    const panel = agentPanel(page);
    const agentSelect = panel.getByRole("combobox");

    // Wait for options beyond "Unassigned" to be rendered
    // (the agents query populates them asynchronously)
    await expect(agentSelect.locator("option").nth(1)).toBeVisible();

    // The seeded agent's name should appear as one of the options
    await expect(
      agentSelect.locator(`option`, { hasText: AGENT_NAME })
    ).toBeAttached();
  });
});
