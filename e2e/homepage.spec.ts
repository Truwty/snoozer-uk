import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test("Snoozer homepage matches the responsive product-led layout at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Everything you want, right here/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign up for free/i }).first()).toBeVisible();
    await expect(page.getByRole("img", {
      name: /Snoozer dashboard preview beside three overlapping creator profile previews/i,
    })).toBeVisible();
    await expect(page.locator(".home-dashboard-preview")).toHaveCount(1);
    await expect(page.locator(".home-profile-preview")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "A little space for everything you do." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Claim your profile and get started/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Explore your options/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Frequently Asked Questions/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Everything you want, right here/i }).last()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Help Center" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("homepage FAQ behaves as a single-open accordion", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: "What is Snoozer?" });
  const second = page.getByRole("button", { name: "Can I use Snoozer for free?" });
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/link-in-bio platform/)).toBeVisible();
  await second.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".home-faq-item.is-open")).toHaveCount(1);
});

test("both username claim bars use the live username availability check", async ({ page }) => {
  await page.route("**/api/v1/usernames/available-handle", (route) => route.fulfill({ json: { available: true } }));
  await page.goto("/");
  const usernames = page.getByLabel("Username", { exact: true });
  await expect(usernames).toHaveCount(2);
  await usernames.first().fill("available-handle");
  await expect(page.getByRole("status")).toContainText("Available. Claim it to reserve it.");
  await expect(page.getByRole("button", { name: "Claim now" })).toHaveCount(2);
});

test("homepage product preview keeps the real profile renderer and real social icons", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 860 });
  await page.goto("/");
  await expect(page.locator(".home-profile-preview .profile-card")).toHaveCount(3);
  await expect(page.locator(".home-profile-preview .avatar[src^='https://images.unsplash.com']")).toHaveCount(3);
  await expect(page.locator(".home-profile-preview .profile-social-mark svg").first()).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
