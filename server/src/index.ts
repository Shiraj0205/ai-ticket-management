import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { usersRouter } from "./routes/users.js";
import { ticketsRouter } from "./routes/tickets.js";
import { aiRouter } from "./routes/ai.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

app.use("/api/auth/sign-in", authLimiter);
app.use("/api/auth/forget-password", authLimiter);

// Better Auth handler must come before express.json()
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/ai", aiRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
