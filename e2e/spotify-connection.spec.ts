import { test, expect } from "@playwright/test";

test("Spotify OAuth pages remain private and anonymous beta requests fail closed", async ({ page }) => {
  const connection = await page.goto("/studio/spotify");
  expect(connection?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/sign-in/);
  const missing = await page.request.get("/api/v1/spotify/now-playing?username=not/a/name");
  expect(missing.status()).toBe(400);
  const disabled = await page.request.get("/api/v1/spotify/now-playing?username=safe-name");
  expect([404,503]).toContain(disabled.status());
});
