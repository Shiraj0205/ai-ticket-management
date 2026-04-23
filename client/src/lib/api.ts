import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? "Request failed";
    return Promise.reject(new Error(message));
  }
);

export const api = {
  get: <T>(path: string) => client.get<T>(path).then((r) => r.data),
  post: <T>(path: string, data?: unknown) => client.post<T>(path, data).then((r) => r.data),
  patch: <T>(path: string, data?: unknown) => client.patch<T>(path, data).then((r) => r.data),
  delete: <T>(path: string) => client.delete<T>(path).then((r) => r.data),
};
