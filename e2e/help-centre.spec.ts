import { expect, test } from "@playwright/test";

test("Help Centre landing page links into all documentation categories", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1, name: /How can we help you/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Help centre navigation" }).getByRole("link", { name: "Overview" })).toBeVisible();
  for (const category of [
    "Getting started",
    "Profiles & Studio",
    "Account & security",
    "Premium & billing",
    "Privacy & safety",
    "Troubleshooting",
  ]) {
    await expect(page.getByRole("link", { name: new RegExp(category) }).first()).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Popular articles" })).toBeVisible();
  await expect(page.getByRole("link", { name: /View changelog/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Contact support/ }).first()).toBeVisible();
});

test("Help Centre search supports text search, no-results state and Ctrl K", async ({ page }) => {
  await page.goto("/help");
  const search = page.getByRole("searchbox", { name: "Search documentation" });
  await expect(search).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();
  await search.fill("account switching");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/help\?q=account\+switching$/);
  await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Stay signed in and switch accounts/ })).toBeVisible();
  await search.fill("no matching Snoozer article phrase");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching articles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact support", exact: true }).first()).toBeVisible();
});

test("category pages, article breadcrumbs, table of contents and related articles work", async ({ page }) => {
  await page.goto("/help/category/profiles-studio");
  await expect(page.getByRole("heading", { name: "Profiles & Studio", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Connect and display Discord presence/ }).click();
  await expect(page).toHaveURL("/help/discord-presence");
  await expect(page.getByRole("heading", { level: 1, name: "Connect and display Discord presence" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Privacy, moderation and reporting/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Profiles & Studio" }).click();
  await expect(page).toHaveURL("/help/category/profiles-studio");
});

test("Changelog and contact pages are connected to guides and real support details", async ({ page }) => {
  await page.goto("/help/changelog");
  await expect(page.getByRole("heading", { level: 1, name: /What’s new in Snoozer/ })).toBeVisible();
  await page.getByRole("link", { name: /Read the guide/ }).first().click();
  await expect(page).toHaveURL("/help/creator-discovery");
  await page.goto("/help/contact");
  await expect(page.getByRole("heading", { level: 1, name: /Let’s get this sorted/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Email support/ })).toHaveAttribute("href", /mailto:snoozersupport@snoozer\.uk/);
  await expect(page.getByText("Never email your password", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the Privacy Policy" })).toHaveAttribute("href", "/privacy");
});

for (const width of [320, 375, 768, 1440]) {
  test(`Help Centre pages fit without horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/help",
      "/help/category/profiles-studio",
      "/help/discord-presence",
      "/help/changelog",
      "/help/contact",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Help centre navigation" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width);
    }
  });
}


test("legacy Status URLs redirect to the standalone Status Page", async ({ request }) => {
  for (const [route, destination] of [
    ["/status", "https://status.snoozer.uk/"],
    ["/status/incidents/current", "https://status.snoozer.uk/incidents/current"],
  ] as const) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(308);
    expect(response.headers().location, route).toBe(destination);
  }
});
