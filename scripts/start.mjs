import { spawn } from "node:child_process";

const children = new Set();
let shuttingDown = false;

function stop(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }, 10_000);
  forceTimer.unref();
  Promise.all([...children].map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", resolve);
  }))).finally(() => process.exit(code));
}

function launchWebServer() {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"], {
    stdio: "inherit",
    env: process.env,
  });
  children.add(child);
  child.on("error", error => {
    console.error("[startup] Next.js failed to start:", error);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[startup] Next.js exited unexpectedly (code=${code}, signal=${signal}).`);
      stop(code && code !== 0 ? code : 1);
    }
  });
}

function launchDiscordWorker() {
  console.info("[startup] Starting Discord worker after web readiness.");
  const child = spawn(process.execPath, ["workers/discord-presence/worker.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  children.add(child);
  child.on("error", error => {
    console.error("[startup] Discord worker failed to start:", error);
    children.delete(child);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[startup] Discord worker exited (code=${code}, signal=${signal}); the website will remain available.`);
    }
  });
}

async function waitForWebReady() {
  const port = Number(process.env.PORT || 10000);
  const healthUrl = `http://127.0.0.1:${port}/health/live`;
  const deadline = Date.now() + 90_000;
  while (!shuttingDown && Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000), cache: "no-store" });
      if (response.ok) {
        console.info("[startup] Web service health check passed.");
        return true;
      }
    } catch {
      // The web server is still starting; retry below.
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  console.error("[startup] Web service did not become healthy within 90 seconds; Presence worker will not start.");
  return false;
}

process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

launchWebServer();

const presenceEnabled = process.env.DISCORD_PRESENCE_ENABLED === "true";
const serverSetupEnabled = process.env.DISCORD_SERVER_SETUP_ENABLED === "true";

if (presenceEnabled || serverSetupEnabled) {
  const required = ["DISCORD_BOT_TOKEN", "DISCORD_PRESENCE_GUILD_ID"];
  if (presenceEnabled) required.push("SNOOZER_PRESENCE_URL", "DISCORD_PRESENCE_INGEST_SECRET");
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`[startup] Discord worker is enabled but configuration is missing: ${missing.join(", ")}. Website will start without the worker.`);
  } else if (await waitForWebReady()) {
    launchDiscordWorker();
  }
} else {
  console.info("[startup] Discord worker is disabled by DISCORD_PRESENCE_ENABLED and DISCORD_SERVER_SETUP_ENABLED.");
}
