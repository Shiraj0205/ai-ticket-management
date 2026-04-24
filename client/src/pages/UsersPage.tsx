import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.js";
import { usersApi } from "../lib/users.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { User, Role } from "../types/index.js";
import { CreateUserModal } from "./CreateUserModal.js";
import { EditUserModal } from "./EditUserModal.js";

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        role === "ADMIN"
          ? "bg-purple-100 text-purple-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {role === "ADMIN" ? "Admin" : "Agent"}
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) =>
        prev.filter((u) => u.id !== id)
      );
    },
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    deleteMutation.mutate(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} {users.length === 1 ? "user" : "users"} total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Agent
        </button>
      </div>

      {(error || deleteMutation.error) && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {((error || deleteMutation.error) as Error)?.message ?? "Something went wrong"}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Email", "Role", "Joined", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No users found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Email", "Role", "Joined", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold select-none shrink-0">
                        {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{u.name}</span>
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="text-xs text-gray-500 hover:text-blue-600 font-medium"
                      >
                        Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          disabled={deleteMutation.isPending}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}
