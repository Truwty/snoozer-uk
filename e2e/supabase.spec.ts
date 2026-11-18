import { checkLighthouse } from "./lighthouse";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import Stripe from "stripe";

const mailOrigin = "http://127.0.0.1:54324";
const password = randomUUID();
const newPassword = randomUUID();
const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const localEnabled = process.env.SNOOZER_TEST_LOCAL_SUPABASE === "1";

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

test.beforeEach(() => {
  if (!project || !["http://127.0.0.1:54321", "http://localhost:54321"].includes(project) || !publishableKey || !adminKey) {
    throw new Error("These tests require credentials for the disposable loopback stack only.");
  }
});

async function editorTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
}
async function linkMenu(page: Page, index: number) {
  await editorTab(page, "Links");
  const summary = page.getByLabel(`Actions for link ${index}`, { exact: true });
  if (!(await summary.evaluate((element) => element.parentElement?.hasAttribute("open")))) await summary.click();
}

test("profile analytics requires consent, counts published link clicks and exports only to its owner", async ({ page, browser }) => {
  test.setTimeout(90000);
  const name = "analytics-" + randomUUID().slice(0, 10);
  const email = name + "@example.com";
  const profileLinks = [
    { label: "Work", url: "https://example.com/" },
    { label: "Video", url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" },
    { label: "Repository", url: "https://github.com/snoozer-fixtures/public-example" },
    { label: "Community", url: "https://discord.gg/SnoozerFixture" },
    { label: "Stream", url: "https://www.twitch.tv/twitchdev" },
    { label: "Game", url: "https://www.roblox.com/games/1234567890/Fixture" },
  ];
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(account.error).toBeNull();
  const owner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000",
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" });
  await visitor.addInitScript(() => {
    try {
      localStorage.setItem("snoozer-analytics-consent", "yes");
      localStorage.setItem("snoozer-analytics-consent-v2", "yes");
    } catch { /* Some third-party frames block storage. */ }
  });
  try {
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    expect((await owner.rpc("claim_profile", { p_name: name })).error).toBeNull();
    expect((await owner.rpc("save_profile", { p_expected: 0, p_name: "Analytics fixture", p_bio: "",
      p_theme: "midnight", p_indexable: false, p_links: profileLinks,
      p_publish: true, p_remove_avatar: false })).error).toBeNull();
    const draft = await owner.rpc("get_draft");
    const id = draft.data.profile_id;
    // Provider responses are isolated, explicit fixtures in the disposable stack.
    // No GitHub or Discord credentials or network calls are needed in CI.
    const githubClaim = await admin.rpc("claim_public_widget", { p_provider: "github", p_resource: "snoozer-fixtures/public-example" });
    expect(githubClaim.data.state).toBe("refresh");
    expect((await admin.rpc("complete_public_widget", {
      p_provider: "github", p_resource: "snoozer-fixtures/public-example", p_lease: githubClaim.data.lease,
      p_payload: { version: 1, provider: "github", resource: "snoozer-fixtures/public-example", title: "Disposable repository fixture",
        description: "Public metadata test fixture", stats: [{ label: "Stars", value: 7 }, { label: "Forks", value: 2 }],
        fetchedAt: new Date().toISOString() }, p_retry_after: 0,
    })).data).toBe(true);
    const discordClaim = await admin.rpc("claim_public_widget", { p_provider: "discord", p_resource: "i:SnoozerFixture" });
    expect(discordClaim.data.state).toBe("refresh");
    expect((await admin.rpc("complete_public_widget", {
      p_provider: "discord", p_resource: "i:SnoozerFixture", p_lease: discordClaim.data.lease, p_payload: null, p_retry_after: 0,
    })).data).toBe(true);
    const read = async () => (await owner.rpc("get_my_profile_view_days", { p_profile: id })).data;
    const publicPage = await visitor.newPage();
    const events: string[] = [];
    publicPage.on("request", (req) => { if (req.url().endsWith("/api/v1/analytics/view")) events.push(req.postData() ?? ""); });
    await publicPage.goto("/" + name);
    await publicPage.getByText("Analytics preferences", { exact: true }).click();
    expect(await read()).toEqual([]);
    expect(events).toHaveLength(0);
    await publicPage.getByRole("button", { name: "Allow profile analytics", exact: true }).click();
    await expect.poll(read).toEqual([{ day: expect.any(String), views: 1, clicks: 0 }]);
    // Middle click leaves the source page open and exercises the real link handler.
    const popupPromise = visitor.waitForEvent("page");
    await publicPage.getByRole("link", { name: "Work" }).click({ button: "middle" });
    const popup = await popupPromise;
    await popup.close();
    await expect.poll(read).toEqual([{ day: expect.any(String), views: 1, clicks: 1 }]);
    const readBrowsers = async () => (await owner.rpc("get_my_profile_browser_days", { p_profile: id })).data;
    await expect.poll(readBrowsers).toEqual([{ day: expect.any(String), unique_browsers: 1, clicked_browsers: 1 }]);
    expect(JSON.parse(events[0])).toMatchObject({ version: 3, browser: expect.any(String), browserDay: expect.any(String) });
    await publicPage.getByRole("button", { name: "Turn off profile analytics" }).click();
    expect(await publicPage.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("snoozer-analytics-browser-v3:")))).toEqual([]);
    await publicPage.reload();
    await expect(publicPage.getByText("Analytics preferences", { exact: true })).toBeVisible();
    expect(events).toHaveLength(2);
    // No third-party frame or request before a separate, per-player opt-in.
    await expect(publicPage.locator("iframe")).toHaveCount(0);
    let embedRequests = 0;
    await publicPage.route("https://www.youtube-nocookie.com/**", (route) => { embedRequests++; return route.abort(); });
    await publicPage.getByRole("button", { name: "Load YouTube player" }).click();
    await expect(publicPage.getByTitle("YouTube: Video")).toHaveAttribute("referrerpolicy", "strict-origin");
    await expect.poll(() => embedRequests).toBe(1);
    await expect(publicPage.getByRole("link", { name: "Video", exact: false })).toHaveAttribute("href", "https://www.youtube.com/watch?v=M7lc1UVf-VE");
    await publicPage.getByRole("button", { name: "Hide YouTube player" }).click();
    await expect(publicPage.locator("iframe")).toHaveCount(0);
    expect(events).toHaveLength(2); // embed consent does not enable analytics
    expect((await visitor.request.get("/api/v1/analytics/export?profile=" + id)).status()).toBe(401);

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("link", { name: "Analytics", exact: true }).click();
    await page.getByText("Daily activity table", { exact: true }).click();
    await expect(page.getByRole("table", { name: "Recorded activity by UTC day within your plan’s retention window" })).toContainText("1");
    await expect(page.getByRole("table", { name: "Clicks attributed to published destinations" })).toContainText("Work");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download CSV" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("snoozer-analytics.csv");
    const linkDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download link CSV", exact: true }).click();
    expect((await linkDownload).suggestedFilename()).toBe("snoozer-link-analytics.csv");
    const linksCsv = await page.request.get("/api/v1/analytics/export?breakdown=links&profile=" + id);
    expect(linksCsv.status()).toBe(200);
    expect(await linksCsv.text()).toBe('label,url,clicks\r\n"Work","https://example.com/",1\r\n');
    const csv = await page.request.get("/api/v1/analytics/export?profile=" + id);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["cache-control"]).toBe("private, no-store");
    expect(await csv.text()).toMatch(/^date_utc,views,clicks\r\n\d{4}-\d{2}-\d{2},1,1\r\n$/);
    await expect(page.getByRole("table", { name: "Daily browser observations within your plan’s retention window" })).toContainText("100.0%");
    expect(await page.getByRole("region", { name: "Daily browser report", exact: true })
      .evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
    const browserDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download browser CSV", exact: true }).click();
    expect((await browserDownload).suggestedFilename()).toBe("snoozer-browser-analytics.csv");
    const browserCsv = await page.request.get("/api/v1/analytics/export?breakdown=browsers&profile=" + id);
    expect(browserCsv.status()).toBe(200);
    expect(await browserCsv.text()).toMatch(/^date_utc,daily_browsers,clicked_browsers,browser_ctr_percent\r\n\d{4}-\d{2}-\d{2},1,1,100.0\r\n$/);
    expect((await visitor.request.get("/api/v1/analytics/export?breakdown=browsers&profile=" + id)).status()).toBe(401);
    // A signed-in creator who opts in still must not count their own page.
    await page.goto("/" + name);
    await page.getByText("Analytics preferences", { exact: true }).click();
    const selfView = page.waitForResponse((r) => r.url().endsWith("/api/v1/analytics/view"));
    await page.getByRole("button", { name: "Allow profile analytics", exact: true }).click();
    expect((await selfView).status()).toBe(204);
    expect(await read()).toEqual([{ day: expect.any(String), views: 1, clicks: 1 }]);

    await page.goto("/studio/analytics?profile=" + id);
    await page.getByText("Campaign links (0/20)", { exact: true }).click();
    await page.getByLabel("Campaign name", { exact: true }).fill("Newsletter");
    await page.getByRole("button", { name: "Create campaign link", exact: true }).click();
    await expect(page.getByText("Campaign link ready.", { exact: true })).toBeVisible();
    const campaignUrl = new URL(await page.getByLabel("Campaign link: Newsletter", { exact: true }).inputValue());
    campaignUrl.searchParams.set("utm_source", "newsletter");
    const traffic = async () => (await owner.rpc("get_my_profile_traffic_totals", { p_profile: id })).data;
    await publicPage.goto(campaignUrl.href);
    await publicPage.getByText("Analytics preferences", { exact: true }).click();
    await publicPage.getByRole("button", { name: "Allow profile analytics", exact: true }).click();
    await expect.poll(traffic).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Newsletter", source: "email", device: "desktop", views: 1, clicks: 0 }),
    ]));
    await page.getByRole("button", { name: "Pause campaign", exact: true }).click();
    await expect.poll(async () => (await owner.rpc("get_my_analytics_campaigns", { p_profile: id })).data?.[0]?.active).toBe(false);
    await publicPage.reload();
    await expect.poll(traffic).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Newsletter", source: "email", views: 1 }),
      expect.objectContaining({ campaign: null, source: "email", views: 1 }),
    ]));
    await page.getByRole("button", { name: "Resume campaign", exact: true }).click();
    await expect.poll(async () => (await owner.rpc("get_my_analytics_campaigns", { p_profile: id })).data?.[0]?.active).toBe(true);
    await publicPage.reload();
    await expect.poll(traffic).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Newsletter", source: "email", views: 2 }),
    ]));
    // The first scope was withdrawn, so the new opt-in creates one new browser code.
    // Reloads while this scope remains allowed reuse it.
    await expect.poll(readBrowsers).toEqual([{ day: expect.any(String), unique_browsers: 2, clicked_browsers: 1 }]);
    await page.reload();
    await expect(page.getByRole("table", { name: "Campaign, source and device event totals" })).toContainText("Newsletter");
    const trafficDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download traffic CSV", exact: true }).click();
    expect((await trafficDownload).suggestedFilename()).toBe("snoozer-traffic-analytics.csv");
    const trafficCsv = await page.request.get("/api/v1/analytics/export?breakdown=traffic&profile=" + id);
    expect(trafficCsv.status()).toBe(200);
    expect(await trafficCsv.text()).toContain('"Newsletter",email,desktop,2,0');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await publicPage.getByRole("button", { name: "Load GitHub summary", exact: true }).click();
    await expect(publicPage.getByText("Disposable repository fixture", { exact: true })).toBeVisible();
    await expect(publicPage.getByText("Stars", { exact: true })).toBeVisible();
    await publicPage.getByRole("button", { name: "Hide GitHub summary", exact: true }).click();
    await expect(publicPage.getByText("Disposable repository fixture", { exact: true })).toHaveCount(0);
    await publicPage.getByRole("button", { name: "Load Discord summary", exact: true }).click();
    await expect(publicPage.getByText("Summary unavailable or temporarily rate limited. Use the original link above, or try again later.", { exact: true })).toBeVisible();
    await expect(publicPage.getByRole("link", { name: "Community", exact: true })).toHaveAttribute("href", "https://discord.gg/SnoozerFixture");
    await publicPage.route("https://player.twitch.tv/**", (route) => route.abort());
    await publicPage.getByRole("button", { name: "Load Twitch player", exact: true }).click();
    const stream = publicPage.getByTitle("Twitch: Stream");
    const embed = new URL((await stream.getAttribute("src"))!);
    expect(embed.searchParams.get("parent")).toBe("localhost");
    expect(embed.searchParams.get("autoplay")).toBe("false");
    expect(embed.searchParams.get("muted")).toBe("true");
    const box = (await stream.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(400);
    expect(box.height).toBeGreaterThanOrEqual(300);
    await publicPage.setViewportSize({ width: 375, height: 812 });
    await expect(stream).toHaveCount(0);
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await publicPage.getByRole("button", { name: "Hide Twitch player", exact: true }).click();
    await publicPage.setViewportSize({ width: 1280, height: 720 });
    await expect(stream).toHaveCount(0);
    await expect(publicPage.getByRole("link", { name: "Game · Roblox", exact: true })).toHaveAttribute("href", profileLinks[5].url);
    expect((await new AxeBuilder({ page: publicPage }).analyze()).violations).toEqual([]);
    expect((await owner.rpc("save_profile", { p_expected: 1, p_name: "Analytics fixture", p_bio: "", p_theme: "midnight",
      p_indexable: false, p_links: profileLinks.filter((item) => item.label !== "Repository"),
      p_publish: true, p_remove_avatar: false })).error).toBeNull();
    const revoked = await visitor.request.post("/api/v1/widgets/public", {
      headers: { Origin: "http://localhost:3000" }, data: { username: name, position: 3, provider: "github", consent: true },
    });
    expect(revoked.status()).toBe(400);
    expect(await revoked.text()).toBe("");
    await publicPage.reload();
    await expect(publicPage.getByRole("button", { name: "Load GitHub summary", exact: true })).toHaveCount(0);
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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Username").fill(name);
    await page.getByRole("button", { name: "Claim address" }).click();
    await page.getByRole("link", { name: "Plan and usage" }).click();
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
    const preview = page.getByRole("region", { name: "Page preview" });
    await expect(preview.getByText(`@${second}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByRole("link", { name: "View live page" })).toHaveAttribute("href", `/${second}`);
    expect((await request.get(`/${name}`)).status()).toBe(404);
    expect((await request.get(`/${second}`)).status()).toBe(200);
    await page.getByRole("link", { name: "Plan and usage" }).click();
    await page.getByRole("link", { name: `Edit @${name}`, exact: true }).click();
    await expect(preview.getByText(`@${name}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View live page" })).toHaveCount(0);
  } finally {
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  }
});

