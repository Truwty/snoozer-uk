import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test("homepage landing sections remain usable at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Everything you are/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create your page/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Claim your little corner of the internet." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Start free/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A few things you might be wondering/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Make somewhere/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /photographer directs a model/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
