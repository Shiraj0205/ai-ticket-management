import { PgBoss } from "pg-boss";

export const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });

boss.on("error", (err) => console.error("PgBoss error:", err));