test("verify, publish, restore, reset, delete and clean up a profile", async ({ page, browser, request }) => {
  test.setTimeout(process.env.SNOOZER_TEST_LIGHTHOUSE === "1" ? 240000 : 90000);
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
    await expect(page.getByRole("heading", { name: "Studio", exact: true })).toBeVisible();
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
    await page.getByRole("link", { name: "Plan and usage" }).click();
    await expect(page.getByRole("heading", { name: "Plan and usage" })).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 20", { exact: true })).toBeVisible();
    await expect(page.getByText(`@${name} · Draft`, { exact: true })).toBeVisible();
    const editProfile = page.getByRole("link", { name: `Edit @${name}` });
    const profileHref = (await editProfile.getAttribute("href"))!;
    expect(profileHref).toMatch(/^\/studio\?profile=[a-f0-9-]{36}$/);
    await editProfile.click();
    await expect(page.getByRole("link", { name: "Image gallery" })).toHaveAttribute("href", profileHref.replace("/studio?", "/studio/gallery?"));
    await page.getByRole("link", { name: "Plan and usage" }).click();
    await page.getByText("Review a platform Ko-fi donation", { exact: true }).click();
    await page.getByLabel("Ko-fi transaction reference").fill("test-review-reference");
    await page.getByRole("button", { name: "Request donation review" }).click();
    await expect(page.getByText("Your review request is recorded.")).toBeVisible();
    await expect(page.getByText("test-review-reference · Pending review")).toBeVisible();
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
    await page.getByRole("link", { name: "Back to Studio" }).click();

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
    await page.goto("/studio");
    const stageAdmin = createClient(project!, adminKey!, { auth: { persistSession: false } });
    const { data: abandonedStage, error: stageError } = await stageAdmin.rpc("prepare_avatar_upload", {
      p_owner: stageLogin.data.user!.id, p_expected: 0, p_open: true,
    });
    expect(stageError).toBeNull();
    const abandonedPath = `${abandonedStage.scope}/${abandonedStage.key}`;
    const oldToken = await stageAdmin.storage.from("avatar-incoming").createSignedUploadUrl(abandonedPath);
    expect(oldToken.error).toBeNull();
    await page.getByText("Upload recovery", { exact: true }).click();
    await page.getByRole("button", { name: "Discard pending upload" }).click();
    await expect(page.getByRole("status")).toHaveText("Pending upload cleared.");
    expect((await stageOwner.storage.from("avatar-incoming").uploadToSignedUrl(
      abandonedPath, oldToken.data!.token, image, { contentType: "image/png" },
    )).error).toBeNull();
    await editorTab(page, "Profile");
    await page.getByRole("button", { name: /Upload avatar|Finish pending upload/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose an image to upload" })).toBeVisible();

    await editorTab(page, "Profile");
    await page.getByLabel("Choose an avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: image });
    await editorTab(page, "Profile");
    await page.getByRole("button", { name: /Upload avatar|Finish pending upload/ }).click();
    await expect(page.getByRole("status")).toContainText("Avatar saved");
    await page.goto("/templates");
    await page.locator('a[href="/studio?template=project-notebook"]').click();
    await expect(page.getByLabel("Preview a template")).toHaveValue("project-notebook");
    await editorTab(page, "Design");
    await page.getByLabel("Preview a template").selectOption("");

    await editorTab(page, "Profile");
    await page.getByLabel("Display name").fill("Snoozer Creator");
    await editorTab(page, "Profile");
    await page.getByLabel("Bio").fill("Private until I publish.");
    await editorTab(page, "Design");
    await page.getByRole("button", { name: "Lagoon", exact: true }).click();
    await editorTab(page, "Design");
    await page.getByText("Copy or paste appearance", { exact: true }).click();
    await expect(page.getByLabel("Current appearance code")).toHaveValue(/"theme":"lagoon"/);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy appearance", exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"theme":"lagoon"');
    await editorTab(page, "Design");
    await page.getByLabel("Paste an appearance code").fill('{"version":2}');
    await page.getByRole("button", { name: "Apply appearance" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a valid Snoozer appearance code." })).toBeVisible();
    await editorTab(page, "Design");
    await page.getByLabel("Paste an appearance code").fill(JSON.stringify({
      version: 1, theme: "daybreak",
      appearance: { density: "airy", corners: "round", layout: "editorial", accent: "rose" },
    }));
    await page.getByRole("button", { name: "Apply appearance" }).click();
    await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("daybreak");
    await expect(page.getByLabel("Card corners")).toHaveValue("round");
    await expect(page.getByLabel("Display name")).toHaveValue("Snoozer Creator");
    await page.getByRole("button", { name: "Undo edit" }).click();
    await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("lagoon");
    await expect(page.getByLabel("Card corners")).toHaveValue("soft");
    await editorTab(page, "Design");
    await page.getByText("Copy or paste appearance", { exact: true }).click();
    await editorTab(page, "Design");
    await page.getByLabel("Preview a template").selectOption("project-notebook");
    await expect(page.getByRole("heading", { name: "Current projects" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("lagoon");
    await editorTab(page, "Design");
    await page.getByRole("button", { name: "Apply with starter sections" }).click();
    await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("midnight");
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Current projects");
    await editorTab(page, "Sections");
    await page.getByLabel("Section 1 text").fill("First line.\nLiteral <em>markup</em>.");
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Move up (section 2)" }).press("Enter");
    await expect(page.getByLabel("Section 1 heading")).toBeFocused();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");
    await editorTab(page, "Design");
    await page.getByLabel("Preview a template").selectOption("field-guide");
    await expect(page.getByRole("button", { name: "Apply with starter sections" })).toHaveCount(0);
    await editorTab(page, "Design");
    await page.getByRole("button", { name: "Apply template colours" }).click();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");
    await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("lagoon");
    await editorTab(page, "Design");
    await page.getByLabel("Background entrance").selectOption("fade");
    await editorTab(page, "Design");
    await page.getByLabel("Link accent").selectOption("ink");
    await expect(page.locator("#link-accent-contrast")).toContainText("Link text contrast");
    await editorTab(page, "Design");
    await page.getByLabel("Profile layout").selectOption("editorial");
    await expect(page.getByRole("region", { name: "Page preview" })).toHaveAttribute("data-layout", "editorial");
    await editorTab(page, "Design");
    await page.getByLabel("Card spacing").selectOption("compact");
    await editorTab(page, "Design");
    await page.getByLabel("Card corners").selectOption("square");
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
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await expect(nextSection).toHaveAttribute("data-drop-target", "true");
    await page.mouse.up();
    await expect(page.getByLabel("Section 2 heading")).toHaveValue("Notes");
    await expect(page.getByLabel("Section 2 heading")).toBeFocused();
    await page.getByRole("button", { name: "Undo edit" }).click();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");
    await page.getByRole("button", { name: "Redo edit" }).click();
    await expect(page.getByLabel("Section 2 heading")).toHaveValue("Notes");
    for (const [index, label] of ["First", "Second"].entries()) {
      await editorTab(page, "Links");
      await page.getByRole("button", { name: "Add link" }).click();
      await editorTab(page, "Links");
      await page.getByLabel(`Link ${index + 1} label`).fill(label);
      await editorTab(page, "Links");
      await page.getByLabel(`Link ${index + 1} URL`).fill(`https://example.com/${label}`);
    }
    await linkMenu(page, 2);
    await page.getByRole("button", { name: "Move up (link 2)" }).press("Enter");
    expect(await page.getByLabel("Actions for link 2", { exact: true }).evaluate((element) => element.parentElement?.hasAttribute("open"))).toBe(false);
    await expect(page.getByLabel("Link 1 label")).toBeFocused();
    await expect(page.getByLabel("Link 1 label")).toHaveValue("Second");
    await page.getByRole("button", { name: "Undo edit" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toHaveValue("First");
    await page.getByRole("button", { name: "Redo edit" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toHaveValue("Second");

    await page.setViewportSize({ width: 390, height: 844 });
    const links = page.getByRole("group", { name: /^Links/ });
    const topLink = links.locator('[data-reorder-index="0"] .reorder-handle');
    const bottomLink = links.locator('[data-reorder-index="1"] .reorder-handle');
    await topLink.evaluate((handle) => handle.scrollIntoView({ block: "center" }));
    const topBox = (await topLink.boundingBox())!;
    const bottomBox = (await bottomLink.boundingBox())!;
    const touch = await page.context().newCDPSession(page);
    try {
      await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      const from = { x: bottomBox.x + 15, y: bottomBox.y + 20 };
      const to = { x: topBox.x + 15, y: topBox.y + 20 };
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
      for (let step = 1; step <= 8; step++) {
        const y = from.y + (to.y - from.y) * step / 8;
        await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: to.x, y }] });
      }
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      await touch.detach();
    }
    await expect(page.getByLabel("Link 1 label")).toHaveValue("First");
    await expect(page.getByLabel("Link 1 label")).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1100 });
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
    await page.getByText("Add Ko-fi support link", { exact: true }).click();
    await editorTab(page, "Links");
    await page.getByLabel("Ko-fi profile URL").fill("https://ko-fi.com.example.org/creator");
    await editorTab(page, "Links");
    await page.getByRole("button", { name: "Add support link" }).click();
    await expect(page.getByText("Enter your full Ko-fi profile address.")).toBeVisible();
    await editorTab(page, "Links");
    await page.getByLabel("Ko-fi profile URL").fill("https://www.ko-fi.com/creator/");
    await editorTab(page, "Links");
    await page.getByLabel("Ko-fi profile URL").press("Enter");
    await expect(page.getByLabel("Link 3 label")).toBeFocused();
    await editorTab(page, "Links");
    await page.getByLabel("Link 3 label").fill("Support my projects");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();

    const publicPage = await visitor.newPage();
    const unavailable = await publicPage.goto(`/${name}`);
    expect(unavailable?.status()).toBe(404);
    await expect(publicPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();

    await publicPage.goto(`/${name}`);
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();
    await expect(publicPage.locator(".profile-links li")).toHaveText(["First ↗", "Second ↗", "Support my projects · Ko-fi ↗"]);
    await expect(publicPage.getByRole("link", { name: "Support my projects · Ko-fi" })).toHaveAttribute("href", "https://ko-fi.com/creator");
    await expect(publicPage.locator(".profile-text-section h2")).toHaveText(["Current projects", "Notes", "Launch"]);
    await expect(publicPage.locator(".countdown time")).toHaveAttribute("datetime", "2096-02-29T18:15:00.000Z");
    await expect(publicPage.locator(".countdown time")).toContainText("18:15 UTC");
    await expect(publicPage.locator(".profile-card")).toHaveAttribute("data-layout", "editorial");
    await expect(publicPage.locator(".profile-links a").first()).toHaveCSS("background-color", "rgb(37, 52, 95)");
    await expect(publicPage.locator(".profile-links a").first()).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(publicPage.locator(".profile-card")).toHaveCSS("text-align", "start");
    await expect(publicPage.locator(".profile-inner")).toHaveCSS("grid-template-columns", /^88px [\d.]+px$/);
    await expect(publicPage.locator(".profile-card")).toHaveAttribute("data-density", "compact");
    await expect(publicPage.locator(".profile-card")).toHaveCSS("border-radius", "0px");
    await expect(publicPage.locator(".profile-callout h2")).toHaveText("Notes");
    await expect(publicPage.locator("blockquote")).toHaveText("Stay curious.");
    await expect(publicPage.locator("figcaption")).toHaveText("Studio notebook");
    await expect(publicPage.getByText("Literal <em>markup</em>.", { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(publicPage.locator(".profile-card")).toHaveAttribute("data-entrance", "fade");
    await expect(publicPage.locator(".profile-decoration")).toHaveCSS("animation-name", "profile-entrance");
    await publicPage.emulateMedia({ reducedMotion: "reduce" });
    await expect(publicPage.locator(".profile-decoration")).toHaveCSS("animation-name", "none");
    await expect(publicPage.locator(".profile-links a").first()).toHaveCSS("transition-duration", "0s");
    for (const [option, width] of [["narrow", 320], ["phone", 375]] as const) {
      await page.getByLabel("Preview width").selectOption(option);
      await publicPage.setViewportSize({ width, height: 850 });
      const measure = (card: Element) => ({
        width: card.getBoundingClientRect().width,
        fontSize: getComputedStyle(card.querySelector(".profile-inner > :is(h1,h2)")!).fontSize,
        gap: getComputedStyle(card.querySelector(".profile-inner")!).gap,
        radius: getComputedStyle(card).borderRadius,
        align: getComputedStyle(card).textAlign,
        columns: getComputedStyle(card.querySelector(".profile-inner")!).gridTemplateColumns.split(" ").length,
      });
      const studio = await page.getByRole("region", { name: "Page preview" }).evaluate(measure);
      const live = await publicPage.locator(".profile-card").evaluate(measure);
      expect(studio).toEqual(live);
      expect(live.columns).toBe(1);
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
    await page.getByLabel("Profile layout").selectOption("centred");
    await editorTab(page, "Design");
    await page.getByLabel("Link accent").selectOption("theme");
    await editorTab(page, "Design");
    await page.getByLabel("Card spacing").selectOption("airy");
    await editorTab(page, "Design");
    await page.getByLabel("Card corners").selectOption("round");
    await editorTab(page, "Sections");
    await page.getByRole("button", { name: "Remove section 3" }).click();
    await lock.uncheck();
    await page.getByRole("checkbox", { name: "Hide section 2 from public profile" }).check();
    await expect(preview.getByRole("heading", { name: "Notes" })).toHaveCount(0);
    await expect(publicPage.getByRole("heading", { name: "Notes" })).toBeVisible();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect.poll(async () => (await visitor.request.get(`/${name}`)).text()).toContain("Second publication");
    await page.getByRole("link", { name: "Publish history" }).click();
    await expect(page.getByRole("heading", { name: "Publish history" })).toBeVisible();
    const firstVersion = page.getByRole("listitem").filter({ hasText: "Snoozer Creator" });
    await firstVersion.getByRole("link", { name: /Preview version/ }).click();
    await expect(page.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();
    await page.getByRole("button", { name: "Restore to draft" }).click();
    await expect(page.getByRole("status")).toContainText("Version restored");
    await expect(page.getByLabel("Display name")).toHaveValue("Snoozer Creator");
    await expect(page.getByLabel("Section 2 heading")).toHaveValue("Notes");
    await expect(page.getByLabel("Profile layout")).toHaveValue("editorial");
    await expect(page.getByLabel("Link accent")).toHaveValue("ink");
    await expect(page.getByLabel("Card spacing")).toHaveValue("compact");
    await expect(page.getByLabel("Card corners")).toHaveValue("square");
    await editorTab(page, "Sections");
    await expect(page.getByRole("checkbox", { name: "Hide section 2 from public profile" })).not.toBeChecked();
    await expect(page.getByLabel("Section 2 type")).toHaveValue("callout");
    await expect(lock).toBeChecked();
    await expect(page.getByLabel("Section 2 heading")).toBeDisabled();
    await expect(page.getByLabel("Section 3 type")).toHaveValue("quote");
    await expect(page.getByLabel("Section 3 attribution")).toHaveValue("Studio notebook");
    await expect(page.getByLabel("Section 4 target time")).toHaveValue("2096-02-29T18:15");
    await publicPage.reload();
    await expect(publicPage.getByRole("heading", { name: "Second publication" })).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Notes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByText("Live · Up to date")).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();

    await editorTab(page, "Settings");
    await expect(page.locator("form form")).toHaveCount(0);
    await page.getByRole("button", { name: "Take page offline" }).click();
    await expect(page.getByText("Offline · Draft only")).toBeVisible();
    expect((await visitor.request.get(avatarPath!)).status()).toBe(404);
    await page.getByRole("button", { name: "Sign out" }).click();
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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Studio", exact: true })).toBeVisible();
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
    await expect(page.getByRole("status")).toContainText("Your profile was deleted");
    expect((await publicPage.goto(`/${name}`))?.status()).toBe(404);
    expect((await visitor.request.get(avatarPath!)).status()).toBe(404);
    expect((await ownerClient.rpc("claim_profile", { p_name: name })).error?.code).toBe("23505");

    const replacement = `new-${name}`;
    await page.getByLabel("Username").fill(replacement);
    await page.getByRole("button", { name: "Claim address" }).click();
    await expect(page.getByRole("heading", { name: "Studio", exact: true })).toBeVisible();
    const { data: newDraft } = await ownerClient.rpc("get_draft");
    const { data: newScope } = await ownerClient.rpc("draft_media_scope", { p_expected: newDraft.revision });
    expect(newScope).not.toBe(oldScope);
    expect((await ownerClient.storage.from("avatar-incoming").uploadToSignedUrl(
      `${oldScope}/pending`, lateUpload!.token, image, { contentType: "image/png" },
    )).error).toBeNull();
    expect((await incoming.upload(`${newScope}/pending`, image, { contentType: "image/png" })).error).toBeNull();

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

test("gallery images upload to private Storage and follow publication visibility", async ({ page, request }) => {
  test.setTimeout(90000);
  const ready = await request.get("/health/ready");
  expect(ready.status()).toBe(200);
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const name = "gallery-" + randomUUID().slice(0, 12);
  const email = name + "@example.com";
  expect((await admin.auth.admin.createUser({ email, password, email_confirm: true })).error).toBeNull();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username").fill(name);
  await page.getByRole("button", { name: "Claim address" }).click();
  await page.getByRole("link", { name: "Image gallery" }).click();
  await expect(page.getByRole("heading", { name: "Image gallery" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByLabel("Image description").fill("A disguised file");
  await page.getByLabel("Choose a gallery image").setInputFiles({
    name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("<svg/>"),
  });
  await page.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose a single JPEG, PNG or WebP" })).toBeVisible();
  await expect(page.getByRole("img", { name: "A disguised file" })).toHaveCount(0);

  const image = await sharp({ create: { width: 1280, height: 1280, channels: 3, background: "blue" } }).png().toBuffer();
  const dropZone = page.locator(".gallery-drop-zone");
  const makeDrop = (names: string[]) => page.evaluateHandle(({ bytes, names }) => {
    const transfer = new DataTransfer();
    for (const name of names) {
      transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "image/png" }));
    }
    return transfer;
  }, { bytes: Array.from(image), names });
  const multiple = await makeDrop(["one.png", "two.png"]);
  await dropZone.dispatchEvent("drop", { dataTransfer: multiple });
  await expect(page.getByRole("alert").filter({ hasText: "Drop one image at a time." })).toBeVisible();
  await multiple.dispose();
  const single = await makeDrop(["shoreline.png"]);
  await dropZone.dispatchEvent("drop", { dataTransfer: single });
  await single.dispose();
  await expect(dropZone).toContainText("Selected image: shoreline.png");
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toHaveCount(0);
  await page.getByLabel("Image description").fill("Blue shoreline");
  await page.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toBeVisible();

  await page.getByLabel("Image description").fill("Open water");
  await page.getByLabel("Choose a gallery image").setInputFiles({ name: "gallery.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByRole("status")).toContainText("Image added to your draft");
  await expect(page.getByRole("img", { name: "Open water" })).toBeVisible();
  const privatePath = (await page.getByRole("img", { name: "Blue shoreline" }).getAttribute("src"))!;
  const publicPath = "/media/gallery/" + name + "/" + privatePath.split("/").at(-1);
  expect((await page.request.get(privatePath)).headers()["content-type"]).toBe("image/webp");
  expect((await request.get(privatePath)).status()).toBe(404);
  expect((await request.get(publicPath)).status()).toBe(404);

  await page.goto("/studio/plan");
  await expect(page.getByText("Media storage", { exact: true }).locator("..").locator("dd")).toHaveText(/^[1-9]\d* B of 100 MB$|^[\d.]+ MB of 100 MB$/);
  await expect(page.getByText("0 MB of 100 MB", { exact: true })).toHaveCount(0);
  await page.goto("/studio/gallery");

  await page.getByRole("group", { name: "Actions for Open water" }).getByRole("button", { name: "Move earlier" }).click();
  await expect(page.getByRole("img").first()).toHaveAttribute("alt", "Open water");
  await page.getByRole("link", { name: "Back to Studio" }).click();
  await expect(page.getByRole("region", { name: "Gallery may use more memory on phones" })).toContainText("12.5 MiB");
  await expect(page.getByRole("link", { name: "Manage gallery images" })).toHaveAttribute("href", "/studio/gallery");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();
  const liveImage = await request.get(publicPath);
  expect(liveImage.status()).toBe(200);
  expect(liveImage.headers()["content-type"]).toBe("image/webp");
  const html = await (await request.get("/" + name)).text();
  expect(html.indexOf('alt="Open water"')).toBeLessThan(html.indexOf('alt="Blue shoreline"'));
  expect(html).toContain('alt="Open water"');
  expect(html).not.toContain("Gallery may use more memory");

  await page.goto("/studio/gallery/folders");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("heading", { name: "Media folders" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("New folder name").fill("Private portfolio");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Folder created." })).toBeVisible();
  await page.getByLabel("Folder for Blue shoreline").selectOption({ label: "Private portfolio" });
  await page.getByRole("listitem").filter({ has: page.getByRole("img", { name: "Blue shoreline" }) })
    .getByRole("button", { name: "Save location" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Image location saved." })).toBeVisible();
  await page.reload();
  await page.getByLabel("Show images in").selectOption({ label: "Private portfolio" });
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Open water" })).toHaveCount(0);
  await page.getByText("Manage Private portfolio", { exact: true }).click();
  await page.getByLabel("Folder name", { exact: true }).fill("Private archive");
  await page.getByRole("button", { name: "Rename folder" }).click();
  await expect(page.getByRole("heading", { name: "Private archive" })).toBeVisible();
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(page.getByRole("heading", { name: "Unfiled" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toBeVisible();
  const afterFolders = await (await request.get("/" + name)).text();
  expect(afterFolders).not.toContain("Private portfolio");
  expect(afterFolders).not.toContain("Private archive");
  expect(afterFolders.indexOf('alt="Open water"')).toBeLessThan(afterFolders.indexOf('alt="Blue shoreline"'));

  await page.goto("/studio/gallery");
  await page.getByRole("group", { name: "Actions for Blue shoreline" }).getByRole("button", { name: "Remove from draft" }).click();
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toHaveCount(0);
  expect((await request.get(publicPath)).status()).toBe(200);
  await page.getByRole("link", { name: "Back to Studio" }).click();
  await expect(page.getByRole("region", { name: "Gallery may use more memory on phones" })).toHaveCount(0);
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect.poll(async () => (await request.get(publicPath)).status()).toBe(404);
  expect((await page.request.get(privatePath)).status()).toBe(200);
  await page.goto("/studio/gallery/folders");
  const retained = page.getByRole("listitem").filter({ has: page.getByRole("img", { name: "Blue shoreline" }) });
  await expect(retained.getByText("In publish history")).toBeVisible();
  await retained.getByRole("button", { name: "Add to draft gallery" }).click();
  await expect(retained.getByText("In your draft")).toBeVisible();
  expect((await request.get(publicPath)).status()).toBe(404);
  await page.getByRole("link", { name: "Back to image gallery" }).click();
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Studio" }).click();
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect.poll(async () => (await request.get(publicPath)).status()).toBe(200);

  // The Studio preview also contains this image, but uses the owner-only URL.
  await page.goto("/" + name);
  const openWater = page.getByRole("img", { name: "Open water" });
  await expect(openWater).toHaveAttribute("src", /^\/media\/gallery\//);
  const openWaterPath = (await openWater.getAttribute("src"))!;
  const openWaterId = openWaterPath.split("/").at(-1)!;
  expect((await request.get(openWaterPath)).status()).toBe(200);
  const takedown = execFileSync(process.execPath, [
    "scripts/take-down-gallery-image.mjs", name, openWaterId, "TEST-GALLERY-001",
  ], { encoding: "utf8", timeout: 12000 });
  expect(takedown).toContain("Image blocked");
  expect((await request.get(openWaterPath)).status()).toBe(404);
  expect((await page.request.get("/studio/gallery/image/" + openWaterId)).status()).toBe(404);
  await page.reload();
  await expect(page.getByRole("img", { name: "Open water" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username").fill(name);
  await page.getByRole("button", { name: "Claim address" }).click();
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();

  const stale = await page.context().newPage();
  await stale.goto("/studio");
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
  await stale.route("**/studio", async (route) => {
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
