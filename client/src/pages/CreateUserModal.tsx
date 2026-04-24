import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../lib/users.js";
import type { User } from "../types/index.js";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateUserForm = z.infer<typeof createUserSchema>;

export function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema) });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CreateUserForm) => usersApi.create(data),
    onSuccess: (newUser) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) => [newUser, ...prev]);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Create Agent</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error instanceof Error ? error.message : "Failed to create user"}
          </p>
        )}

        <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              {...register("name")}
              autoComplete="off"
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${errors.name ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-blue-500"}`}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              autoComplete="off"
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${errors.email ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-blue-500"}`}
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input
              type="password"
              {...register("password")}
              autoComplete="new-password"
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${errors.password ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-blue-500"}`}
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isPending ? "Creating..." : "Create Agent"}
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
