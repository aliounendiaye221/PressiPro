import { spawnSync } from "node:child_process";

function runPrismaGenerate(args = []) {
  const command = `npx prisma generate ${args.join(" ")}`.trim();
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    console.error("[Build] prisma generate spawn error:", result.error.message);
  }

  return result.status ?? 1;
}

function stopWorkspaceNodeProcesses() {
  if (process.platform !== "win32") {
    return;
  }

  const workspace = process.cwd().replace(/\\/g, "\\\\");
  const powerShellCommand = `$workspace = '${workspace}'; $selfPid = ${process.pid}; Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.ProcessId -ne $selfPid -and $_.CommandLine -and $_.CommandLine -like ('*' + $workspace + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;

  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", powerShellCommand], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.warn("[Build] could not stop conflicting workspace node processes:", result.error.message);
  }
}

function stopAllNodeProcessesExceptSelf() {
  if (process.platform !== "win32") {
    return;
  }

  const powerShellCommand = `$selfPid = ${process.pid}; $parentPid = ${process.ppid}; Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $selfPid -and $_.Id -ne $parentPid } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }`;

  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", powerShellCommand], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.warn("[Build] could not stop all conflicting node processes:", result.error.message);
  }
}

const primaryExitCode = runPrismaGenerate();
if (primaryExitCode === 0) {
  process.exit(0);
}

console.warn("[Build] prisma generate failed, retrying after releasing workspace Node processes...");
stopWorkspaceNodeProcesses();

const retryExitCode = runPrismaGenerate();
if (retryExitCode === 0) {
  process.exit(0);
}

console.warn("[Build] prisma generate still locked, retrying after stopping all Node processes...");
stopAllNodeProcessesExceptSelf();

const finalRetryExitCode = runPrismaGenerate();
if (finalRetryExitCode === 0) {
  process.exit(0);
}

process.exit(finalRetryExitCode);
