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

function launchPresenceWorker() {
  const child = spawn(process.execPath, ["workers/discord-presence/worker.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  children.add(child);
  child.on("error", error => {
    console.error("[startup] Discord Presence worker failed to start:", error);
    children.delete(child);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[startup] Discord Presence worker exited (code=${code}, signal=${signal}); the website will remain available.`);
    }
  });
}

process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

if (process.env.DISCORD_PRESENCE_ENABLED === "true") {
  const required = ["DISCORD_BOT_TOKEN", "DISCORD_PRESENCE_GUILD_ID", "SNOOZER_PRESENCE_URL", "DISCORD_PRESENCE_INGEST_SECRET"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`[startup] Discord Presence is enabled but configuration is missing: ${missing.join(", ")}. Website will start without the worker.`);
  } else {
    launchPresenceWorker();
  }
}

launchWebServer();
