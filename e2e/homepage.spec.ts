import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test("homepage landing sections remain usable at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Everything you share/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create your page/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Claim your Snoozer address." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start free. Make more space when you need it." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently asked questions." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "A home for everything you make." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
