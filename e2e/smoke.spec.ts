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
    // Playwright's storageState already keeps optional analytics disabled.
    await page.getByRole("link", { name: "Create your page" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Discord sign-in is available on account entry pages", async ({ page }) => {
  for (const path of ["/sign-in", "/sign-up"]) {
    await page.goto(path);
    const discord = page.getByRole("button", { name: "Continue with Discord" });
    await expect(discord).toBeVisible();
    await expect(discord).toBeEnabled();
  }
});

test("homepage leaderboard link opens both Top 50 period tabs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Leaderboard" }).click();
  await expect(page).toHaveURL("/leaderboard");
  await expect(page.getByRole("heading", { name: "Views Leaderboard" })).toBeVisible();
  const periods = page.getByRole("navigation", { name: "Leaderboard period" });
  const all = periods.getByRole("link", { name: "All Time Views" });
  const month = periods.getByRole("link", { name: "Monthly Top Views" });
  await expect(all).toHaveAttribute("aria-current", "page");
  await month.click();
  await expect(page).toHaveURL(/\/leaderboard\?period=month$/);
  await expect(month).toHaveAttribute("aria-current", "page");
  await all.click();
  await expect(page).toHaveURL("/leaderboard");
  await expect(all).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("Privacy and Terms footer links open their legal pages", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy\/?$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page).toHaveURL(/\/terms\/?$/);
  await expect(page.getByRole("heading", { name: "Terms and Conditions", exact: true })).toBeVisible();
});

test("privacy choices can be declined and reopened", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("snoozer-analytics-consent-v3"));
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Your privacy choices" });
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Only necessary" }).click();
  await expect(banner).toHaveCount(0);
  await page.getByRole("button", { name: "Privacy settings" }).click();
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Allow optional analytics" }).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("snoozer-analytics-consent-v3"))).toBe("yes");
});

test("homepage preview applies Studio themes and layouts with keyboard controls", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 860 });
  await page.goto("/");
  const example = page.getByRole("region", { name: "Example profile" });
  const lagoon = page.getByRole("button", { name: "Lagoon", exact: true });
  await lagoon.focus();
  await lagoon.press("Space");
  await expect(lagoon).toHaveAttribute("aria-pressed", "true");
  await expect(example).toHaveClass(/theme-lagoon/);
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  await expect(example).toHaveAttribute("data-layout", "editorial");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("handle availability, template choices and password controls work", async ({ page }) => {
  await page.route("**/api/v1/usernames/available-handle", (route) => route.fulfill({ json: { available: true } }));
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("available-handle");
  await expect(page.getByRole("status")).toContainText("Available. Claim it to reserve it.");
  await page.goto("/templates");
  await expect(page.getByRole("link", { name: "Use this template", exact: true })).toHaveCount(12);
  await page.goto("/sign-up");
  const password = page.getByLabel("New password", { exact: true });
  await password.fill("twelve-characters");
  await expect(page.getByText("12+ characters · Met")).toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("liveness works without credentials", async ({ request }) => {
  const response = await request.get("/health/live");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "live" });
});

test("an anonymous visitor cannot open Studio", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/sign-in");
});

test("Stripe intake is unavailable without server configuration", async ({ request }) => {
  test.skip(Boolean(process.env.STRIPE_SANDBOX_WEBHOOK_SECRET), "A sandbox signing secret is configured");
  const response = await request.post("/api/v1/billing/stripe/webhook");
  expect(response.status()).toBe(503);
});

test("removed creator marketplace responds 404 for every route and method",async({request})=>{
  for(const path of [
    "/store/anyone","/studio/products","/studio/products/seller",
    "/studio/products/memberships","/studio/memberships","/studio/donations",
    "/studio/purchases","/studio/purchases/receipt/invalid",
    "/studio/support","/studio/product-reports",
    "/api/v1/commerce/stripe/webhook","/api/v1/commerce/stripe/recover",
    "/api/v1/commerce/kofi/webhook","/api/v1/commerce/memberships/webhook",
  ]) {
    const get=await request.get(path,{maxRedirects:0});
    expect(get.status(),path).toBe(404);
    const post=await request.post(path,{maxRedirects:0});
    expect(post.status(),path).toBe(404);
  }
  const premium=await request.post("/api/v1/billing/stripe/live-webhook",{data:""});
  expect([400,401,403,503]).toContain(premium.status());
});

