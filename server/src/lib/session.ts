import "express-session";
import type { Role } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: Role;
  }
}
