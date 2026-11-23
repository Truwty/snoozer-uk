import { spawn } from "node:child_process";

const children = [];
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
  Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", resolve);
  }))).finally(() => process.exit(code));
}

function launch(label, args) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
  children.push(child);
  child.on("error", error => {
    console.error(`[startup] ${label} failed to start:`, error);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[startup] ${label} exited unexpectedly (code=${code}, signal=${signal}). Stopping the service.`);
      stop(code && code !== 0 ? code : 1);
    }
  });
  return child;
}

process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

if (process.env.DISCORD_PRESENCE_ENABLED === "true") {
  launch("Discord Presence worker", ["workers/discord-presence/worker.mjs"]);
}

launch("Next.js web server", ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]);