test("template search combines filters, preserves URL state and clears empty results", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  await page.goto("/templates");
  // The global Playwright storage state already opts out of optional analytics.
  await page.getByLabel("Search templates", { exact: true }).fill("notebook compact");
  await page.getByRole("combobox", { name: "Template theme", exact: true }).selectOption("midnight");
  await page.getByRole("button", { name: "Find templates", exact: true }).click();
  await expect(page).toHaveURL(/q=notebook\+compact/);
  await expect(page.getByRole("link", { name: "Use this template", exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Search templates", { exact: true })).toHaveValue("notebook compact");
  await expect(page.getByRole("link", { name: "Use this template", exact: true })).toHaveAttribute("href", "/studio?template=project-notebook-compact");
  await page.getByLabel("Search templates", { exact: true }).fill("no such template");
  await page.getByRole("button", { name: "Find templates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching templates", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Browse all templates", exact: true }).click();
  await expect(page.getByLabel("Search templates", { exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Template theme", exact: true })).toHaveValue("all");
  await expect(page.getByRole("link", { name: "Use this template", exact: true })).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});


test("referral signup requires explicit consent and rejects malformed link codes", async ({ page }) => {
  await page.goto("/sign-up?ref=00000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("checkbox", { name: /Credit the creator who shared this link/ })).not.toBeChecked();
  await page.goto("/sign-up?ref=javascript:alert(1)");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.goto("/sign-up?ref=00000000-0000-4000-8000-000000000001&ref=00000000-0000-4000-8000-000000000002");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});


test("unbound custom hosts cannot expose account routes and marker contains only public readiness text", async ({ request }) => {
  const headers = { host: "unbound.example.com" };
  for (const path of ["/", "/sign-in", "/studio", "/studio/plan"]) {
    const response = await request.get(path, { headers, maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const marker = await request.get("/.well-known/snoozer-domain", { headers });
  expect(marker.status()).toBe(200);
  expect(await marker.text()).toBe("snoozer-domain-v1");
  expect(marker.headers()["content-type"]).toContain("text/plain");
});

test("the Snoozer topbar routes to real Help Center guides and approved Premium pricing", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 820 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  for (const name of ["Help Center", "Templates", "Leaderboard", "Pricing"]) {
    await expect(navigation.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await navigation.getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: /Your page/ })).toBeVisible();
  await expect(page.getByText("£3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.getByText("£30", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Help Center" }).click();
  await expect(page.getByRole("heading", { name: /How can we/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search documentation" }).fill("account");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: /Stay signed in and switch accounts/ })).toBeVisible();
  await page.getByRole("link", { name: /Stay signed in and switch accounts/ }).click();
  await expect(page.getByRole("heading", { name: "Stay signed in and switch accounts" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("new visitors do not see a phantom saved account in the dropdown", async ({ page }) => {
  await page.goto("/");
  await page.locator(".account-dropdown > summary").click();
  await expect(page.locator(".account-popover").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.locator(".account-popover").getByRole("button", { name: "Switch Accounts" })).toHaveCount(0);
});


test("Legal information is reachable, readable, and identifies the sole trader", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Legal information" }).click();
  await expect(page).toHaveURL(new RegExp("/legal/?$"));
  await expect(page.getByRole("heading", { name: "Legal information", exact: true })).toBeVisible();
  const contents = page.getByRole("navigation", { name: "Legal page contents" });
  await expect(contents.getByRole("link", { name: /Business identity and contact/ })).toBeVisible();
  await contents.getByRole("link", { name: /Business identity and contact/ }).click();
  await expect(page).toHaveURL(new RegExp("/legal#trader$"));
  await expect(page.getByRole("heading", { name: /Business identity and contact/ })).toBeVisible();
  await expect(page.locator("#trader").getByText("Shae Smith")).toBeVisible();
  await expect(page.locator("#trader").getByText("Not yet published", { exact: false })).toBeVisible();
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("Owner Control Centre is a reserved app route, not a public username", async ({ page }) => {
  // A signed-out visitor must go through account authentication, rather than
  // being rewritten to the public-profile not-found page by src/proxy.ts.
  await page.goto("/owner");
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("public reporting and appeals pages are application routes, not profile usernames", async ({page}) => {
 const appeal=await page.goto("/appeal");
 expect(appeal?.status()).toBe(200);
 await expect(page.getByRole("heading",{name:"Appeal a moderation decision"})).toBeVisible();
 const report=await page.goto("/report/example");
 expect(report?.status()).toBe(200);
 await expect(page.getByRole("heading",{name:"Report @example"})).toBeVisible();
});
