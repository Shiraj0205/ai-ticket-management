import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../lib/users.js";
import type { User, Role } from "../types/index.js";

interface EditForm {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditForm>({
    name: user.name,
    email: user.email,
    password: "",
    role: user.role,
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: Partial<EditForm>) => usersApi.update(user.id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Partial<EditForm> = { name: form.name, email: form.email, role: form.role };
    if (form.password) payload.password = form.password;
    mutate(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error instanceof Error ? error.message : "Failed to update user"}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
