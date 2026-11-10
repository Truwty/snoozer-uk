import { test, expect } from "@playwright/test";

for (const width of [320, 375, 768, 1024, 1440, 1920]) {
  test(`home fits at ${width}px and account links work`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain("strict-dynamic");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Make yourself");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("link", { name: "Create your page" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("liveness works without credentials", async ({ request }) => {
  const response = await request.get("/health/live");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "live" });
});

test("an anonymous visitor cannot open Studio", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/sign-in");
});
