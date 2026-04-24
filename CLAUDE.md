# AI Ticket Management — Claude Code Instructions

## Project Overview

An AI-powered ticket management system built as a monorepo with `/client` (React) and `/server` (Express) directories.

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, React Router, TanStack Query, Axios
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

## Forms

Always use **React Hook Form (`react-hook-form`)** with **Zod (`zod`)** for all forms in the frontend:

- Define a Zod schema for validation: `z.object({ ... })`
- Infer the form type: `type FormData = z.infer<typeof schema>`
- Pass the resolver: `useForm<FormData>({ resolver: zodResolver(schema) })`
- Spread `register` onto inputs and display `errors.<field>.message` inline

Do not use plain `useState` + manual validation for form state.

## Data Fetching

Always use **TanStack Query (`@tanstack/react-query`)** for all server state in the frontend:

- Use `useQuery` for fetching data (replaces `useEffect` + `useState` for loading/error)
- Use `useMutation` for create, update, and delete operations
- Update the cache directly with `queryClient.setQueryData` on mutation success — avoid unnecessary refetches
- The `QueryClientProvider` is set up in `main.tsx`

Do not manage server state with plain `useState` + `useEffect`.

## Project Structure

```
/client     — React frontend
/server     — Express backend
```

## Testing

### Component Tests (Vitest + React Testing Library)

Component tests live alongside the source file they test: `src/pages/Foo.tsx` → `src/pages/Foo.test.tsx`.

**Running tests:**
```bash
cd client
bun run test          # single run
bun run test:watch    # watch mode
```

**Stack:** Vitest · `@testing-library/react` · `@testing-library/user-event` · `@testing-library/jest-dom` · jsdom  
Config: `client/vitest.config.ts` — jsdom environment, global APIs enabled, setup file at `src/test/setup.ts`.

**What to test:**
- Loading/skeleton state
- Empty state
- Rendered data (names, emails, badges, counts)
- User interactions: opening modals, submitting forms, cancelling
- Optimistic cache updates after mutations
- Error banners when queries or mutations reject

**How to write tests:**

1. Mock `../lib/api.js` with `vi.mock` and cast to `ReturnType<typeof vi.fn>` for type-safe `.mockResolvedValue`.
2. Mock `../context/AuthContext.js` with `vi.mock` + `mockReturnValue` to control the current user.
3. Wrap renders in a fresh `QueryClient` (set `retry: false`) inside `QueryClientProvider`.
4. Prefer queries in this order: `getByRole` → `getByText` → `getByDisplayValue`. Avoid `getByTestId`.
5. When component labels lack `htmlFor`, query inputs by role/order (`getAllByRole("textbox")[n]`) or `getByDisplayValue`.
6. Use `within(row)` to scope queries to a specific table row.
7. Call `vi.clearAllMocks()` in `beforeEach`.

**Example helper pattern:**
```ts
function renderPage(currentUser: User | null = ADMIN) {
  mockUseAuth.mockReturnValue({ user: currentUser, loading: false, login: vi.fn(), logout: vi.fn() });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PageComponent />
    </QueryClientProvider>
  );
}
```

### E2E Tests (Playwright)

Always use the **`playwright-e2e-writer` agent** when writing end-to-end tests. Invoke it via the Agent tool with `subagent_type: "playwright-e2e-writer"`.

Use this agent for:
- Writing new E2E tests for completed features
- Expanding test coverage for existing user flows
- Creating test suites for critical paths (auth, ticket creation, dashboard, etc.)

The test environment uses isolated ports (5174 for client, 3002 for server) and a separate test database (`helpdesk_test`). See `playwright.config.ts` and `e2e/global-setup.ts` for configuration details.

## Implementation Plan

See `implementaion-plan.md` for the full phase-by-phase plan (Phases 1–8).
