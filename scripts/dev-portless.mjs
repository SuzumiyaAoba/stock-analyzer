import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

const STARTUP_GRACE_MS = 1_500;
const ROUTE_LOCK_RETRY_DELAY_MS = 750;
const MAX_ROUTE_LOCK_RETRIES = 3;
const ROUTE_LOCK_MESSAGE = "Failed to acquire route lock";
const shell = process.env.SHELL || "/bin/sh";

const services = [
  {
    name: "api",
    command: "npm run dev:api",
    color: "\u001B[34m",
    initialDelayMs: 0,
  },
  {
    name: "web",
    command: "npm run dev:web",
    color: "\u001B[35m",
    initialDelayMs: 1_000,
  },
];

const runningChildren = new Set();

function prefixLine(name, color, line) {
  const reset = "\u001B[0m";
  return `${color}[${name}]${reset} ${line}`;
}

function attachPrefixedOutput(child, name, color, state) {
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) {
      continue;
    }

    let pending = "";
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      state.output = `${state.output}${text}`.slice(-8_000);
      pending += text;

      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";

      for (const line of lines) {
        process.stdout.write(`${prefixLine(name, color, line)}\n`);
      }
    });

    stream.on("end", () => {
      if (!pending) {
        return;
      }

      process.stdout.write(`${prefixLine(name, color, pending)}\n`);
    });
  }
}

function spawnShellCommand(command, name, color) {
  const state = { output: "" };
  const child = spawn(shell, ["-lc", command], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  runningChildren.add(child);
  child.on("exit", () => {
    runningChildren.delete(child);
  });

  attachPrefixedOutput(child, name, color, state);

  return { child, state };
}

async function ensureProxyStarted() {
  const { child } = spawnShellCommand("portless proxy start", "proxy", "\u001B[36m");
  const [code] = await once(child, "exit");

  if (code !== 0) {
    throw new Error("portless proxy start に失敗しました");
  }
}

async function startService(service) {
  if (service.initialDelayMs > 0) {
    await sleep(service.initialDelayMs);
  }

  for (let attempt = 1; attempt <= MAX_ROUTE_LOCK_RETRIES; attempt += 1) {
    const { child, state } = spawnShellCommand(service.command, service.name, service.color);

    const startupResult = await Promise.race([
      once(child, "exit").then(([code, signal]) => ({
        type: "exit",
        code,
        signal,
      })),
      sleep(STARTUP_GRACE_MS).then(() => ({
        type: "running",
      })),
    ]);

    if (startupResult.type === "running") {
      return {
        ...service,
        child,
        exitPromise: once(child, "exit").then(([code, signal]) => ({
          code,
          signal,
        })),
      };
    }

    const exitedWithRouteLock =
      startupResult.code !== 0 && state.output.includes(ROUTE_LOCK_MESSAGE);

    if (exitedWithRouteLock && attempt < MAX_ROUTE_LOCK_RETRIES) {
      process.stdout.write(
        prefixLine(
          "manager",
          "\u001B[33m",
          `${service.name} の route lock 取得に失敗したため再試行します (${attempt}/${MAX_ROUTE_LOCK_RETRIES - 1})`,
        ) + "\n",
      );
      await sleep(ROUTE_LOCK_RETRY_DELAY_MS);
      continue;
    }

    throw new Error(
      `${service.name} の起動に失敗しました (code: ${startupResult.code ?? "unknown"})`,
    );
  }

  throw new Error(`${service.name} の起動リトライ上限に達しました`);
}

function stopOtherChildren(exceptChild) {
  for (const child of runningChildren) {
    if (child === exceptChild || child.killed) {
      continue;
    }

    child.kill("SIGTERM");
  }
}

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  for (const child of runningChildren) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(signal).finally(() => {
      process.exit(0);
    });
  });
}

async function main() {
  await ensureProxyStarted();

  const startedServices = [];

  try {
    for (const service of services) {
      startedServices.push(await startService(service));
    }
  } catch (error) {
    await shutdown("SIGTERM");
    throw error;
  }

  const firstExit = await Promise.race(
    startedServices.map((service) =>
      service.exitPromise.then((result) => ({
        ...result,
        name: service.name,
        child: service.child,
      })),
    ),
  );

  stopOtherChildren(firstExit.child);

  if (firstExit.code && firstExit.code !== 0) {
    throw new Error(`${firstExit.name} が code ${firstExit.code} で終了しました`);
  }
}

main().catch(async (error) => {
  process.stderr.write(`${prefixLine("manager", "\u001B[31m", String(error instanceof Error ? error.message : error))}\n`);
  await shutdown("SIGTERM");
  process.exit(1);
});
