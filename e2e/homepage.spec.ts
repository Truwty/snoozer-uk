import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test("profile-led homepage remains usable at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Everything you share/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create your page/i }).first()).toBeVisible();
    await expect(page.getByRole("img", {
      name: /Three example Snoozer profile pages/i,
    })).toBeVisible();
    await expect(page.locator(".home-profile-preview")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "Claim your own corner of Snoozer." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Your page first/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A few things you might be wondering/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Make your page/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
