import { checkLighthouse } from "./lighthouse";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import Stripe from "stripe";

const mailOrigin = process.env.SNOOZER_TEST_MAIL_ORIGIN ?? "http://127.0.0.1:54324";
const password = randomUUID();
const newPassword = randomUUID();
const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const localEnabled = process.env.SNOOZER_TEST_LOCAL_SUPABASE === "1";

async function enterPublicBio(page: Page, openMore = true) {
  // Chromium exposes the native <summary> disclosure control as a group in
  // its accessibility tree, so target the native summary element directly.
  const entrance = page.locator(".profile-entry-shell > summary.profile-entry-overlay");
  const disclosure = page.locator(".profile-entry-shell");
  await expect(entrance).toBeVisible();
  await expect(entrance).toHaveAttribute("aria-label", /^click to enter/i);
  await entrance.click();
  await expect(disclosure).toHaveJSProperty("open", true);
  await expect(page.locator(".profile-card")).toBeVisible();
  await expect(page.locator(".profile-card")).not.toHaveAttribute("aria-hidden", "true");
  await expect(entrance).toBeHidden();
  if (openMore) {
    // Consent is tested separately. For profile-content flows that do not
    // exercise consent, explicitly retain only necessary storage before
    // opening the More disclosure so the consent panel cannot cover it.
    const consent = page.locator(".consent-banner");
    if (await consent.isVisible()) {
      await consent.getByRole("button", { name: "Only necessary", exact: true }).click();
    }
    const more = page.locator(".profile-more-content > summary");
    if (await more.count()) await more.click();
  }
}

test.skip(!localEnabled, "Requires the disposable local Supabase CLI stack and mail catcher.");

async function mailLink(request: APIRequestContext, email: string, subject: string, path: string) {
  let link = "";
  await expect.poll(async () => {
    const response = await request.get(`${mailOrigin}/api/v1/search`, { params: { query: `to:${email}` } });
    if (!response.ok()) return false;
    const { messages } = await response.json();
    const item = messages?.find((message: { Subject: string }) => message.Subject === subject);
    if (!item) return false;
    const details = await request.get(`${mailOrigin}/api/v1/message/${item.ID}`);
    if (!details.ok()) return false;
    const { HTML } = await details.json();
    link = String(HTML).match(/href="([^"]+)"/)?.[1] ?? "";
    return link.startsWith(`http://localhost:3000${path}?token_hash=`);
  }, { timeout: 25000 }).toBe(true);
  return link;
}

test.beforeEach(async ({ context }) => {
  if (!project || !["http://127.0.0.1:54321", "http://localhost:54321"].includes(project) || !publishableKey || !adminKey) {
    throw new Error("These tests require credentials for the disposable loopback stack only.");
  }
  await context.addInitScript(() => {
    try {
      const key = "snoozer-analytics-consent-v3";
      if (localStorage.getItem(key) === null) localStorage.setItem(key, "no");
    } catch {
      // Storage can be unavailable in some document contexts.
    }
  });
});

async function editorTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  // Missing tabs should fail with a useful, bounded timeout rather than
  // consuming the enclosing 90-second journey timeout.
  await expect(tab).toBeVisible({ timeout: 15_000 });
  if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
}


test("profile analytics requires consent, counts link clicks and exports only to its owner", async ({ page, browser }) => {
  test.setTimeout(90000);
  const name = "analytics-" + randomUUID().slice(0, 10);
  const email = name + "@example.com";
  const profileLinks = [
    { label: "Work", url: "https://example.com/" },
    { label: "Video", url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" },
    { label: "Repository", url: "https://github.com/snoozer-fixtures/reference" },
    { label: "Community", url: "https://discord.gg/snoozer-reference" },
    { label: "Stream", url: "https://www.twitch.tv/twitchdev" },
    { label: "Game", url: "https://www.roblox.com/games/1234567890/Fixture" },
    { label: "Playlist", url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" },
    { label: "Track", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
  ];
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(account.error).toBeNull();
  const owner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
  const visitor = await browser.newContext({
    baseURL: "http://localhost:3000",
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
    storageState: { cookies: [], origins: [{ origin: "http://localhost:3000",
      localStorage: [{ name: "snoozer-analytics-consent-v3", value: "no" }] }] },
  });
  try {
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    expect((await owner.rpc("claim_profile", { p_name: name })).error).toBeNull();
    expect((await owner.rpc("save_profile", {
      p_expected: 0, p_name: "Analytics fixture", p_bio: "", p_theme: "midnight", p_indexable: false,
      p_links: profileLinks, p_publish: true, p_remove_avatar: false,
    })).error).toBeNull();
    const draft = await owner.rpc("get_draft");
    expect(draft.error).toBeNull();
    const id = draft.data.profile_id;
    const read = async () => (await owner.rpc("get_my_profile_view_days", { p_profile: id })).data;
    const readBrowsers = async () => (await owner.rpc("get_my_profile_browser_days", { p_profile: id })).data;
    const publicPage = await visitor.newPage();
    const events: string[] = [];
    publicPage.on("request", (request) => {
      if (request.url().endsWith("/api/v1/analytics/view")) events.push(request.postData() ?? "");
    });
    await publicPage.goto("/" + name);
    await enterPublicBio(publicPage);
    const socialLayout = await publicPage.locator(".profile-social-links").evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        display: style.display,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        flexWrap: style.flexWrap,
        gap: style.gap,
        backgroundColor: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        paddingBlockStart: style.paddingBlockStart,
        height: node.getBoundingClientRect().height,
      };
    });
    expect(socialLayout).toMatchObject({
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8.8px",
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderWidth: "0px",
      paddingBlockStart: "2.4px",
    });
    expect(socialLayout.height).toBeLessThan(52);
    await publicPage.getByText("Analytics preferences", { exact: true }).click();
    expect(await read()).toEqual([]);
    expect(events).toHaveLength(0);
    await publicPage.getByRole("button", { name: "Allow profile analytics", exact: true }).click();
    await expect.poll(read).toEqual([{ day: expect.any(String), views: 1, clicks: 0 }]);

    const popupPromise = visitor.waitForEvent("page");
    await publicPage.getByRole("link", { name: "Work", exact: true }).click({ button: "middle" });
    const popup = await popupPromise;
    await popup.close();
    await expect.poll(read).toEqual([{ day: expect.any(String), views: 1, clicks: 1 }]);
    await expect.poll(readBrowsers).toEqual([{ day: expect.any(String), unique_browsers: 1, clicked_browsers: 1 }]);
    expect(JSON.parse(events[0])).toMatchObject({ version: 3, browser: expect.any(String), browserDay: expect.any(String) });

    await publicPage.getByRole("button", { name: "Turn off profile analytics", exact: true }).click();
    expect(await publicPage.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("snoozer-analytics-browser-v3:")))).toEqual([]);
    await publicPage.reload();
    await enterPublicBio(publicPage);
    expect(events).toHaveLength(2);
    await expect(publicPage.locator("iframe")).toHaveCount(0);
    await expect(publicPage.locator(".profile-social-links a[href^=\"https://open.spotify.com/\"]")).toHaveCount(2);
    await expect(publicPage.locator(".profile-more-content, .profile-widgets, .spotify-widget")).toHaveCount(0);
    await expect(publicPage.locator('.profile-social-links a[href="https://www.youtube.com/watch?v=M7lc1UVf-VE"]')).toHaveCount(1);

    expect((await visitor.request.get("/api/v1/analytics/export?profile=" + id)).status()).toBe(401);
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/studio/analytics");
    for (const heading of ["Account Analytics","Total Link Clicks","Click Rate","Profile Views","Average Daily Views","Visitor Devices","Most Clicked Socials","Most Clicked Buttons","Top Referrers","Top Countries by Views"]) {
      await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator(".analytics-metric")).toHaveCount(4);
    const linksCsv = await page.request.get("/api/v1/analytics/export?breakdown=links&profile=" + id);
    expect(linksCsv.status()).toBe(200);
    expect(await linksCsv.text()).toBe('label,url,clicks\r\n"Work","https://example.com/",1\r\n');
    const csv = await page.request.get("/api/v1/analytics/export?profile=" + id);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["cache-control"]).toBe("private, no-store");
    expect(await csv.text()).toMatch(/^date_utc,views,clicks\r\n\d{4}-\d{2}-\d{2},1,1\r\n$/);
    expect((await visitor.request.get("/api/v1/analytics/export?profile=" + id)).status()).toBe(401);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    await visitor.close();
    if (account.data.user) await admin.auth.admin.deleteUser(account.data.user.id);
  }
});

