import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Login page (/login).
 *
 * The login form is rendered by LoginPage.tsx and validated with
 * react-hook-form + zod. All selectors are based on semantic roles
 * and labels so they remain stable across minor UI changes.
 */
export class LoginPage {
  readonly page: Page;

  // Form fields
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  // Error / feedback elements
  readonly serverErrorAlert: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;

  // Navigation link
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.emailInput = page.getByLabel("Email address", { exact: true });
    this.passwordInput = page.getByLabel("Password", { exact: true });
    this.submitButton = page.getByRole("button", { name: /sign in/i });

    // Validation messages rendered as <p> tags by react-hook-form
    this.emailError = page.locator("p.text-red-600").filter({
      hasText: /email/i,
    });
    this.passwordError = page.locator("p.text-red-600").filter({
      hasText: /password/i,
    });

    // Server-side error rendered inside the red alert box
    this.serverErrorAlert = page.locator(
      "div.bg-red-50 p.text-sm.text-red-700"
    );

    this.forgotPasswordLink = page.getByRole("link", {
      name: /forgot password/i,
    });
  }

  async goto() {
    await this.page.goto("/login");
    await expect(this.submitButton).toBeVisible();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * Fills both fields and submits, then waits for the resulting network
   * response from Better Auth so assertions run against stable state.
   */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);

    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/sign-in") && res.request().method() === "POST"
    );

    await this.submit();
    await responsePromise;
  }
}

/**
 * Lightweight helper for the authenticated Layout shell.
 * The Layout (Layout.tsx) contains the sign-out button and nav links
 * that confirm a session is active.
 */
export class AppShell {
  readonly page: Page;
  readonly signOutButton: Locator;
  readonly dashboardLink: Locator;
  readonly ticketsLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // The sign-out button renders "Sign out" text (hidden on mobile via
    // sm:inline but Playwright doesn't care about visibility classes).
    this.signOutButton = page.getByRole("button", { name: /sign out/i });
    this.dashboardLink = page.getByRole("link", { name: /dashboard/i });
    this.ticketsLink = page.getByRole("link", { name: /tickets/i });
  }

  async signOut() {
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/sign-out") && res.request().method() === "POST"
    );
    await this.signOutButton.click();
    await responsePromise;
  }

  async expectLoggedIn() {
    await expect(this.signOutButton).toBeVisible();
  }

  async expectOnDashboard() {
    await expect(this.page).toHaveURL("/");
    await expect(
      this.page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
  }
}
