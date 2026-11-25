import { test, expect } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test("Discover and category pages work at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/discover");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Discover your next favourite creator");
    await expect(page.getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Discover", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Developers", exact: true })).toHaveAttribute(
      "href", "/discover/category/developers",
    );

    await page.getByRole("link", { name: "Developers", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/discover/category/developers$"));
    await expect(page.getByRole("heading", { level: 1, name: "Developers" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search creators" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search creators" }).fill("no-such-creator-query");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}
