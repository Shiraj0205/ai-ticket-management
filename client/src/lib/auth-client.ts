import { createAuthClient } from "better-auth/react";

// No baseURL needed — Vite proxies /api/* to the backend server
export const authClient = createAuthClient();
