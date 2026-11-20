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
    // Dismiss any showing consent banner so page controls are reachable.
    await page.evaluate(() => {
      const banner = document.querySelector('.consent-banner');
      if (banner) banner.classList.add('collapsed');
    });
    await page.getByRole("link", { name: "Create your page" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

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

test("creator payment intake is isolated and disabled without its own configuration",async({request})=>{
  test.skip(process.env.SNOOZER_CREATOR_SANDBOX_ENABLED==="true","Creator sandbox is explicitly configured");
  expect((await request.post("/api/v1/commerce/stripe/webhook")).status()).toBe(503);
  expect((await request.post("/api/v1/commerce/stripe/recover",{data:{limit:1}})).status()).toBe(503);
});

test("sandbox storefront cannot open while the explicit purchase gate is off",async({request})=>{
  test.skip(process.env.SNOOZER_CREATOR_CHECKOUT_ENABLED==="true","Sandbox purchases are explicitly enabled");
  expect((await request.get("/store/sandbox-fixture")).status()).toBe(404);
});


test("template search combines filters, preserves URL state and clears empty results", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  await page.goto("/templates");
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
