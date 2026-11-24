import { checkLighthouse } from "./lighthouse";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/sign-up", "/sign-in", "/forgot-password", "/templates", "/reset-password", "/auth/confirm", "/profile-not-found", "/leaderboard", "/discover", "/discover/category/developers", "/legal"]) {
  test(`automated WCAG checks at phone width for ${path}`, async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 360, height: 812 });
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations).toEqual([]);
    if (["/", "/templates", "/sign-in"].includes(path)) await checkLighthouse(page, path);
  });
}
