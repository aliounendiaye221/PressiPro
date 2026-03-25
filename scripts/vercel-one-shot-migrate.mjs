import { spawnSync } from "node:child_process";

function runPrisma(args, allowFailure = false) {
  const result = spawnSync("npx", ["prisma", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.VERCEL_ONE_SHOT_MIGRATE !== "1") {
  process.exit(0);
}

console.log("[one-shot] Running prisma migrate resolve + deploy...");

// Baseline existing DB schema when init migration was applied outside Prisma Migrate.
runPrisma(["migrate", "resolve", "--applied", "20260306233124_init"], true);
runPrisma(["migrate", "deploy"]);

console.log("[one-shot] Prisma migration step completed.");