test("Plus can claim and switch between independent profiles", async ({ page, request }) => {
  const name = `multi-${randomUUID().slice(0, 8)}`;
  const second = `${name}-second`;
  const email = `${name}@example.com`;
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(error).toBeNull();
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByLabel("Username").fill(name);
    await page.getByRole("button", { name: "Claim address" }).click();
    await page.getByRole("link", { name: "Premium", exact: true }).click();
    await expect(page.getByText("Claim another profile", { exact: true })).toHaveCount(0);
    const gift = await admin.rpc("issue_gift_code", {
      p_plan: "plus", p_version: 1, p_duration_days: 1, p_redeem_by: new Date(Date.now() + 3600000).toISOString(),
    }).single<{ code: string }>();
    expect(gift.error).toBeNull();
    await page.getByText("Redeem a plan gift", { exact: true }).click();
    await page.getByLabel("Gift code", { exact: true }).fill(gift.data!.code);
    await page.getByRole("button", { name: "Redeem gift code" }).click();
    await page.getByText("Claim another profile", { exact: true }).click();
    await page.getByLabel("Username").fill(second);
    await page.getByRole("button", { name: "Claim address" }).click();
    await expect(page.getByRole("heading", { name: "Page Builder", exact: true })).toBeVisible();
    await expect(page.locator(".editor-topbar strong")).toHaveText("@" + second);
    const selectedProfile = new URL(page.url()).searchParams.get("profile");
    expect(selectedProfile).toMatch(/^[0-9a-f-]{36}$/);
    await page.getByRole("link", { name: "Customize", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/studio/customize\\?profile=" + selectedProfile));
    await expect(page.locator(".editor-grid")).not.toHaveClass(/panel-only/);
    await expect(page.locator(".preview")).toBeVisible();
    await editorTab(page, "Design");
    const livePreviewCard = page.locator(".preview .profile-card");
    const originalTheme = await page.getByLabel("Theme").inputValue();
    await page.getByLabel("Theme").selectOption("daybreak");
    await expect(livePreviewCard).toHaveClass(/theme-daybreak/);
    await page.getByLabel("Theme").selectOption(originalTheme);
    await expect(livePreviewCard).toHaveClass(new RegExp("theme-" + originalTheme));
    const originalLayout = await page.getByLabel("Profile layout").inputValue();
    await page.getByLabel("Profile layout").selectOption("editorial");
    await expect(livePreviewCard).toHaveAttribute("data-layout", "editorial");
    await page.getByLabel("Profile layout").selectOption(originalLayout);
    await page.getByRole("tab", { name: "Links" }).click();
    await expect(page.locator(".preview")).toBeVisible();
    await page.getByRole("tab", { name: "Widgets" }).click();
    await expect(page.locator(".preview")).toBeVisible();
    await page.getByRole("tab", { name: "Design" }).click();
    await page.getByRole("link", { name: "Templates", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find your profile style.", exact: true })).toBeVisible();
    const templatePreview = page.locator(".template-preview-frame").first();
    await expect(templatePreview).toHaveAttribute("role", "img");
    await expect(templatePreview).toHaveAttribute("inert");
    await expect(templatePreview).toHaveCSS("pointer-events", "none");
    await expect(page.getByRole("button", { name: "Use Template", exact: true }).first()).toBeVisible();
    await page.goto("/studio/customize?profile=" + selectedProfile);
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByRole("link", { name: "View live page" })).toHaveAttribute("href", `/${second}`);
    expect((await request.get(`/${name}`)).status()).toBe(404);
    expect((await request.get(`/${second}`)).status()).toBe(200);
    await page.getByRole("link", { name: "Premium", exact: true }).click();
    await page.getByRole("link", { name: `Edit @${name}`, exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/customize\?profile=/);
    await expect(page.locator(".editor-topbar strong")).toHaveText("@" + name);
    await expect(page.getByRole("link", { name: "View live page" })).toHaveCount(0);
  } finally {
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  }
});

test("isolated domain fixtures bind HTTP hosts and reject cross-profile and privileged routes", async ({ page, request }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const name = "domain-" + randomUUID().slice(0, 8);
  const host = name + ".example.com";
  const email = name + "@example.com";
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(account.error).toBeNull();
  const owner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
  let domainRequest: string | undefined;
  try {
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByLabel("Username").fill(name);
    await page.getByRole("button", { name: "Claim address", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Account Overview", exact: true })).toBeVisible();
    await page.goto("/studio/builder");
    await editorTab(page, "Settings");
    await expect(page.getByLabel("Domain hostname", { exact: true })).toBeDisabled();
    await page.getByRole("link", { name: "Premium", exact: true }).click();
    const gift = await admin.rpc("issue_gift_code", { p_plan: "plus", p_version: 1, p_duration_days: 1, p_redeem_by: new Date(Date.now()+3600000).toISOString() }).single<{ code: string }>();
    expect(gift.error).toBeNull();
    await page.getByText("Redeem a plan gift", { exact: true }).click();
    await page.getByLabel("Gift code", { exact: true }).fill(gift.data!.code);
    await page.getByRole("button", { name: "Redeem gift code", exact: true }).click();
    await page.getByRole("link", { name: "Back to Overview", exact: true }).click();
    await page.goto("/studio/builder");
    await page.getByLabel("Display name", { exact: true }).fill("Isolated creator-domain fixture");
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    await editorTab(page, "Settings");
    await page.getByLabel("Domain hostname", { exact: true }).fill(host);
    await page.getByRole("button", { name: "Request domain connection", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Domain request saved." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify " + host, exact: true })).toBeDisabled();
    const draft = await owner.rpc("get_draft");
    const inventory = await owner.rpc("list_my_domains", { p_profile: draft.data.profile_id });
    expect(inventory.error).toBeNull();
    domainRequest = inventory.data.items[0].id;
    // Provider proof is an isolated fixture here; DNS/TLS boundaries have separate tests and hosted evidence.
    expect((await admin.rpc("reserve_domain_provisioning", { p_request: domainRequest })).error).toBeNull();
    const job = await admin.rpc("claim_domain_check", { p_host: host, p_request: domainRequest, p_actor: account.data.user!.id });
    expect(job.error).toBeNull();
    expect(job.data.state).toBe("check");
    expect((await admin.rpc("complete_domain_check", { p_request: domainRequest, p_lease: job.data.lease, p_ok: true })).data).toBe(true);
    const headers = { host };
    const root = await request.get("/", { headers, maxRedirects: 0 });
    expect(root.status()).toBe(200);
    const html = await root.text();
    expect(html).toContain("Isolated creator-domain fixture");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    expect(canonical).toBeDefined();
    expect(new URL(canonical!).href).toBe(`https://${host}/`);
    for (const path of ["/studio", "/sign-in", "/studio/plan", "/api/v1/analytics/export"]) expect((await request.get(path, { headers, maxRedirects: 0 })).status()).toBe(404);
    expect((await request.post("/", { headers, data: {} })).status()).toBe(404);
    expect((await request.post("/api/v1/billing/stripe/webhook", { headers, data: {} })).status()).toBe(404);
    expect((await request.post("/api/v1/analytics/view", { headers: { ...headers, "next-action": "fixture-action" }, data: {} })).status()).toBe(404);
    expect((await request.get("/.well-known/snoozer-domain", { headers })).status()).toBe(200);
    const event = { username: name, id: randomUUID(), consent: true, kind: "view" };
    const customHeaders = { host, origin: "https://" + host, "user-agent": "Mozilla/5.0" };
    expect((await request.post("/api/v1/analytics/view", { headers: customHeaders, data: { ...event, username: "another-creator" } })).status()).toBe(403);
    expect((await request.post("/api/v1/analytics/view", { headers: customHeaders, data: event })).status()).toBe(204);
    expect((await request.post("/api/v1/widgets/public", { headers: customHeaders, data: { username: "another-creator", position: 1, provider: "github", consent: true } })).status()).toBe(403);
    expect((await request.post("/api/v1/analytics/view", { headers: { origin: "https://"+host, "user-agent": "Mozilla/5.0", "x-snoozer-domain-host": host, "x-snoozer-domain-username": name }, data: event })).status()).toBe(403);
    expect((await request.get("/", { headers: { host: "unclaimed.example.com" }, maxRedirects: 0 })).status()).toBe(404);
    await page.reload(); await editorTab(page, "Settings");
    await page.getByRole("button", { name: "Disconnect " + host, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Routing stopped." })).toBeVisible();
    expect((await request.get("/", { headers, maxRedirects: 0 })).status()).toBe(503);
    expect((await owner.rpc("delete_profile", { p_profile: draft.data.profile_id, p_expected: draft.data.revision, p_username: name })).error?.code).toBe("P1010");
    await page.setViewportSize({ width: 360, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    if (domainRequest) {
      await owner.rpc("disconnect_profile_domain", { p_request: domainRequest });
      await admin.rpc("complete_domain_disconnect", { p_host: host, p_request: domainRequest });
    }
    if (account.data.user) {
      const removed = await admin.auth.admin.deleteUser(account.data.user.id);
      if (!test.info().errors.length) expect(removed.error).toBeNull();
    }
  }
});

test("signup referral credit is optional, private and withdrawable", async ({ page, request }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const name = "referral-" + randomUUID().slice(0, 8);
  const email = name + "@example.com";
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const creator = await admin.auth.admin.createUser({ email: name + "-owner@example.com", password, email_confirm: true });
  expect(creator.error).toBeNull();
  const owner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
  let memberId: string | undefined;
  try {
    expect((await owner.auth.signInWithPassword({ email: name + "-owner@example.com", password })).error).toBeNull();
    expect((await owner.rpc("claim_profile", { p_name: name })).error).toBeNull();
    expect((await owner.rpc("save_profile", { p_expected: 0, p_name: "Referral creator", p_bio: "", p_theme: "midnight", p_indexable: false, p_links: [], p_publish: true, p_remove_avatar: false })).error).toBeNull();
    expect((await owner.rpc("set_my_referral_enabled", { p_enabled: true })).error).toBeNull();
    const report = await owner.rpc("get_my_growth");
    expect(report.error).toBeNull();
    await page.goto(`/sign-up?ref=${report.data.code}`);
    const consent = page.getByRole("checkbox", { name: /Credit the creator who shared this link/ });
    await expect(consent).not.toBeChecked();
    await consent.check();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("verification link");
    const members = await admin.auth.admin.listUsers({ perPage: 1000 });
    memberId = members.data.users.find((user) => user.email === email)?.id;
    expect(memberId).toBeTruthy();
    expect((await owner.rpc("get_my_growth")).data.verified).toBe(0);
    await page.goto(await mailLink(request, email, "Verify your Snoozer email", "/auth/confirm"));
    await page.getByRole("button", { name: "Verify email", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Claim your address", exact: true })).toBeVisible();
    await page.goto("/studio/growth");
    await expect(page.getByText("Your consented referral is included in the sharing creator’s aggregate report.", { exact: true })).toBeVisible();
    expect((await owner.rpc("get_my_growth")).data).toMatchObject({ verified: 1, claimed: null, published: null });
    await page.getByText("Withdraw or prevent referral attribution", { exact: true }).click();
    await page.getByRole("button", { name: "Withdraw referral attribution", exact: true }).click();
    await expect(page.getByText("Attribution withdrawn. This account cannot be attributed again.", { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/Growth/);
    expect((await owner.rpc("get_my_growth")).data.verified).toBe(0);
    await page.setViewportSize({ width: 360, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    if (memberId) await admin.auth.admin.deleteUser(memberId);
    if (creator.data.user) await admin.auth.admin.deleteUser(creator.data.user.id);
  }
});

test("legacy sections and widgets remain hidden until the visitor enters the compact reference profile", async ({ browser }) => {
  const name = "compact-" + randomUUID().slice(0, 10);
  const email = name + "@example.com";
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull();
  const owner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  try {
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    expect((await owner.rpc("claim_profile", { p_name: name })).error).toBeNull();
    const draft = await owner.rpc("get_draft");
    expect(draft.error).toBeNull();
    const pollId = randomUUID();
    const sections = [{ heading: "Legacy project", body: "Saved but not displayed in the reference profile.", kind: "project", target: "https://example.com/legacy" }];
    const widgets = {
      version: 1, order: ["guestbook","testimonials","poll","faq"],
      guestbook: { enabled: true, heading: "Guestbook", description: "Leave a message.", maxEntries: 10, submissionsOpen: true },
      testimonials: { enabled: true, heading: "Kind words", items: [{ id: randomUUID(), quote: "Legacy quote.", author: "Customer", role: "Client" }] },
      poll: { enabled: true, id: pollId, question: "Legacy poll?", options: [{ id: randomUUID(), label: "One" }, { id: randomUUID(), label: "Two" }], open: true, closesAt: null, showResultsBeforeVote: false },
      faq: { enabled: true, heading: "Legacy questions", items: [{ id: randomUUID(), question: "Old FAQ?", answer: "Old answer." }] },
    };
    const saved = await owner.rpc("save_profile", {
      p_profile: draft.data.profile_id, p_expected: draft.data.revision, p_name: "Compact reference fixture",
      p_bio: "A compact profile", p_theme: "midnight", p_indexable: false,
      p_links: [{ label: "Website", url: "https://example.com/" }], p_sections: sections,
      p_widgets: widgets, p_publish: true, p_remove_avatar: false,
      p_appearance: draft.data.appearance ?? { density: "balanced", corners: "soft" }, p_seo: { title: "", description: "" },
    });
    expect(saved.error).toBeNull();
    const reloaded = await owner.rpc("get_draft");
    expect(reloaded.data.sections).toHaveLength(1);
    expect(reloaded.data.widgets.testimonials.heading).toBe("Kind words");
    await visitor.addInitScript(() => {
      try { localStorage.setItem("snoozer-analytics-consent-v3", "no"); } catch { /* Optional storage. */ }
    });
    const publicPage = await visitor.newPage();
    await publicPage.goto("/" + name);
    await expect(publicPage.locator(".profile-entry-overlay")).toBeVisible();
    await expect(publicPage.locator(".profile-more-content, .profile-widgets, .profile-layout-block")).toHaveCount(0);
    await expect(publicPage.getByRole("heading", { name: "Kind words" })).toHaveCount(0);
    await expect(publicPage.getByText("Legacy project", { exact: true })).toHaveCount(0);
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Compact reference fixture" })).toBeVisible();
    await expect(publicPage.getByText("Legacy project", { exact: true })).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Kind words" })).toBeVisible();
    const privatePoll = await visitor.request.get("/api/v1/widgets/poll", { params: { username: name, pollId } });
    expect(privatePoll.status()).toBe(403);
  } finally {
    await visitor.close();
    if (created.data.user) await admin.auth.admin.deleteUser(created.data.user.id);
  }
});

test("reference dashboard pages, asset uploader, custom links and QR share match the video", async ({ page }) => {
  const name = "reference-" + randomUUID().slice(0, 10);
  const email = name + "@example.com";
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull();
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Claim address" }).click();
    await expect(page.getByRole("heading", { name: "Account Overview", exact: true })).toBeVisible();
    await expect(page.locator(".studio-stat-card")).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "Account Statistics", exact: true })).toBeVisible();
    await expect(page.getByText("Profile completion", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Manage your account", exact: true })).toBeVisible();
    await expect(page.getByText("Connections", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account Analytics", exact: true })).toBeVisible();

    const referenceLinks = ["Overview","Analytics","Badges","Settings","Customize","Links","Premium","Image Host","Templates"];
    await expect(page.locator(".studio-sidebar-nav a")).toHaveCount(referenceLinks.length);
    for (const label of referenceLinks) await expect(page.locator(".studio-sidebar-nav").getByRole("link", { name: label, exact: true })).toBeVisible();
    await expect(page.locator(".studio-sidebar-nav")).not.toContainText("Page Builder");

    await page.getByRole("link", { name: "Analytics", exact: true }).click();
    for (const heading of ["Account Analytics","Total Link Clicks","Click Rate","Profile Views","Average Daily Views","Visitor Devices","Most Clicked Socials","Most Clicked Buttons","Top Referrers","Top Countries by Views"]) {
      await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator(".analytics-metric")).toHaveCount(4);

    await page.getByRole("link", { name: "Badges", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Badges", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "All badges", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Badge catalogue", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Custom badges", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Purchase", exact: true })).toHaveAttribute("href", /\/studio\/plan/);
    await expect(page.getByRole("button", { name: "Preview Custom Badge", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Settings", exact: true }).click();
    for (const heading of ["General Information","Language Settings","Security Settings","Connections","Gift Links","Email Marketing","Account Actions"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.locator("#snoozer-locale option")).toHaveCount(6);
    await page.keyboard.press("Control+k");
    const commandSearch = page.getByRole("dialog", { name: "Search Studio" }).getByLabel("Search Studio features, pages, and actions");
    await commandSearch.fill("multi-factor");
    const mfaCommand = page.getByRole("option", { name: /Multi-factor authentication/ });
    await expect(mfaCommand).toContainText("Enable or disable multi-factor authentication.");
    await commandSearch.press("Enter");
    await expect(page).toHaveURL(/\/studio\/account#account-mfa$/);

    await page.getByRole("link", { name: "Links", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Social profiles", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Purchase Image Host", exact: true }).click();
    const imageHostDialog = page.getByRole("dialog", { name: "Image Host", exact: true });
    await expect(imageHostDialog.getByText("4,99€", { exact: true })).toBeVisible();
    await expect(imageHostDialog.getByText("Pay once. Keep it forever.", { exact: true })).toBeVisible();
    await expect(imageHostDialog.getByText(/Add Custom Image Host Domain/)).toBeVisible();
    await expect(imageHostDialog.getByText(/Upload Analytics/)).toBeVisible();
    await expect(imageHostDialog.getByText("Checkout is not available yet", { exact: true })).toBeVisible();
    await expect(imageHostDialog.getByRole("button", { name: "Gift Image Host is not available yet" })).toBeDisabled();
    await imageHostDialog.getByRole("button", { name: "Close Image Host purchase" }).click();

    await page.getByRole("button", { name: "Add Custom URL", exact: true }).click();
    const customDialog = page.getByRole("dialog", { name: "Add Custom URL Social", exact: true });
    await expect(customDialog).toBeVisible();
    await expect(customDialog.getByRole("group", { name: "Social Mode" })).toBeVisible();
    await customDialog.getByRole("button", { name: "Text", exact: true }).click();
    await customDialog.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.org/custom-link");
    await customDialog.getByRole("button", { name: "Add", exact: true }).click();
    const customRow = page.locator(".link-row").last();
    await expect(customRow).toBeVisible();
    await expect(customRow.getByLabel("Link 1 label", { exact: true })).toHaveValue("example.org");
    await expect(customRow.getByLabel("Link 1 URL", { exact: true })).toHaveValue("https://example.org/custom-link");
    await expect(customRow.getByRole("combobox", { name: "Display mode", exact: true })).toHaveValue("text");

    await page.getByRole("link", { name: "Templates", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find your profile style.", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use Template", exact: true }).first()).toBeVisible();
    await expect(page.locator(".template-card-meta").first()).toContainText("uses");
    await expect(page.locator(".template-card-tags").first()).toBeVisible();
    for (const label of ["Template Library","Favourite Templates","Last Used Templates","My Uploads"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: /Create Template/ }).click();
    await expect(page.getByRole("heading", { name: "Create Template", exact: true })).toBeVisible();
    await expect(page.getByText(/Only your theme, appearance and text-section structure are shared/)).toBeVisible();
    await page.getByLabel("Template name", { exact: true }).fill("Reference creator template");
    await page.getByLabel("Description", { exact: true }).fill("A free creator-submitted design.");
    await page.getByRole("button", { name: "Submit Template for Review", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("submitted for review");
    await expect(page.getByRole("heading", { name: "My Uploads", exact: true })).toBeVisible();
    await expect(page.getByText("Reference creator template", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending review", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Image Host", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Image Host", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Snippets", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create text paste", exact: true })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Assets", exact: true })).toBeVisible();

    await page.goto("/studio/customize");
    await expect(page.getByRole("heading", { name: "Assets Uploader", exact: true })).toBeVisible();
    await expect(page.locator(".studio-asset-card")).toHaveCount(4);
    for (const label of ["Background","Audio","Profile Avatar","Custom Cursor"]) await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("General Customization", { exact: true })).toBeVisible();
    await expect(page.getByText("Color Customization", { exact: true })).toBeVisible();
    await expect(page.getByText("Other Customization", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Click to open audio manager", exact: true }).click();
    const audioManager = page.getByRole("dialog", { name: "Audio Manager", exact: true });
    await expect(audioManager).toBeVisible();
    await audioManager.getByRole("button", { name: "+ Add Audio", exact: true }).click();
    const addAudio = page.getByRole("dialog", { name: "Add an Audio", exact: true });
    expect(await addAudio.evaluate((dialog) => dialog.closest(".studio-audio-add-overlay")?.parentElement === document.body)).toBe(true);
    await expect(addAudio.getByRole("button", { name: "Click to upload an audio", exact: true })).toBeVisible();
    await expect(addAudio.getByRole("button", { name: "Click to upload an audio cover", exact: true })).toBeVisible();
    await expect(addAudio.getByRole("textbox", { name: "Audio Title", exact: true })).toBeVisible();
    await addAudio.locator('input[type="file"]').first().setInputFiles({
      name: "studio-track.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("ID3xxxxx"),
    });
    await addAudio.getByRole("textbox", { name: "Audio Title", exact: true }).fill("Snoozer upload test");
    await addAudio.getByRole("button", { name: "Add Audio", exact: true }).click();
    await expect(audioManager.getByRole("status").filter({ hasText: "Audio uploaded and added to your profile draft" })).toBeVisible();
    await expect(audioManager.getByText("Snoozer upload test", { exact: true })).toBeVisible();
    await audioManager.getByRole("button", { name: "Close audio manager", exact: true }).click();

    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    const publishedProfile = await page.request.get("/" + name);
    expect(publishedProfile.status()).toBe(200);
    const publishedHtml = await publishedProfile.text();
    expect(publishedHtml).toContain("Snoozer upload test");
    const audioSrc = publishedHtml.match(/src="([^"]+\.mp3)"/)?.[1];
    expect(audioSrc).toMatch(/^\/media\/audio\/[0-9a-f-]{36}\.mp3$/);
    const audioResponse = await page.request.get("http://localhost:3000" + audioSrc!, { maxRedirects: 0 });
    expect(audioResponse.status()).toBe(307);
    await page.reload();
    await page.getByRole("button", { name: "Share Your Profile", exact: true }).click();
    const shareDialog = page.getByRole("dialog", { name: "Share Your Profile", exact: true });
    await expect(shareDialog.getByRole("button", { name: "Snoozer QR Code" })).toBeVisible();
    await expect(shareDialog.getByRole("link", { name: /Get more profile views/ })).toHaveAttribute("href", "/help?q=views");
    await expect(shareDialog.getByRole("link", { name: /Open My Page/ })).toBeVisible();
    await expect(shareDialog.getByRole("button", { name: "Copy URL", exact: true })).toBeVisible();
    await expect(shareDialog.getByRole("link", { name: "Help Centre", exact: true })).toHaveAttribute("href", "/help");
    await expect(shareDialog.getByRole("link", { name: "Support Email", exact: true })).toHaveAttribute("href", "mailto:snoozersupport@snoozer.uk");
    await shareDialog.getByRole("button", { name: "Snoozer QR Code" }).click();
    const qrDialog = page.getByRole("dialog", { name: "Snoozer QR Code", exact: true });
    await expect(qrDialog.locator("svg#snoozer-profile-qr-svg")).toBeVisible();
    await expect(qrDialog.getByRole("button", { name: "Download PNG", exact: true })).toBeVisible();
    await expect(qrDialog.getByRole("button", { name: "Download SVG", exact: true })).toBeVisible();
    await expect(qrDialog.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
    await qrDialog.getByRole("button", { name: "Close QR code" }).click();
    await expect(shareDialog.getByRole("button", { name: "Copy URL", exact: true })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  } finally {
    if (created.data.user) await admin.auth.admin.deleteUser(created.data.user.id);
  }
});

test("verify, publish, restore, reset, delete and clean up a profile", async ({ page, browser, request }) => {
  // This is the full account lifecycle journey, including Lighthouse, publication
  // history, password reset, deletion and storage cleanup. Keep the test intact;
  // give CI enough time for the complete flow rather than timing out at cleanup.
  test.setTimeout(process.env.SNOOZER_TEST_LIGHTHOUSE === "1" ? 360000 : 90000);
  const name = `creator-${randomUUID().slice(0, 12)}`;
  const email = `${name}@example.com`;
  const visitor = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://localhost:3000" });
  try {
    await page.goto("/sign-up");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("New password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toContainText("verification link");
    await page.goto(await mailLink(request, email, "Verify your Snoozer email", "/auth/confirm"));
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page.getByRole("heading", { name: "Claim your address" })).toBeVisible();

    await page.getByLabel("Username").fill("studio");
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("status")).toContainText("unavailable");
    await page.getByLabel("Username").fill(name.toUpperCase());
    await page.getByRole("button", { name: "Claim address" }).click();
    await expect(page.getByRole("heading", { name: "Account Overview", exact: true })).toBeVisible();
    await page.goto("/studio/builder");
    await expect(page.getByRole("heading", { name: "Page Builder", exact: true })).toBeVisible();
    const profileTab = page.getByRole("tab", { name: "Profile", exact: true });
    await profileTab.focus();
    await profileTab.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Design", exact: true })).toBeFocused();
    await profileTab.click();
    await page.setViewportSize({ width: 360, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await checkLighthouse(page, "/studio");
    await page.getByRole("link", { name: "Premium", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Plan and usage" })).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 20", { exact: true })).toBeVisible();
    await expect(page.getByText(`@${name} · Draft`, { exact: true })).toBeVisible();
    const editProfile = page.getByRole("link", { name: `Edit @${name}` });
    const profileHref = (await editProfile.getAttribute("href"))!;
    expect(profileHref).toMatch(/^\/studio\/customize\?profile=[a-f0-9-]{36}$/);
    await editProfile.click();
    await expect(page).toHaveURL(/\/studio\/customize\?profile=/);
    await expect(page.getByRole("link", { name: "Image Host", exact: true })).toHaveAttribute("href", profileHref.replace("/studio/customize?", "/studio/image-host?"));
    await page.getByRole("link", { name: "Premium", exact: true }).click();
    const giftAdmin = createClient(project!, adminKey!, { auth: { persistSession: false } });
    const gift = await giftAdmin.rpc("issue_gift_code", {
      p_plan: "plus", p_version: 1, p_duration_days: 1, p_redeem_by: new Date(Date.now() + 3600000).toISOString(),
    }).single<{ code: string }>();
    expect(gift.error).toBeNull();
    await page.getByText("Redeem a plan gift", { exact: true }).click();
    await page.getByLabel("Gift code", { exact: true }).fill(gift.data!.code);
    await page.getByRole("button", { name: "Redeem gift code" }).click();
    await expect(page.getByText("Gift redeemed.")).toBeVisible();
    await expect(page.getByText("Plus", { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 100", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to Overview" }).click();

    const image = await sharp({ create: { width: 25, height: 25, channels: 3, background: "blue" } }).png().toBuffer();
    const stageOwner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
    const stageLogin = await stageOwner.auth.signInWithPassword({ email, password });
    expect(stageLogin.error).toBeNull();
    const billingStaff = stageLogin.data.user!.id;
    expect(billingStaff).toMatch(/^[a-f0-9-]{36}$/);
    const staffSql = (statement: string) => execFileSync("docker", [
      "exec", "supabase_db_snoozer-uk", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", statement,
    ]);
    await page.goto("/studio/plan");
    await expect(page.getByRole("link", { name: "Billing diagnostics" })).toHaveCount(0);
    staffSql("insert into snoozer.staff_roles(owner_id,role) values ('" + billingStaff + "','billing_diagnostics')");
    try {
      await page.reload();
      await page.getByRole("link", { name: "Billing diagnostics" }).click();
      await expect(page.getByRole("heading", { name: "Billing diagnostics" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Stripe sandbox" })).toBeVisible();
    } finally {
      staffSql("delete from snoozer.staff_roles where owner_id = '" + billingStaff + "'");
    }
    await page.goto("/studio/builder");
    await editorTab(page, "Profile");
    const stageAdmin = createClient(project!, adminKey!, { auth: { persistSession: false } });
    const { data: abandonedStage, error: stageError } = await stageAdmin.rpc("prepare_avatar_upload", {
      p_owner: stageLogin.data.user!.id, p_expected: 0, p_open: true,
    });
    expect(stageError).toBeNull();
    const abandonedPath = `${abandonedStage.scope}/${abandonedStage.key}`;
    const oldToken = await stageAdmin.storage.from("avatar-incoming").createSignedUploadUrl(abandonedPath);
    expect(oldToken.error).toBeNull();
    await page.getByRole("tabpanel", { name: "Profile" }).getByText("Upload recovery", { exact: true }).click();
    await page.getByRole("button", { name: "Discard pending upload" }).click();
    await expect(page.getByRole("status")).toHaveText("Pending upload cleared.");
    expect((await stageOwner.storage.from("avatar-incoming").uploadToSignedUrl(
      abandonedPath, oldToken.data!.token, image, { contentType: "image/png" },
    )).error).toBeNull();
    await editorTab(page, "Profile");
    await page.getByRole("button", { name: /Upload avatar|Finish pending upload/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose an image to upload" })).toBeVisible();

    await editorTab(page, "Profile");
    await page.getByRole("tabpanel", { name: "Profile" }).getByLabel("Choose an avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: image });
    await editorTab(page, "Profile");
    await page.getByRole("button", { name: /Upload avatar|Finish pending upload/ }).click();
    await expect(page.getByRole("status")).toContainText("Avatar saved");
    // Terminal is on a later catalogue page; filter the library rather than
    // assuming every design is present in the first 24-card page.
    await page.goto("/templates?q=terminal&category=cyber&palette=nocturne");
    await expect(page.getByRole("link", { name: "Customise this design", exact: true })).toHaveCount(1);
    await page.locator('a[href="/studio/builder?template=terminal-nocturne"]').click();
    await editorTab(page, "Design");
    await expect(page.getByRole("button", { name: "Apply template design", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "whoami", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Apply template design", exact: true }).click();
    await expect(page.getByRole("button", { name: "Apply template design", exact: true })).toHaveCount(0);

    await editorTab(page, "Profile");
    await page.getByLabel("Display name").fill("Snoozer Creator");
    await editorTab(page, "Profile");
    await page.getByLabel("Bio").fill("Private until I publish.");
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Add text section", exact: true }).click();
    await page.getByLabel("Section 1 heading").fill("whoami");
    await page.getByLabel("Section 1 text").fill("About this creator.");
    await page.getByRole("button", { name: "Add text section", exact: true }).click();
    await page.getByLabel("Section 2 heading").fill("Projects");
    await page.getByLabel("Section 2 text").fill("Project summary.");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 1 text").fill("First line.\nLiteral <em>markup</em>.");
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Move up (section 2)" }).press("Enter");
    await expect(page.getByLabel("Section 1 heading")).toBeFocused();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Projects");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Draft saved.");
    await page.goto("/studio/builder?template=forest-glacier");
    await editorTab(page, "Design");
    await expect(page.getByRole("button", { name: "Apply template design", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Apply template design", exact: true }).click();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Projects");
    const designPreview = page.getByRole("region", { name: "Page preview" });
    await expect(designPreview).toHaveAttribute("data-template-style", "forest");
    await expect(designPreview).toHaveAttribute("data-layout", "centred");
    await expect(page.getByLabel("Accent Color")).toBeVisible();
    await expect(page.getByLabel("Background Color")).toBeVisible();
    await editorTab(page, "Design");
    await page.getByLabel("Theme").selectOption("daybreak");
    await expect(designPreview).toHaveClass(/theme-daybreak/);
    await page.getByLabel("Link colour").selectOption("mint");
    const minimalMp4 = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
    await page.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({
      name: "profile-background.mp4", mimeType: "video/mp4", buffer: minimalMp4,
    });
    await expect(designPreview).toHaveAttribute("data-background-video", "true");
    await expect(designPreview.locator("video.profile-background-video")).toHaveAttribute("src", /\/studio\/background-video\//);
    await page.getByLabel("Background Effects").selectOption("gradient");
    await expect(designPreview.locator(".profile-effects-layer")).toHaveAttribute("data-background", "gradient");
    await page.getByRole("textbox", { name: "Location", exact: true }).fill("Studio North");
    await page.getByRole("checkbox", { name: "Show location on my profile" }).check();
    await expect(designPreview.locator(".profile-location")).toContainText("Studio North");
    await page.getByRole("checkbox", { name: "Monochrome Icons" }).check();
    await expect(designPreview).toHaveAttribute("data-monochrome-icons", "true");
    await page.getByRole("checkbox", { name: "Animated Title" }).check();
    await expect(designPreview).toHaveAttribute("data-animated-title", "true");
    await page.getByRole("checkbox", { name: "Swap Box Colors" }).check();
    await expect(designPreview).toHaveAttribute("data-swap-box-colors", "true");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 1 type").selectOption("callout");
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Add text section" }).click();
    await editorTab(page, "Sections");
    await page.getByLabel("Section 3 type").selectOption("quote");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 3 attribution").fill("Studio notebook");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 3 text").fill("Stay curious.");
    const preview = page.getByRole("region", { name: "Page preview" });
    await expect(preview.locator("blockquote")).toHaveText("Stay curious.");
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Add text section" }).click();
    await page.getByRole("combobox", { name: "Section 4 type", exact: true }).selectOption("countdown");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 4 heading").fill("Launch");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 4 text").fill("Save the date.");
    await expect(preview.getByText("Choose a target time to preview the countdown.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Lock section 4" })).toBeDisabled();
    await editorTab(page, "Sections");
    await page.getByLabel("Section 4 target time").fill("2096-02-29T18:15");
    await expect(preview.locator(".countdown-remaining")).toContainText("remaining");
    await page.setViewportSize({ width: 1440, height: 1100 });
    const sections = page.getByRole("group", { name: /^Text sections/ });
    const firstSection = sections.locator('[data-reorder-index="0"]');
    const nextSection = sections.locator('[data-reorder-index="1"]');
    await firstSection.evaluate((card) => card.scrollIntoView({ block: "start" }));
    const handle = (await firstSection.locator(".reorder-handle").boundingBox())!;
    const target = (await nextSection.locator(".reorder-handle").boundingBox())!;
    const start = { x: handle.x + 15, y: handle.y + 20 };
    const end = { x: target.x + 15, y: target.y + 20 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(1, end.y, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Projects");

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await expect(nextSection).toHaveAttribute("data-drop-target", "true");
    await page.mouse.up();
    await expect(page.getByLabel("Section 2 heading")).toHaveValue("Projects");
    await expect(page.getByLabel("Section 2 heading")).toBeFocused();
    await page.getByRole("button", { name: "Undo edit" }).click();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Projects");
    await page.getByRole("button", { name: "Redo edit" }).click();
    await expect(page.getByLabel("Section 2 heading")).toHaveValue("Projects");
    for (const [index, label] of ["First", "Second"].entries()) {
      await editorTab(page, "Links");
      await page.getByRole("button", { name: "Add link" }).click();
      await editorTab(page, "Links");
      await page.getByLabel(`Link ${index + 1} label`).fill(label);
      await editorTab(page, "Links");
      await page.getByLabel(`Link ${index + 1} URL`).fill(`https://example.com/${label}`);
    }
    const reorderedLinkActions = page.getByRole("group", { name: "Actions for link 2", exact: true });
    await expect(reorderedLinkActions).toBeVisible();
    await page.getByRole("button", { name: "Move up (link 2)" }).press("Enter");
    await expect(reorderedLinkActions).toBeVisible();
    await expect(page.getByLabel("Link 1 label")).toBeFocused();
    await expect(page.getByLabel("Link 1 label")).toHaveValue("Second");
    await page.getByRole("button", { name: "Undo edit" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toHaveValue("First");
    await page.getByRole("button", { name: "Redo edit" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toHaveValue("Second");

    await page.setViewportSize({ width: 390, height: 844 });
    // Link rows now keep all actions visible in normal flow. On a phone the
    // explicit controls are the reliable accessible reorder mechanism; both
    // rows do not need to fit in the viewport simultaneously for drag-and-drop.
    const mobileLinkActions = page.getByRole("group", { name: "Actions for link 2", exact: true });
    await expect(mobileLinkActions).toBeVisible();
    await page.getByRole("button", { name: "Move up (link 2)", exact: true }).click();
    await expect(page.getByLabel("Link 1 label")).toHaveValue("First");
    await expect(page.getByLabel("Link 1 label")).toBeFocused();
    await expect(page.getByRole("group", { name: "Actions for link 1", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1100 });

    // Link controls stay visible in the inspector; Remove is never hidden in a clipped popover.
    await editorTab(page, "Links");
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await page.getByLabel("Link 3 label").fill("Temporary link");
    await page.getByLabel("Link 3 URL").fill("https://example.com/temporary");
    const actionControls = page.getByRole("group", { name: "Actions for link 3", exact: true });
    await expect(actionControls).toBeVisible();
    const removeLink = page.getByRole("button", { name: "Remove link 3", exact: true });
    await expect(removeLink).toBeVisible();
    await removeLink.scrollIntoViewIfNeeded();
    const removeIsTopmost = await removeLink.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || Boolean(hit && element.contains(hit));
    });
    expect(removeIsTopmost).toBe(true);
    await removeLink.click();
    await expect(page.getByLabel("Link 3 label")).toHaveCount(0);
    await expect(page.locator(".link-row")).toHaveCount(2);

    await editorTab(page, "Sections");
    const lock = page.getByRole("checkbox", { name: "Lock section 2" });
    await lock.check();
    await expect(page.getByLabel("Section 2 heading")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Remove section 2" })).toBeDisabled();
    await page.getByRole("button", { name: "Undo edit" }).click();
    await expect(page.getByLabel("Section 2 heading")).toBeEnabled();
    await page.getByRole("button", { name: "Redo edit" }).click();
    await expect(lock).toBeChecked();
    await editorTab(page, "Links");
    const instagramProvider = page.getByRole("button", { name: "Instagram" });
    await expect(instagramProvider.locator("svg path")).toHaveAttribute("d", /^M/);
    await page.getByRole("button", { name: "Support", exact: true }).click();
    const kofiProvider = page.getByRole("button", { name: "Ko-fi", exact: true });
    await expect(kofiProvider).toBeVisible();
    await kofiProvider.click();
    const kofiRow = page.locator(".link-row").nth(2);
    await expect(page.getByLabel("Link 3 label")).toHaveValue("Ko-fi");
    await expect(page.getByLabel("Link 3 URL")).toHaveValue("https://ko-fi.com/");
    await expect(kofiRow.getByLabel("Visible on profile")).not.toBeChecked();
    await page.getByLabel("Link 3 URL").fill("https://ko-fi.com/creator");
    await page.getByLabel("Link 3 label").fill("Support my projects");
    await kofiRow.getByLabel("Visible on profile").check();
    await page.getByRole("button", { name: "Developer", exact: true }).click();
    await page.getByRole("button", { name: "GitHub", exact: true }).click();
    const githubRow = page.locator(".link-row").nth(3);
    await page.getByLabel("Link 4 label").fill("Developer notes");
    await page.getByLabel("Link 4 URL").fill("https://github.com/example");
    await expect(githubRow.getByLabel("Visible on profile")).not.toBeChecked();
    await githubRow.getByLabel("Visible on profile").check();
    await githubRow.getByLabel("Display mode").selectOption("text");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();

    const publicPage = await visitor.newPage();
    const unavailable = await publicPage.goto(`/${name}`);
    expect(unavailable?.status()).toBe(404);
    await expect(publicPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();

    await publicPage.goto(`/${name}`);
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();
    await expect(publicPage.locator(".profile-links li")).toHaveText(["First ↗", "Second ↗", "Developer notes ↗"]);
    const kofiLink = publicPage.getByRole("link", { name: "Support my projects · Ko-fi", exact: true });
    await expect(kofiLink).toHaveAttribute("href", "https://ko-fi.com/creator");
    await expect(kofiLink.locator(".profile-social-mark svg path")).toHaveAttribute("d", /^M/);

    // The reference-style public page intentionally suppresses the creator's
    // extra sections, custom blocks and interactive widgets. Their data remains
    // in Studio drafts and publication history, verified below after restore.
    await expect(publicPage.locator(".profile-text-section")).toHaveCount(0);
    await expect(publicPage.locator(".profile-content-block")).toHaveCount(0);
    await expect(publicPage.locator(".profile-widgets")).toHaveCount(0);
    await expect(publicPage.locator(".countdown time")).toHaveCount(0);
    await expect(publicPage.locator(".profile-callout")).toHaveCount(0);
    await expect(publicPage.locator("blockquote")).toHaveCount(0);
    await expect(publicPage.locator("figcaption")).toHaveCount(0);
    await expect(publicPage.getByText("Literal <em>markup</em>.", { exact: false })).toHaveCount(0);
    const bioCard = publicPage.locator(".profile-card");
    await expect(publicPage.locator(".profile-official-badges")).toHaveCount(0);
    await expect(bioCard).toHaveAttribute("data-background-video", "true");
    const viewportVideo = publicPage.locator(".profile-page-background video.profile-background-video--viewport");
    await expect(viewportVideo).toBeVisible();
    const publicVideoBounds = await viewportVideo.evaluate((video) => video.getBoundingClientRect().toJSON());
    expect(publicVideoBounds.width).toBeGreaterThanOrEqual(await publicPage.evaluate(() => window.innerWidth) - 1);
    expect(publicVideoBounds.height).toBeGreaterThanOrEqual(await publicPage.evaluate(() => window.innerHeight) - 1);
    const publicVideoSrc = await viewportVideo.getAttribute("src");
    expect(publicVideoSrc).toMatch(/^\/media\/background-video\/[0-9a-f-]{36}$/);
    const publicVideoResponse = await visitor.request.get("http://localhost:3000" + publicVideoSrc!, { maxRedirects: 0 });
    expect(publicVideoResponse.status()).toBe(307);
    await expect(bioCard).toHaveClass(/profile-card--bio-experience/);
    await expect(bioCard).toHaveClass(/theme-daybreak/);
    await expect(publicPage.locator(".profile-links")).toHaveAttribute("style", /--link-background/);
    await expect(bioCard).toHaveAttribute("data-layout", "centred");
    await expect(bioCard).toHaveAttribute("data-density", "airy");
    await expect(bioCard).toHaveCSS("text-align", "center");
    expect(await bioCard.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(576);
    expect(await bioCard.evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThan(16);
    expect(await publicPage.locator(".profile-identity").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
    expect(await publicPage.locator(".profile-links a").first()
      .evaluate((element) => parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThan(0);
    // Custom sections and blocks remain editable in Studio, but are deliberately
    // not rendered on the compact reference-style public profile. Their values
    // are verified after restoring the saved publication below.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(publicPage.locator(".profile-effects-layer")).toHaveAttribute("data-background", "gradient");
    await expect(publicPage.getByRole("checkbox", { name: "Disable profile effects" })).toHaveCount(0);
    await expect(publicPage.locator(".profile-effects-layer")).toHaveAttribute("data-background", "gradient");
    await publicPage.emulateMedia({ reducedMotion: "reduce" });
    await expect(publicPage.locator(".profile-decoration")).toHaveCSS("animation-name", "none");
    await expect(publicPage.locator(".profile-links a").first()).toHaveCSS("transition-duration", "0s");
    for (const [option, width] of [["narrow", 320], ["phone", 375]] as const) {
      await page.getByLabel("Preview width").selectOption(option);
      await publicPage.setViewportSize({ width, height: 850 });
      const measure = (card: Element) => ({
        width: card.getBoundingClientRect().width,
        fontSize: getComputedStyle(card.querySelector(".profile-identity .profile-name-heading")!).fontSize,
        gap: getComputedStyle(card.querySelector(".profile-inner")!).gap,
        radius: getComputedStyle(card).borderRadius,
        align: getComputedStyle(card).textAlign,
        columns: getComputedStyle(card.querySelector(".profile-inner")!).gridTemplateColumns.split(" ").length,
      });
      const live = await publicPage.locator(".profile-card").evaluate(measure);
      expect(live.width).toBeLessThanOrEqual(width);
      expect(live.align).toBe("center");
      expect(live.columns).toBe(1);
      expect(live.radius).not.toBe("0px");
    }
    await page.getByLabel("Preview width").selectOption("wide");
    await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const avatarPath = await publicPage.locator("img").getAttribute("src");
    expect(avatarPath).toBeTruthy();
    expect((await visitor.request.get(avatarPath!)).headers()["content-type"]).toBe("image/webp");

    await editorTab(page, "Profile");
    await page.getByLabel("Display name").fill("Second publication");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 4 target time").fill("2000-01-01T00:00");
    await expect(preview.locator(".countdown-remaining")).toHaveText("Countdown finished.");
    await editorTab(page, "Design");
    await page.getByLabel("Background Effects").selectOption("none");
    await page.getByRole("textbox", { name: "Location" }).fill("Studio East");
    await page.getByRole("checkbox", { name: "Show location on my profile" }).uncheck();
    await page.getByRole("checkbox", { name: "Monochrome Icons" }).uncheck();
    await page.getByRole("checkbox", { name: "Animated Title" }).uncheck();
    await page.getByRole("checkbox", { name: "Swap Box Colors" }).uncheck();
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Remove section 3" }).click();
    await lock.uncheck();
    await page.getByRole("checkbox", { name: "Hide section 2 from public profile" }).check();
    await expect(preview.getByRole("heading", { name: "Projects" })).toHaveCount(0);
    // Public reference layout keeps extra section content out of the page even
    // when an earlier publication still contains the unhidden section.
    await expect(publicPage.locator(".profile-text-section")).toHaveCount(0);
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect.poll(async () => (await visitor.request.get(`/${name}`)).text()).toContain("Second publication");
    // Publication history remains available as a route, but it is not a
    // sidebar destination in the reference-matched dashboard navigation.
    await page.goto(profileHref.replace("/studio/customize?", "/studio/history?"));
    await expect(page.getByRole("heading", { name: "Publish history" })).toBeVisible();
    const firstVersion = page.getByRole("listitem").filter({ hasText: "Snoozer Creator" });
    const historyPreviewHref = (await firstVersion.getByRole("link", { name: /Preview version/ }).getAttribute("href"))!;
    await firstVersion.getByRole("link", { name: /Preview version/ }).click();
    await expect(page.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();
    await page.getByRole("button", { name: "Restore to draft" }).click();
    await expect(page.getByRole("status")).toContainText("Version restored");
    await expect(page.getByLabel("Display name")).toHaveValue("Snoozer Creator");
    await expect(page.getByLabel("Section 2 heading")).toHaveValue("Projects");
    await editorTab(page, "Design");
    await expect(page.getByRole("textbox", { name: "Location" })).toHaveValue("Studio North");
    await expect(page.getByRole("checkbox", { name: "Show location on my profile" })).toBeChecked();
    await expect(page.getByLabel("Background Effects")).toHaveValue("gradient");
    await expect(page.getByRole("checkbox", { name: "Monochrome Icons" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Animated Title" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Swap Box Colors" })).toBeChecked();
    await editorTab(page, "Sections");
    await expect(page.getByRole("checkbox", { name: "Hide section 2 from public profile" })).not.toBeChecked();
    await expect(page.getByLabel("Section 2 type")).toHaveValue("callout");
    await expect(lock).toBeChecked();
    await expect(page.getByLabel("Section 2 heading")).toBeDisabled();
    await expect(page.getByLabel("Section 3 type")).toHaveValue("quote");
    await expect(page.getByLabel("Section 3 attribution")).toHaveValue("Studio notebook");
    await expect(page.getByLabel("Section 4 target time")).toHaveValue("2096-02-29T18:15");
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Second publication" })).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Projects" })).toHaveCount(0);
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByText("Live · Up to date")).toBeVisible();
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();

    const responsivePage = await page.context().newPage();
    try {
      await responsivePage.setViewportSize({ width: 360, height: 812 });
      for (const path of [profileHref, ...["analytics", "gallery", "gallery/folders", "history", "plan"].map((section) => profileHref.replace("/studio/customize?", `/studio/${section}?`)), historyPreviewHref, "/studio/plan/gifts", "/studio/billing-diagnostics", `/${name}`]) {
        const response = await responsivePage.goto(path);
        expect(response?.status()).toBe(path === "/studio/billing-diagnostics" ? 404 : 200);
        expect(await responsivePage.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(360);
      }
      const builderHref = profileHref.replace("/studio/customize?", "/studio/builder?");
      await responsivePage.goto(builderHref);
      for (const tab of ["Profile", "Design", "Links", "Sections", "Settings"]) {
        await editorTab(responsivePage, tab);
        expect(await responsivePage.evaluate(() => document.documentElement.scrollWidth), tab).toBeLessThanOrEqual(360);
      }
    } finally { await responsivePage.close(); }

    await editorTab(page, "Settings");
    await expect(page.getByRole("tabpanel", { name: "Settings", exact: true })).toBeInViewport();
    await expect(page.locator("form form")).toHaveCount(0);
    await page.getByRole("button", { name: "Take page offline" }).click();
    await expect(page.getByText("Offline · Draft only")).toBeVisible();
    expect((await visitor.request.get(avatarPath!)).status()).toBe(404);
    await page.locator(".account-dropdown > summary").click();
     await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("password reset link");
    await page.goto(await mailLink(request, email, "Reset your Snoozer password", "/reset-password"));
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("status")).toContainText("password has been updated");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/studio/builder");
    await expect(page.getByRole("heading", { name: "Page Builder", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();

    const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    const liveAudit = await page.context().newPage();
    await liveAudit.goto(`/${name}`);
    expect((await new AxeBuilder({ page: liveAudit }).withTags(tags).analyze()).violations).toEqual([]);
    await liveAudit.close();

    const ownerClient = createClient(project!, publishableKey!, { auth: { persistSession: false } });
    expect((await ownerClient.auth.signInWithPassword({ email, password: newPassword })).error).toBeNull();
    const { data: oldDraft } = await ownerClient.rpc("get_draft");
    const { data: oldScope } = await ownerClient.rpc("draft_media_scope", { p_expected: oldDraft.revision });
    expect(oldScope).toMatch(/^[0-9a-f-]{36}$/);
    const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
    const incoming = admin.storage.from("avatar-incoming");
    const images = admin.storage.from("avatar-images");
    const { data: lateUpload, error: signingError } = await incoming.createSignedUploadUrl(`${oldScope}/pending`);
    expect(signingError).toBeNull();

    await editorTab(page, "Settings");
    await page.getByText("Delete profile", { exact: true }).first().click();
    await page.getByText("Review profile deletion").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByText("Review profile deletion").click();
    await page.getByLabel(`Type ${name} to confirm`).fill("wrong-name");
    await page.getByRole("button", { name: "Permanently delete profile" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "exact username" })).toBeVisible();
    await page.getByLabel(`Type ${name} to confirm`).fill(name);
    await page.getByRole("button", { name: "Permanently delete profile" }).click();
    await expect(page).toHaveURL(/\/studio\?deleted=1$/);
    await expect(page.getByRole("status")).toContainText("Your profile was deleted");
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    expect((await publicPage.goto(`/${name}`))?.status()).toBe(404);
    expect((await visitor.request.get(avatarPath!)).status()).toBe(404);
    expect((await ownerClient.rpc("claim_profile", { p_name: name })).error?.code).toBe("23505");

    const replacement = `new-${name}`;
    await page.getByLabel("Username").fill(replacement);
    await page.getByRole("button", { name: "Claim address" }).click();
    await expect(page.getByRole("heading", { name: "Account Overview", exact: true })).toBeVisible();
    // Re-authenticate the independent API client after the delete/reclaim lifecycle.
    // The browser's authenticated Studio session has already confirmed the replacement
    // profile; use a fresh JWT before checking it through the separate Supabase client.
    const replacementOwnerClient = createClient(project!, publishableKey!, { auth: { persistSession: false } });
    const { error: replacementSignInError } = await replacementOwnerClient.auth.signInWithPassword({ email, password: newPassword });
    expect(replacementSignInError).toBeNull();
    const { data: newDraft, error: newDraftError } = await replacementOwnerClient.rpc("get_draft");
    expect(newDraftError).toBeNull();
    expect(newDraft).toMatchObject({ username: replacement, revision: oldDraft.revision + 1 });
    const { data: newScope, error: newScopeError } = await replacementOwnerClient.rpc("draft_media_scope", { p_expected: newDraft!.revision });
    expect(newScopeError).toBeNull();
    expect(newScope).toMatch(/^[0-9a-f-]{36}$/);
    expect(newScope).not.toBe(oldScope);
    expect((await replacementOwnerClient.storage.from("avatar-incoming").uploadToSignedUrl(
      `${oldScope}/pending`, lateUpload!.token, image, { contentType: "image/png" },
    )).error).toBeNull();
    const { data: newUpload, error: newSigningError } = await incoming.createSignedUploadUrl(`${newScope}/pending`);
    expect(newSigningError).toBeNull();
    expect((await replacementOwnerClient.storage.from("avatar-incoming").uploadToSignedUrl(
      `${newScope}/pending`, newUpload!.token, image, { contentType: "image/png" },
    )).error).toBeNull();

    // Move the clock forward for this one test job in the disposable Docker database.
    execFileSync("docker", ["exec", "supabase_db_snoozer-uk", "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-c", `update snoozer.avatar_cleanup set available_at = now() where scope = '${oldScope}'`]);
    const cleanup = execFileSync(process.execPath, ["scripts/cleanup-avatars.mjs"], { encoding: "utf8" });
    expect(cleanup).toContain("completed: 1");
    for (const bucket of [incoming, images]) {
      const { data, error } = await bucket.list(oldScope);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    expect((await incoming.list(newScope)).data?.map(({ name }) => name)).toEqual(["pending"]);
  } finally {
    await visitor.close();
  }
});

test("concurrent claims yield one winner and direct storage requests are denied", async () => {
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const name = `race-${randomUUID().slice(0, 12)}`;
  const users = await Promise.all([1, 2].map(async (index) => {
    const email = `${name}-${index}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const client = createClient(project!, publishableKey!, { auth: { persistSession: false } });
    expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
    return { client, id: created.data.user!.id };
  }));
  const outcomes = await Promise.all(users.map(({ client }) => client.rpc("claim_profile", { p_name: name })));
  expect(outcomes.filter(({ error }) => !error)).toHaveLength(1);
  expect(outcomes.filter(({ error }) => error?.code === "23505")).toHaveLength(1);
  const winnerIndex = outcomes.findIndex(({ error }) => !error);
  const winner = users[winnerIndex];
  const other = users[1 - winnerIndex];
  const { data: scope, error } = await winner.client.rpc("draft_media_scope", { p_expected: 0 });
  expect(error).toBeNull();
  expect(scope).toMatch(/^[0-9a-f-]{36}$/);
  const image = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  expect((await other.client.storage.from("avatar-incoming").upload(`${scope}/pending`, image)).error).toBeTruthy();
  expect((await other.client.rpc("set_avatar", { p_owner: winner.id, p_expected: 0, p_avatar: randomUUID() })).error).toBeTruthy();
});

test("background images upload through the direct button and publish without a public gallery", async ({ page, request }) => {
  test.setTimeout(90000);
  const ready = await request.get("/health/ready");
  expect(ready.status()).toBe(200);
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const name = "background-" + randomUUID().slice(0, 12);
  const email = name + "@example.com";
  expect((await admin.auth.admin.createUser({ email, password, email_confirm: true })).error).toBeNull();

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username").fill(name);
  await page.getByRole("button", { name: "Claim address" }).click();

  // The claim action redirects to Studio only after the profile RPC commits.
  // Wait for that completed state before navigating directly to the editor;
  // otherwise CI can race the server action and be redirected back to Overview.
  await expect(page).toHaveURL(/\/studio\/?$/);
  await expect(page.getByRole("heading", { name: "Account Overview" })).toBeVisible();
  await expect(page.getByText("@" + name, { exact: true })).toBeVisible();

  await page.goto("/studio/customize");
  await editorTab(page, "Design");
  await expect(page.getByRole("heading", { name: "Assets Uploader", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Background", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload background image", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload background video", exact: true })).toBeVisible();

  const image = await sharp({ create: { width: 1280, height: 720, channels: 3, background: "blue" } }).png().toBuffer();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload background image", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "blue-shoreline.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("status").filter({ hasText: "Background image added to your draft" })).toBeVisible();

  const preview = page.getByRole("region", { name: "Page preview" });
  await expect(preview).toHaveAttribute("data-background-image", "true");
  const backgroundValue = await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--profile-background-image"));
  const imageId = backgroundValue.match(/[0-9a-f-]{36}/i)?.[0];
  expect(imageId).toMatch(/^[0-9a-f-]{36}$/i);
  const privatePreview = await page.request.get("/studio/gallery/image/" + imageId);
  expect(privatePreview.status()).toBe(200);
  expect(privatePreview.headers()["content-type"]).toBe("image/webp");

  const publicPath = "/media/gallery/" + name + "/" + imageId;
  expect((await request.get(publicPath)).status()).toBe(404);
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();
  const liveImage = await request.get(publicPath);
  expect(liveImage.status()).toBe(200);
  expect(liveImage.headers()["content-type"]).toBe("image/webp");

  const publicPage = await request.get("/" + name);
  expect(publicPage.status()).toBe(200);
  const html = await publicPage.text();
  expect(html).toContain('data-background-image="true"');
  expect(html).not.toContain('class="profile-gallery"');
  await expect(page.locator(".profile-gallery")).toHaveCount(0);

  // The old gallery URL remains a safe redirect to the direct-upload controls.
  await page.goto("/studio/gallery");
  await expect(page).toHaveURL(/\/studio\/customize/);
  await expect(page.getByRole("button", { name: "Upload background image", exact: true })).toBeVisible();
});

test("autosave keeps the public page stable and recovers a stale tab", async ({ page, request }) => {
  test.setTimeout(90000);
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const name = `autosave-${randomUUID().slice(0, 12)}`;
  const email = `${name}@example.com`;
  expect((await admin.auth.admin.createUser({ email, password, email_confirm: true })).error).toBeNull();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username").fill(name);
  await page.getByRole("button", { name: "Claim address" }).click();
  await page.goto("/studio/builder");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();

  const stale = await page.context().newPage();
  await stale.goto("/studio/builder");
  await expect(stale.getByLabel("Display name")).toHaveValue(name);

  await editorTab(page, "Profile");
  await page.getByLabel("Display name").fill("Autosaved from the first tab");
  await expect(page.getByRole("status")).toHaveText("Draft saved.");
  const publicPage = await request.get(`/${name}`);
  expect(await publicPage.text()).not.toContain("Autosaved from the first tab");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Autosaved from the first tab");

  await editorTab(stale, "Profile");
  await stale.getByLabel("Display name").fill("Unsaved from the stale tab");
  await expect(stale.getByRole("alert").filter({ hasText: "Your draft changed elsewhere" })).toBeVisible();
  await expect(stale.getByRole("button", { name: "Publish page" })).toBeDisabled();
  await stale.getByText("Copy unsaved edits", { exact: true }).click();
  await expect(stale.getByLabel("Unsaved profile content")).toHaveValue(/Unsaved from the stale tab/);
  await stale.getByRole("button", { name: "Discard local edits and load saved draft" }).click();
  await expect(stale.getByLabel("Display name")).toHaveValue("Autosaved from the first tab");

  await editorTab(stale, "Links");
  await stale.getByRole("button", { name: "Add link" }).click();
  await editorTab(stale, "Links");
  await stale.getByLabel("Link 1 label").fill("Portfolio");
  await expect(stale.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await editorTab(stale, "Links");
  await stale.getByLabel("Link 1 URL").fill("https://example.com/");
  await expect(stale.getByRole("status")).toHaveText("Draft saved.");
  await stale.reload();
  await expect(stale.getByLabel("Link 1 label")).toHaveValue("Portfolio");
  await expect(stale.getByLabel("Link 1 URL")).toHaveValue("https://example.com/");

  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await stale.route("**/studio/builder", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  }, { times: 1 });
  try {
    await editorTab(stale, "Profile");
    await stale.getByLabel("Bio").fill("First edit");
    await expect(stale.getByRole("status")).toHaveText("Saving…");
    await editorTab(stale, "Profile");
    await stale.getByLabel("Bio").fill("Edit made during the save");
  } finally {
    release();
  }
  await expect(stale.getByRole("status")).toHaveText("Draft saved.");
  await stale.getByRole("button", { name: "Undo edit" }).click();
  await expect(stale.getByLabel("Bio")).toHaveValue("First edit");
  await expect(stale.getByRole("status")).toHaveText("Draft saved.");
  await stale.getByRole("button", { name: "Redo edit" }).click();
  await expect(stale.getByRole("status")).toHaveText("Draft saved.");
  await stale.reload();
  await expect(stale.getByLabel("Bio")).toHaveValue("Edit made during the save");
});

test("sandbox payment webhook fixtures verify signatures and store a single receipt", async ({ request }) => {
  const stripeSecret = process.env.STRIPE_SANDBOX_WEBHOOK_SECRET;
  const kofiToken = process.env.KOFI_WEBHOOK_TOKEN;
  test.skip(!stripeSecret || !kofiToken || Boolean(process.env.STRIPE_SANDBOX_API_KEY), "Requires local fixture secrets only.");
  const operator = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const diagnostics = async () => {
    const { data, error } = await operator.rpc("get_billing_diagnostics");
    expect(error).toBeNull();
    return data;
  };
  const before = await diagnostics();
  const nonce = randomUUID();
  const stripeEvent = JSON.stringify({
    id: "evt_" + nonce.replaceAll("-", ""), type: "checkout.session.completed", object: "event",
    created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { id: "cs_test_Fixture" } },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: stripeEvent, secret: stripeSecret! });
  const stripePath = "/api/v1/billing/stripe/webhook";
  const sendStripe = (body: string) => request.post(stripePath, {
    data: body, headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
  });
  expect((await sendStripe(stripeEvent + " ")).status()).toBe(400);
  expect((await sendStripe(stripeEvent)).status()).toBe(204);
  expect((await sendStripe(stripeEvent)).status()).toBe(204);

  const sendKofi = (token: string) => request.post("/api/v1/billing/kofi/webhook", { form: {
    data: JSON.stringify({
      verification_token: token, type: "Donation", message_id: nonce, kofi_transaction_id: "fixture-" + nonce,
      timestamp: new Date().toISOString(), amount: "3.50", currency: "GBP",
    }),
  } });
  expect((await sendKofi("invalid")).status()).toBe(401);
  expect((await sendKofi(kofiToken!)).status()).toBe(200);
  expect((await sendKofi(kofiToken!)).status()).toBe(200);

  const after = await diagnostics();
  expect(after.stripeSandbox.unboundCompletionReceipts).toBe(before.stripeSandbox.unboundCompletionReceipts + 1);
  expect(after.kofi.unclaimedReceipts).toBe(before.kofi.unclaimedReceipts + 1);
});

test("sign-ins persist across navigation and independent accounts switch without cross-account access", async ({ page }) => {
  test.setTimeout(90_000);
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const nameA = "saved-a-" + randomUUID().slice(0, 9);
  const nameB = "saved-b-" + randomUUID().slice(0, 9);
  const emailA = nameA + "@example.com";
  const emailB = nameB + "@example.com";
  const accountA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
  const accountB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
  expect(accountA.error).toBeNull();
  expect(accountB.error).toBeNull();
  try {
    // Account A survives navigation and reload, not just the initial response.
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(emailA);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/studio/);
    await page.goto("/pricing");
    await page.reload();
    await page.locator(".account-dropdown > summary").click();
    await expect(page.locator(".account-popover").getByText(nameA, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Switch Accounts" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("link", { name: "Add an account" }).click();
    await expect(page).toHaveURL(/\/sign-in\?add=1/);

    // Adding B must not destroy account A's HttpOnly cookies or force re-login.
    await page.getByLabel("Email address").fill(emailB);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Add account" }).click();
    await expect(page).toHaveURL(/\/studio/);
    await page.locator(".account-dropdown > summary").click();
    await page.getByRole("button", { name: "Switch Accounts" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.locator(".account-entry")).toHaveCount(2);
    await expect(modal.getByText(nameB, { exact: true })).toBeVisible();
    const first = modal.locator(".account-entry").filter({ hasText: nameA });
    await first.locator(".account-row-actions > summary").click();
    await first.getByRole("button", { name: "Switch to account" }).click();
    await expect(page).toHaveURL(/\/studio/);
    // Help Centre is now a separate site; test the authenticated session on a main-site route.
    await page.goto("/pricing");
    await page.reload();
    await page.locator(".account-dropdown > summary").click();
    await expect(page.locator(".account-popover").getByText(nameA, { exact: true })).toBeVisible();

    // Only A is revoked on Logout. B's saved session becomes active.
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL("/");
    await page.locator(".account-dropdown > summary").click();
    await expect(page.locator(".account-popover").getByText(nameB, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Switch Accounts" }).click();
    await expect(page.getByRole("dialog").locator(".account-entry")).toHaveCount(1);
    await page.getByRole("button", { name: "Close account manager" }).click();
    await page.goto("/studio");
    await page.reload();
    await page.locator(".account-dropdown > summary").click();
    await expect(page.locator(".account-popover").getByText(nameB, { exact: true })).toBeVisible();

    const visibleCookies = await page.evaluate(() => document.cookie);
    expect(visibleCookies).not.toContain("snoozer_saved_accounts_v1");
    expect(visibleCookies).not.toContain("snoozer-session-");
  } finally {
    if (accountA.data.user) await admin.auth.admin.deleteUser(accountA.data.user.id);
    if (accountB.data.user) await admin.auth.admin.deleteUser(accountB.data.user.id);
  }
});

test("Owner administration requires verified role and MFA for privileged mutations", async ({ request }) => {
  test.setTimeout(60000);
  const admin=createClient(project!,adminKey!,{auth:{persistSession:false}});
  const email="owner-admin-"+randomUUID().slice(0,12)+"@example.com";
  const ordinaryEmail="owner-ordinary-"+randomUUID().slice(0,12)+"@example.com";
  const ownerResult=await admin.auth.admin.createUser({email,password,email_confirm:true});
  const ordinaryResult=await admin.auth.admin.createUser({email:ordinaryEmail,password,email_confirm:true});
  expect(ownerResult.error).toBeNull();
  expect(ordinaryResult.error).toBeNull();
  const ownerId=ownerResult.data.user!.id,ordinaryId=ordinaryResult.data.user!.id;
  const sql=(statement:string)=>execFileSync("docker",[
    "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c",statement
  ]);
  sql("insert into snoozer.platform_owners(owner_id) values ('"+ownerId+"')");
  try {
    const owner=createClient(project!,publishableKey!,{auth:{persistSession:false}});
    const ordinary=createClient(project!,publishableKey!,{auth:{persistSession:false}});
    expect((await owner.auth.signInWithPassword({email,password})).error).toBeNull();
    expect((await ordinary.auth.signInWithPassword({email:ordinaryEmail,password})).error).toBeNull();
    expect((await owner.rpc("is_platform_owner")).data).toBe(true);
    expect((await ordinary.rpc("is_platform_owner")).data).toBe(false);
    const listing=await owner.rpc("owner_user_search",{p_query:ordinaryEmail,p_limit:5});
    expect(listing.error).toBeNull();
    expect(listing.data).toEqual(expect.arrayContaining([expect.objectContaining({id:ordinaryId,email:ordinaryEmail})]));
    const denied=await ordinary.rpc("owner_user_search",{p_query:ordinaryEmail,p_limit:5});
    expect(denied.error?.code).toBe("42501");
    const firstPage=await owner.rpc("owner_user_search_page",{p_query:"",p_limit:1});
    expect(firstPage.error).toBeNull();
    expect(firstPage.data).toHaveLength(1);
    const firstAccount=firstPage.data[0] as {id:string;created_at:string};
    const nextPage=await owner.rpc("owner_user_search_page",{
      p_query:"",p_before_created:firstAccount.created_at,p_before_id:firstAccount.id,p_limit:1
    });
    expect(nextPage.error).toBeNull();
    expect(nextPage.data).toHaveLength(1);
    expect(nextPage.data[0].id).not.toBe(firstAccount.id);
    expect((await ordinary.rpc("owner_user_search_page",{p_query:ordinaryEmail,p_limit:1})).error?.code).toBe("42501");
    expect((await owner.rpc("owner_user_search_page",{p_before_created:firstAccount.created_at})).error?.code).toBe("22023");
    const profileName="pagetest-"+randomUUID().slice(0,8);
    expect((await ordinary.rpc("claim_profile",{p_name:profileName})).error).toBeNull();
    const inventory=await owner.rpc("owner_profile_inventory_page",{p_query:profileName,p_limit:1});
    expect(inventory.error).toBeNull();
    expect(inventory.data).toEqual([expect.objectContaining({username:profileName,owner_id:ordinaryId,published:false})]);
    expect((await ordinary.rpc("owner_profile_inventory_page",{p_query:profileName})).error?.code).toBe("42501");
    const noMfa=await owner.rpc("owner_grant_premium",{p_user:ordinaryId,p_plan:"studio",p_days:30,p_reason:"Security test grant"});
    expect(noMfa.error?.code).toBe("42501");
    const grantCount=sql("select count(*) from snoozer.admin_grant_records").toString();
    expect(grantCount).toContain("0");
    const http=await request.get("/owner/users");
    expect(http.url()).toContain("/sign-in");
  } finally {
    sql("delete from snoozer.platform_owners where owner_id='"+ownerId+"'");
    await admin.auth.admin.deleteUser(ownerId);
    await admin.auth.admin.deleteUser(ordinaryId);
  }
});

test("profile report intake, private queue and moderation enforcement are role-gated", async ({ page }) => {
  test.setTimeout(90000);
  const admin=createClient(project!,adminKey!,{auth:{persistSession:false}});
  const n="flagged-"+randomUUID().slice(0,8);
  const passwd=password;
  const emails=[n+"-target@example.com",n+"-reporter@example.com",n+"-owner@example.com"];
  const accounts=[] as string[];
  const sql=(statement:string)=>execFileSync("docker",["exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c",statement]).toString();
  for (const address of emails) {
    const result=await admin.auth.admin.createUser({email:address,password:passwd,email_confirm:true});
    expect(result.error).toBeNull();
    accounts.push(result.data.user!.id);
  }
  const [targetId,reporterId,ownerId]=accounts;
  const target=createClient(project!,publishableKey!,{auth:{persistSession:false}});
  const reporter=createClient(project!,publishableKey!,{auth:{persistSession:false}});
  const owner=createClient(project!,publishableKey!,{auth:{persistSession:false}});
  sql("insert into snoozer.platform_owners(owner_id) values ('"+ownerId+"')");
  try {
    expect((await target.auth.signInWithPassword({email:emails[0],password:passwd})).error).toBeNull();
    expect((await reporter.auth.signInWithPassword({email:emails[1],password:passwd})).error).toBeNull();
    const ownerLogin=await owner.auth.signInWithPassword({email:emails[2],password:passwd});
    expect(ownerLogin.error).toBeNull();
    const ownerSessionId=JSON.parse(Buffer.from(ownerLogin.data.session!.access_token.split(".")[1],"base64url").toString()).session_id as string;
    expect((await target.rpc("claim_profile",{p_name:n})).error).toBeNull();
    expect((await target.rpc("save_profile",{p_expected:0,p_name:"Reported profile",p_bio:"",
      p_theme:"midnight",p_indexable:false,p_links:[],p_publish:true,p_remove_avatar:false})).error).toBeNull();
    expect((await page.goto("/"+n))?.status()).toBe(200);
    const report=await reporter.rpc("submit_profile_report",{p_name:n,p_category:"phishing",p_reason:"Disposable test report for moderation"});
    expect(report.error).toBeNull();
    const reportId=report.data as string;
    expect(reportId).toMatch(/^[0-9a-f-]{36}$/);
    const duplicate=await reporter.rpc("submit_profile_report",{p_name:n,p_category:"spam",p_reason:"Second test report should fail"});
    expect(duplicate.error).toBeTruthy();
    expect((await reporter.rpc("owner_reports",{p_limit:10})).error?.code).toBe("42501");
    const queue=await owner.rpc("owner_reports",{p_limit:10});
    expect(queue.error).toBeNull();
    expect(queue.data).toEqual(expect.arrayContaining([expect.objectContaining({id:reportId,username:n})]));
    const noMfa=await owner.rpc("owner_triage_report",{p_report:reportId,p_reason:"Review disposable report"});
    expect(noMfa.error?.code).toBe("42501");
    // This privileged SQL test fixture simulates a verified AAL2 Owner session; real
    // browser actions must obtain AAL2 through Supabase Auth MFA, never form fields.
    const jwt=JSON.stringify({sub:ownerId,role:"authenticated",aal:"aal2",session_id:ownerSessionId});
    const command="begin; set local role authenticated; select set_config('request.jwt.claims', '"+jwt+"', true); "+
      "select set_config('request.jwt.claim.sub', '"+ownerId+"', true); "+
      "select public.owner_triage_report('"+reportId+"', 'Review disposable report'); commit;";
    sql(command);
    const cases=await owner.rpc("owner_cases",{p_limit:10});
    expect(cases.error).toBeNull();
    const linked=cases.data.find((c:{target_id:string})=>c.target_id===targetId);
    expect(linked?.id).toMatch(/^[0-9a-f-]{36}$/);
    sql("begin; set local role authenticated; select set_config('request.jwt.claims', '"+jwt+"', true); "+
      "select set_config('request.jwt.claim.sub', '"+ownerId+"', true); "+
      "select public.owner_block_profile('"+linked.id+"', 'Reported profile under review'); commit;");
    expect((await reporter.rpc("get_published_profile",{p_name:n})).data).toBeNull();
    expect((await reporter.rpc("resolve_public_address",{p_name:n})).data).toBeNull();
  } finally {
    sql("delete from snoozer.admin_audit_events where actor_id='"+ownerId+"' or target_id='"+targetId+"';"+
      " delete from snoozer.moderated_profiles where profile_id in (select id from snoozer.profiles where owner_id='"+targetId+"');"+
      " delete from snoozer.moderation_reports where reporter_id='"+reporterId+"';"+
      " delete from snoozer.moderation_cases where target_id='"+targetId+"';"+
      " delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
    for(const id of accounts) await admin.auth.admin.deleteUser(id);
  }
});

test("MFA-verified Owner revokes refresh sessions and blocks old access tokens", async () => {
 test.setTimeout(60000);
 const admin=createClient(project!,adminKey!,{auth:{persistSession:false}});
 const n="revoke-"+randomUUID().slice(0,9),emails=[n+"-owner@example.com",n+"-member@example.com"];
 const ids=[] as string[];
 const sql=(statement:string)=>execFileSync("docker",["exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c",statement]).toString();
 for(const email of emails){const x=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(x.error).toBeNull();ids.push(x.data.user!.id);}
 const [ownerId,memberId]=ids;
 const owner=createClient(project!,publishableKey!,{auth:{persistSession:false}});
 const member=createClient(project!,publishableKey!,{auth:{persistSession:false}});
 sql("insert into snoozer.platform_owners(owner_id) values ('"+ownerId+"')");
 try{
  const login=await owner.auth.signInWithPassword({email:emails[0],password});
  expect(login.error).toBeNull();
  const sessionId=JSON.parse(Buffer.from(login.data.session!.access_token.split(".")[1],"base64url").toString()).session_id as string;
  expect((await member.auth.signInWithPassword({email:emails[1],password})).error).toBeNull();
  expect((await member.rpc("get_my_plan")).error).toBeNull();
  expect((await owner.rpc("owner_revoke_sessions",{p_user:memberId,p_reason:"Disposable security check"})).error?.code).toBe("42501");
  const jwt=JSON.stringify({sub:ownerId,role:"authenticated",aal:"aal2",session_id:sessionId});
  const output=sql("begin; set local role authenticated; select set_config('request.jwt.claims', '"+jwt+"', true); "+
    "select set_config('request.jwt.claim.sub', '"+ownerId+"', true); "+
    "select public.owner_revoke_sessions('"+memberId+"','Disposable security check'); commit;");
  expect(output).toContain("owner_revoke_sessions");
  expect((await member.rpc("get_my_plan")).error?.code).toBe("42501");
 } finally {
  sql("delete from snoozer.admin_audit_events where actor_id='"+ownerId+"' or target_id='"+memberId+"';"+
    " delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
  for(const id of ids)await admin.auth.admin.deleteUser(id);
 }
});

test("privacy requests are owned, deduplicated and denied to anonymous or non-Owner sessions", async () => {
 const admin=createClient(project!,adminKey!,{auth:{persistSession:false}});
 const name="privacy-"+randomUUID().slice(0,10);
 const a=await admin.auth.admin.createUser({email:name+"a@example.com",password,email_confirm:true});
 const b=await admin.auth.admin.createUser({email:name+"b@example.com",password,email_confirm:true});
 expect(a.error).toBeNull();expect(b.error).toBeNull();
 const first=createClient(project!,publishableKey!,{auth:{persistSession:false}});
 const second=createClient(project!,publishableKey!,{auth:{persistSession:false}});
 const unauth=createClient(project!,publishableKey!,{auth:{persistSession:false}});
 expect((await first.auth.signInWithPassword({email:name+"a@example.com",password})).error).toBeNull();
 expect((await second.auth.signInWithPassword({email:name+"b@example.com",password})).error).toBeNull();
 const result=await first.rpc("request_my_privacy_action",{p_kind:"export"});
 expect(result.error).toBeNull();
 expect(result.data).toMatch(/^[a-f0-9-]{36}$/);
 const duplicate=await first.rpc("request_my_privacy_action",{p_kind:"export"});
 expect(duplicate.error).toBeNull();expect(duplicate.data).toBe(result.data);
 const mine=await first.rpc("my_privacy_requests");
 expect(mine.error).toBeNull();
 expect(mine.data).toEqual([expect.objectContaining({id:result.data,kind:"export",status:"open"})]);
 const theirs=await second.rpc("my_privacy_requests");
 expect(theirs.error).toBeNull();expect(theirs.data).toEqual([]);
 expect((await first.rpc("owner_privacy_requests")).error).not.toBeNull();
 expect((await first.rpc("owner_review_privacy_request",{
  p_request:result.data,p_status:"completed",p_response:"Fake review attempt"
 })).error).not.toBeNull();
 expect((await first.rpc("request_my_privacy_action",{p_kind:"wrong"})).error).not.toBeNull();
 expect((await unauth.rpc("request_my_privacy_action",{p_kind:"deletion"})).error).not.toBeNull();
 const notifications=await first.rpc("my_account_notifications");
 expect(notifications.error).toBeNull();expect(notifications.data).toEqual([]);
 expect((await first.rpc("mark_account_notification_read",{p_id:randomUUID()})).data).toBe(false);
 // Disposable local Supabase is destroyed after CI. Audit records intentionally
 // retain their actor IDs; deleting fixture Auth users would violate those FKs.
});

test("signup Auth hook rejects email and Discord only when registration disabled", async () => {
  // Exercise the actual database function inside a rolled-back transaction.
  // The Supabase Dashboard still must enable the Before User Created hook
  // before Auth itself invokes the function during user creation.
  const sql = `
  begin;
  select jsonb_build_object('enabled',
    public.snoozer_before_user_created('{"metadata":{"name":"before-user-created"},"user":{"id":"00000000-0000-4000-8000-000000000001","app_metadata":{"provider":"discord"}}}'::jsonb));
  update snoozer.platform_settings set value=false where name='registrations_enabled';
  select jsonb_build_object('discord',
    public.snoozer_before_user_created('{"metadata":{"name":"before-user-created"},"user":{"id":"00000000-0000-4000-8000-000000000001","app_metadata":{"provider":"discord"}}}'::jsonb),
    'email',
    public.snoozer_before_user_created('{"metadata":{"name":"before-user-created"},"user":{"id":"00000000-0000-4000-8000-000000000002","app_metadata":{"provider":"email"}}}'::jsonb));
  rollback;`;
  const output=execFileSync("docker",["exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At","-c",sql],{encoding:"utf8"});
  expect(output).toContain('"enabled": {}');
  expect(output).toMatch(/"discord".*"error"/);
  expect(output).toMatch(/"email".*"error"/);
  expect(output).toContain("ROLLBACK");
});

test("independent appeals require a verified email, one-time token and service permissions",async()=>{
 const admin=createClient(project!,adminKey!,{auth:{persistSession:false}});
 const suffix=randomUUID().slice(0,8);
 const email="external-"+suffix+"@example.com";
 const user=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(user.error).toBeNull();
 const target=user.data.user!.id;
 const caseId=randomUUID();
 const seed="insert into snoozer.moderation_cases(id,target_id,category,status,reason,opened_by) "+
   "values('"+caseId+"','"+target+"','other','actioned','Local fixture case for external appeal','"+target+"');";
 execFileSync("docker",["exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c",seed]);
 const token=randomUUID();
 const hash=createHash("sha256").update(token).digest("hex");
 const visitor=createClient(project!,publishableKey!,{auth:{persistSession:false}});
 const denied=await visitor.rpc("service_start_external_appeal",{p_case:caseId,p_email:email,p_hash:hash});
 expect(denied.error).not.toBeNull();
 const wrong=await admin.rpc("service_start_external_appeal",{p_case:caseId,p_email:"other@example.com",p_hash:hash});
 expect(wrong.error).toBeNull();expect(wrong.data).toBe(false);
 const start=await admin.rpc("service_start_external_appeal",{p_case:caseId,p_email:email,p_hash:hash});
 expect(start.error).toBeNull();expect(start.data).toBe(true);
 const duplicate=await admin.rpc("service_start_external_appeal",{p_case:caseId,p_email:email,p_hash:hash});
 expect(duplicate.error).toBeNull();expect(duplicate.data).toBe(false);
 expect((await visitor.rpc("service_submit_external_appeal",{p_hash:hash,p_reason:"A valid explanation that should never be accepted anonymously."})).error).not.toBeNull();
 const created=await admin.rpc("service_submit_external_appeal",{p_hash:hash,p_reason:"Please review this moderation case; I request an appeal."});
 expect(created.error).toBeNull();expect(created.data).toBe(true);
 const replay=await admin.rpc("service_submit_external_appeal",{p_hash:hash,p_reason:"This should not be accepted on replay."});
 expect(replay.error).toBeNull();expect(replay.data).toBe(false);
 expect((await visitor.rpc("owner_prepare_auth_ban",{
   p_user:target,p_case:caseId,p_operation:"ban",p_hours:24,p_reason:"Unapproved browser caller"
 })).error).not.toBeNull();
 // Existing account/provider Auth ban behavior is tested separately in staging.
});


