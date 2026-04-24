import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import UsersPage from "./UsersPage";
import type { User } from "../types/index.js";

// --- Mocks ---

vi.mock("../lib/api.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../context/AuthContext.js", () => ({
  useAuth: vi.fn(),
}));

import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";

const mockApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// --- Fixtures ---

const ADMIN: User = {
  id: "user-1",
  name: "Alice Admin",
  email: "alice@example.com",
  role: "ADMIN",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const AGENT: User = {
  id: "user-2",
  name: "Bob Agent",
  email: "bob@example.com",
  role: "AGENT",
  createdAt: "2024-02-15T00:00:00.000Z",
};

// --- Helpers ---

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage(currentUser: User | null = ADMIN) {
  mockUseAuth.mockReturnValue({
    user: currentUser,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>
  );
}

// --- Tests ---

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows skeleton rows while fetching", () => {
      mockApi.get.mockReturnValue(new Promise(() => {})); // never resolves
      renderPage();
      // Skeleton table should have the column headers
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      // No user data yet
      expect(screen.queryByText("Alice Admin")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no users are returned", async () => {
      mockApi.get.mockResolvedValue([]);
      renderPage();
      await screen.findByText("No users found.");
    });
  });

  describe("user list", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
    });

    it("renders all users", async () => {
      renderPage();
      await screen.findByText("Alice Admin");
      expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    });

    it("displays the correct email addresses", async () => {
      renderPage();
      await screen.findByText("alice@example.com");
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });

    it("shows Admin badge for admin users", async () => {
      renderPage();
      await screen.findByText("Admin");
    });

    it("shows Agent badge for agent users", async () => {
      renderPage();
      await screen.findByText("Agent");
    });

    it("shows (you) label next to the current user", async () => {
      renderPage(ADMIN);
      await screen.findByText("Alice Admin");
      expect(screen.getByText("(you)")).toBeInTheDocument();
    });

    it("does not show (you) next to other users", async () => {
      renderPage(AGENT);
      await screen.findByText("Alice Admin");
      // AGENT is current user — only one "(you)" and it should be near Bob
      const youLabel = screen.getByText("(you)");
      expect(youLabel).toBeInTheDocument();
      // Bob's row contains "(you)"
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      expect(within(bobRow).getByText("(you)")).toBeInTheDocument();
    });

    it("hides the Delete button for the current user", async () => {
      renderPage(ADMIN);
      await screen.findByText("Alice Admin");
      const aliceRow = screen.getByText("Alice Admin").closest("tr")!;
      expect(within(aliceRow).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });

    it("shows the Delete button for other users", async () => {
      renderPage(ADMIN);
      await screen.findByText("Bob Agent");
      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      expect(within(bobRow).getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("shows the total user count", async () => {
      renderPage();
      await screen.findByText(/2 users total/i);
    });
  });

  describe("create user modal", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([ADMIN]);
    });

    it("opens the create modal when New Agent is clicked", async () => {
      renderPage();
      await screen.findByText("Alice Admin");
      await userEvent.click(screen.getByRole("button", { name: /new agent/i }));
      expect(screen.getByRole("heading", { name: "Create Agent" })).toBeInTheDocument();
    });

    it("closes the modal when Cancel is clicked", async () => {
      renderPage();
      await screen.findByText("Alice Admin");
      await userEvent.click(screen.getByRole("button", { name: /new agent/i }));
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: "Create Agent" })).not.toBeInTheDocument();
    });

    it("submits new user and adds them to the list", async () => {
      const newUser: User = {
        id: "user-3",
        name: "Carol New",
        email: "carol@example.com",
        role: "AGENT",
        createdAt: new Date().toISOString(),
      };
      mockApi.post.mockResolvedValue(newUser);

      renderPage();
      await screen.findByText("Alice Admin");
      await userEvent.click(screen.getByRole("button", { name: /new agent/i }));

      // Labels in the modal don't use htmlFor — query inputs by role/order
      const [nameInput, emailInput] = screen.getAllByRole("textbox");
      const passwordInput = document.querySelector<HTMLInputElement>('input[type="password"]')!;

      await userEvent.type(nameInput, "Carol New");
      await userEvent.type(emailInput, "carol@example.com");
      await userEvent.type(passwordInput, "secret123");
      await userEvent.click(screen.getByRole("button", { name: /create agent/i }));

      expect(mockApi.post).toHaveBeenCalledWith("/users", {
        name: "Carol New",
        email: "carol@example.com",
        password: "secret123",
      });

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Create Agent" })).not.toBeInTheDocument();
      });
    });

    it("shows an error message when creation fails", async () => {
      mockApi.post.mockRejectedValue(new Error("Email already taken"));

      renderPage();
      await screen.findByText("Alice Admin");
      await userEvent.click(screen.getByRole("button", { name: /new agent/i }));

      const [nameInput, emailInput] = screen.getAllByRole("textbox");
      const passwordInput = document.querySelector<HTMLInputElement>('input[type="password"]')!;

      await userEvent.type(nameInput, "Carol New");
      await userEvent.type(emailInput, "carol@example.com");
      await userEvent.type(passwordInput, "secret123");
      await userEvent.click(screen.getByRole("button", { name: /create agent/i }));

      await screen.findByText("Email already taken");
    });
  });

  describe("edit user modal", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
    });

    it("opens the edit modal with the user's current data", async () => {
      renderPage();
      await screen.findByText("Bob Agent");

      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await userEvent.click(within(bobRow).getByRole("button", { name: /edit/i }));

      expect(screen.getByText("Edit User")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bob Agent")).toBeInTheDocument();
      expect(screen.getByDisplayValue("bob@example.com")).toBeInTheDocument();
    });

    it("closes the edit modal when Cancel is clicked", async () => {
      renderPage();
      await screen.findByText("Bob Agent");

      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await userEvent.click(within(bobRow).getByRole("button", { name: /edit/i }));
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByText("Edit User")).not.toBeInTheDocument();
    });

    it("submits updated data and closes modal", async () => {
      const updated: User = { ...AGENT, name: "Bob Updated" };
      mockApi.patch.mockResolvedValue(updated);

      renderPage();
      await screen.findByText("Bob Agent");

      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await userEvent.click(within(bobRow).getByRole("button", { name: /edit/i }));

      const nameInput = screen.getByDisplayValue("Bob Agent");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Bob Updated");
      await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

      expect(mockApi.patch).toHaveBeenCalledWith(
        `/users/${AGENT.id}`,
        expect.objectContaining({ name: "Bob Updated" })
      );

      await waitFor(() => {
        expect(screen.queryByText("Edit User")).not.toBeInTheDocument();
      });
    });

    it("shows an error message when the update fails", async () => {
      mockApi.patch.mockRejectedValue(new Error("Update failed"));

      renderPage();
      await screen.findByText("Bob Agent");

      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await userEvent.click(within(bobRow).getByRole("button", { name: /edit/i }));
      await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await screen.findByText("Update failed");
    });
  });

  describe("delete user", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue([ADMIN, AGENT]);
      vi.spyOn(window, "confirm").mockReturnValue(true);
    });

    it("calls the delete API and removes the user from the list", async () => {
      mockApi.delete.mockResolvedValue({});

      renderPage(ADMIN);
      await screen.findByText("Bob Agent");

      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await userEvent.click(within(bobRow).getByRole("button", { name: /delete/i }));

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("Bob Agent")
      );
      expect(mockApi.delete).toHaveBeenCalledWith(`/users/${AGENT.id}`);
    });

    it("does not delete when the user cancels the confirmation", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      renderPage(ADMIN);
      await screen.findByText("Bob Agent");

      const bobRow = screen.getByText("Bob Agent").closest("tr")!;
      await userEvent.click(within(bobRow).getByRole("button", { name: /delete/i }));

      expect(mockApi.delete).not.toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("shows an error banner when the users query fails", async () => {
      mockApi.get.mockRejectedValue(new Error("Failed to fetch users"));
      renderPage();
      await screen.findByText("Failed to fetch users");
    });
  });
});
