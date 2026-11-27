import { test, expect } from "@playwright/test";

test("public status page shows real service checks and incident history", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageResponse = await page.goto("/status");
  expect(pageResponse?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Core services" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Incident history" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeVisible();

  const services = page.locator(".status-service");
  await expect(services).toHaveCount(5);
  await expect(services.nth(0)).toContainText("Snoozer website");
  await expect(services.nth(1)).toContainText("Database & media storage");
  await expect(page.getByRole("link", { name: "Help centre" })).toHaveAttribute("href", "/help");

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

test("status is a reserved app route rather than a profile username", async ({ page }) => {
  const response = await page.goto("/status");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("link", { name: "Snoozer homepage" })).toHaveAttribute("href", "/");
});
