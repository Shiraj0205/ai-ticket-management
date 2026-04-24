import { api } from "./api.js";
import type { User, Role } from "../types/index.js";

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
}

export const usersApi = {
  list: () => api.get<User[]>("/users"),
  create: (data: CreateUserPayload) => api.post<User>("/users", data),
  update: (id: string, data: UpdateUserPayload) => api.patch<User>(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};
