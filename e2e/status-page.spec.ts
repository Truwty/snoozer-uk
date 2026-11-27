import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const sampleReport = {
  category: "bug",
  title: "Status page test report",
  description: "A test report submitted to verify the public bug-report flow works as expected.",
  steps: "Open the status page and submit this test report.",
  contactEmail: "",
  pagePath: "/status",
  website: "",
};

test("public status page shows service health, incidents and the bug-report form", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageResponse = await page.goto("/status");
  expect(pageResponse?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Core services" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Incident history", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeVisible();

  const services = page.locator(".status-service");
  await expect(services).toHaveCount(5);
  await expect(services.nth(0)).toContainText("Snoozer website");
  await expect(services.nth(1)).toContainText("Database & media storage");

  await page.getByRole("button", { name: "Report a bug" }).click();
  await expect(page.getByRole("heading", { name: "Tell us what went wrong" })).toBeVisible();
  await page.getByLabel("Issue summary *").fill("The test report flow is working");
  await page.getByLabel("What happened? *").fill("This report checks that a visitor can submit a valid status page bug report.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("heading", { name: "Report received. Thank you." })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 820 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const api = await request.get("/api/status");
  expect(api.status()).toBe(200);
  expect(api.headers()["cache-control"]).toContain("no-store");
  const snapshot = await api.json();
  expect(snapshot.services).toHaveLength(5);
  expect(snapshot.incidentFeed).toHaveProperty("available");
  expect(["operational", "degraded", "outage", "maintenance", "unknown"]).toContain(snapshot.summary.state);
  expect(JSON.stringify(snapshot)).not.toMatch(/service_role|secret_key|access_token/i);
});

test("status subdomain root serves status page instead of a profile", async ({ request }) => {
  const response = await request.get("/", { headers: { host: "status.snoozer.uk" } });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("SNOOZER / SYSTEM STATUS");
});

test("bug reports are rate limited and not exposed through the public REST API", async ({ request }) => {
  const fingerprint = randomUUID();
  const headers = { "x-forwarded-for": fingerprint };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request.post("/api/status/bugs", { headers, data: sampleReport });
    expect(response.status()).toBe(201);
    expect((await response.json()).reportId).toMatch(/^[0-9a-f-]{36}$/i);
  }

  const blocked = await request.post("/api/status/bugs", { headers, data: sampleReport });
  expect(blocked.status()).toBe(429);
  expect(blocked.headers()["retry-after"]).toBe("3600");

  const privateTable = await request.get("/rest/v1/status_bug_reports?select=id");
  expect([401, 403, 404]).toContain(privateTable.status());
});

test("status is a reserved app route rather than a profile username", async ({ page }) => {
  const response = await page.goto("/status");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("link", { name: "Snoozer homepage" })).toHaveAttribute("href", "https://snoozer.uk/");
});
