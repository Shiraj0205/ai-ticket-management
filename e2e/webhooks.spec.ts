/**
 * E2E tests for POST /api/webhooks/inbound-email
 *
 * Setup assumptions
 * -----------------
 * - global-setup.ts runs `prisma migrate deploy` then the seed script.
 * - server/.env.test sets WEBHOOK_SECRET="change-this-to-a-long-random-string".
 * - The seed creates an admin user (admin@example.com / admin123!) that is used
 *   to verify created tickets via the authenticated GET /api/tickets/:id endpoint.
 * - Rate limiting is production-only, so tests run without throttling.
 *
 * Test isolation
 * --------------
 * Every test uses the `request` fixture (no browser context). Each test is
 * independent: webhook calls create distinct tickets and no shared state is
 * mutated between tests.
 *
 * Auth for ticket verification
 * ----------------------------
 * GET /api/tickets/:id requires a session cookie (Better Auth). For tests that
 * verify the ticket was persisted we sign in as admin first, extract the
 * set-cookie header, and pass it on the follow-up GET.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

const API_BASE = "http://localhost:3002";
const WEBHOOK_URL = `${API_BASE}/api/webhooks/inbound-email`;
const CORRECT_SECRET = "change-this-to-a-long-random-string";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Signs in as admin and returns the raw set-cookie header value so it can be
 * forwarded on subsequent requests that require an authenticated session.
 */
async function adminSessionCookie(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok(), "Admin sign-in for ticket verification must succeed").toBeTruthy();
  return res.headers()["set-cookie"] ?? "";
}

/**
 * Fires the inbound-email webhook with the provided payload and headers.
 * `secret` defaults to the correct secret so tests that don't care about auth
 * can omit it.
 */
async function postWebhook(
  request: APIRequestContext,
  payload: Record<string, unknown>,
  opts: { secret?: string | null } = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // null means "omit the header entirely"; undefined means "use the correct one"
  if (opts.secret !== null) {
    headers["x-webhook-secret"] = opts.secret ?? CORRECT_SECRET;
  }

  return request.post(WEBHOOK_URL, { data: payload, headers });
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test.describe("POST /api/webhooks/inbound-email — happy paths", () => {
  test("valid request with correct secret returns 200 and the ticket is retrievable", async ({
    request,
  }) => {
    const res = await postWebhook(request, {
      from: "jane@example.com",
      fromName: "Jane Doe",
      subject: "My widget is broken",
      body: "Please help me.",
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ticketId).toBe("string");
    expect(body.ticketId.length).toBeGreaterThan(0);

    // Verify the ticket actually exists in the database via the tickets API
    const cookie = await adminSessionCookie(request);
    const ticketRes = await request.get(`${API_BASE}/api/tickets/${body.ticketId}`, {
      headers: { Cookie: cookie },
    });

    expect(ticketRes.status()).toBe(200);

    const ticket = await ticketRes.json();
    expect(ticket.id).toBe(body.ticketId);
    expect(ticket.fromEmail).toBe("jane@example.com");
    expect(ticket.fromName).toBe("Jane Doe");
    expect(ticket.subject).toBe("My widget is broken");
    expect(ticket.body).toBe("Please help me.");
    expect(ticket.status).toBe("OPEN");
  });

  test("omitting body field creates the ticket with '[No message body]'", async ({
    request,
  }) => {
    const res = await postWebhook(request, {
      from: "nobody@example.com",
      fromName: "Nobody",
      subject: "A subject without a body",
      // body intentionally omitted
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ticketId).toBe("string");

    const cookie = await adminSessionCookie(request);
    const ticketRes = await request.get(`${API_BASE}/api/tickets/${body.ticketId}`, {
      headers: { Cookie: cookie },
    });

    expect(ticketRes.status()).toBe(200);

    const ticket = await ticketRes.json();
    expect(ticket.body).toBe("[No message body]");
  });

  test("omitting fromName creates the ticket successfully", async ({
    request,
  }) => {
    const res = await postWebhook(request, {
      from: "anonymous@example.com",
      // fromName intentionally omitted
      subject: "No name provided",
      body: "Just the email address.",
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ticketId).toBe("string");

    const cookie = await adminSessionCookie(request);
    const ticketRes = await request.get(`${API_BASE}/api/tickets/${body.ticketId}`, {
      headers: { Cookie: cookie },
    });

    expect(ticketRes.status()).toBe(200);

    const ticket = await ticketRes.json();
    expect(ticket.fromEmail).toBe("anonymous@example.com");
    expect(ticket.fromName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Authentication / secret validation
// ---------------------------------------------------------------------------

test.describe("POST /api/webhooks/inbound-email — secret validation", () => {
  test("missing X-Webhook-Secret header returns 403", async ({ request }) => {
    const res = await postWebhook(
      request,
      {
        from: "jane@example.com",
        fromName: "Jane Doe",
        subject: "My widget is broken",
        body: "Please help me.",
      },
      { secret: null } // omit the header entirely
    );

    expect(res.status()).toBe(403);

    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  test("wrong X-Webhook-Secret value returns 403", async ({ request }) => {
    const res = await postWebhook(
      request,
      {
        from: "jane@example.com",
        fromName: "Jane Doe",
        subject: "My widget is broken",
        body: "Please help me.",
      },
      { secret: "totally-wrong-secret" }
    );

    expect(res.status()).toBe(403);

    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });
});

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

test.describe("POST /api/webhooks/inbound-email — payload validation", () => {
  test("invalid email format in 'from' field returns 400 with validation details", async ({
    request,
  }) => {
    const res = await postWebhook(request, {
      from: "not-a-valid-email",
      fromName: "Jane Doe",
      subject: "My widget is broken",
      body: "Please help me.",
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/invalid payload/i);
    // Zod flatten() puts field-level errors under fieldErrors
    expect(body.details).toBeDefined();
    expect(body.details.fieldErrors).toBeDefined();
    expect(body.details.fieldErrors.from).toBeDefined();
    expect(body.details.fieldErrors.from.length).toBeGreaterThan(0);
  });

  test("empty subject returns 400 with validation details", async ({
    request,
  }) => {
    const res = await postWebhook(request, {
      from: "jane@example.com",
      fromName: "Jane Doe",
      subject: "",
      body: "Please help me.",
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/invalid payload/i);
    expect(body.details).toBeDefined();
    expect(body.details.fieldErrors).toBeDefined();
    expect(body.details.fieldErrors.subject).toBeDefined();
    expect(body.details.fieldErrors.subject.length).toBeGreaterThan(0);
  });

  test("missing 'from' field entirely returns 400", async ({ request }) => {
    const res = await postWebhook(request, {
      // from intentionally omitted
      fromName: "Jane Doe",
      subject: "My widget is broken",
      body: "Please help me.",
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/invalid payload/i);
  });

  test("missing 'subject' field entirely returns 400", async ({ request }) => {
    const res = await postWebhook(request, {
      from: "jane@example.com",
      fromName: "Jane Doe",
      // subject intentionally omitted
      body: "Please help me.",
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/invalid payload/i);
  });

  test("subject exceeding 500 characters returns 400", async ({ request }) => {
    const res = await postWebhook(request, {
      from: "jane@example.com",
      fromName: "Jane Doe",
      subject: "x".repeat(501),
      body: "Please help me.",
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/invalid payload/i);
    expect(body.details.fieldErrors.subject).toBeDefined();
  });
});
