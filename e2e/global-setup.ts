import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

// Resolve the bun executable path — on Windows there is only bun.exe (no bunx.exe).
// Using the full path avoids PATH lookup issues in child processes.
const BUN_EXE = resolve(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  ".bun",
  "bin",
  process.platform === "win32" ? "bun.exe" : "bun"
);

function execBun(args: string, opts: Parameters<typeof execSync>[1]) {
  return execSync(`${BUN_EXE} ${args}`, opts);
}

export default async function globalSetup() {
  const serverDir = resolve(__dirname, "../server");
  const testEnv = loadEnvFile(resolve(serverDir, ".env.test"));
  const childEnv = { ...process.env, ...testEnv };

  console.log("\n[global-setup] Running Prisma migrations on test database…");
  execBun("x prisma migrate deploy", { cwd: serverDir, env: childEnv, stdio: "inherit" });
  console.log("[global-setup] Migrations complete.\n");

  console.log("[global-setup] Seeding test database…");
  execBun("src/prisma/seed.ts", { cwd: serverDir, env: childEnv, stdio: "inherit" });
  console.log("[global-setup] Seed complete.\n");
}
