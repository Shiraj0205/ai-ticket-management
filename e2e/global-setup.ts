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

export default async function globalSetup() {
  const serverDir = resolve(__dirname, "../server");
  const testEnv = loadEnvFile(resolve(serverDir, ".env.test"));

  console.log("\n[global-setup] Running Prisma migrations on test database…");
  execSync("bunx prisma migrate deploy", {
    cwd: serverDir,
    env: { ...process.env, ...testEnv },
    stdio: "inherit",
  });
  console.log("[global-setup] Migrations complete.\n");
}
