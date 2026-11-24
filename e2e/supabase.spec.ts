import { checkLighthouse } from "./lighthouse";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { createHash, randomUUID } from "node:crypto";
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

async function enterPublicBio(page: Page, openMore = true) {
  const entrance = page.getByRole("button", { name: /Click to enter/ });
  const disclosure = page.locator(".profile-entry-shell");
  await expect(entrance).toBeVisible();
  await expect(entrance).toBeEnabled();
  await entrance.click();
  await expect(disclosure).toHaveJSProperty("open", true);
  await expect(page.locator(".profile-card")).toBeVisible();
  await expect(page.locator(".profile-card")).not.toHaveAttribute("aria-hidden", "true");
  await expect(entrance).toBeHidden();
  if (openMore) {
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
  const githubResource = `snoozer-fixtures/${name}`;
  const discordInvite = name;
  const discordResource = `i:${discordInvite}`;
  const profileLinks = [
    { label: "Work", url: "https://example.com/" },
    { label: "Video", url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" },
    { label: "Repository", url: `https://github.com/${githubResource}` },
    { label: "Community", url: `https://discord.gg/${discordInvite}` },
    { label: "Stream", url: "https://www.twitch.tv/twitchdev" },
    { label: "Game", url: "https://www.roblox.com/games/1234567890/Fixture" },
    { label: "Playlist", url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=not-published-in-embed" },
  ];
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(account.error).toBeNull();
  const owner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
  // Set initial consent once. addInitScript would overwrite the visitor's
  // later opt-in on every navigation and break campaign reload assertions.
  const visitor = await browser.newContext({
    baseURL: "http://localhost:3000",
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
    storageState: {
      cookies: [],
      origins: [{
        origin: "http://localhost:3000",
        localStorage: [{ name: "snoozer-analytics-consent-v3", value: "no" }],
      }],
    },
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
    const githubClaim = await admin.rpc("claim_public_widget", {
      p_provider: "github", p_resource: githubResource,
    });
    expect(githubClaim.error).toBeNull();
    expect(githubClaim.data.state).toBe("refresh");

    const githubComplete = await admin.rpc("complete_public_widget", {
      p_provider: "github", p_resource: githubResource, p_lease: githubClaim.data.lease,
      p_payload: {
        version: 1, provider: "github", resource: githubResource,
        title: "Disposable repository fixture", description: "Public metadata test fixture",
        stats: [{ label: "Stars", value: 7 }, { label: "Forks", value: 2 }],
        fetchedAt: new Date().toISOString(),
      },
      p_retry_after: 0,
    });
    expect(githubComplete.error).toBeNull();
    expect(githubComplete.data).toBe(true);

    const discordClaim = await admin.rpc("claim_public_widget", {
      p_provider: "discord", p_resource: discordResource,
    });
    expect(discordClaim.error).toBeNull();
    expect(discordClaim.data.state).toBe("refresh");

    const discordComplete = await admin.rpc("complete_public_widget", {
      p_provider: "discord", p_resource: discordResource,
      p_lease: discordClaim.data.lease, p_payload: null, p_retry_after: 0,
    });
    expect(discordComplete.error).toBeNull();
    expect(discordComplete.data).toBe(true);
    const read = async () => (await owner.rpc("get_my_profile_view_days", { p_profile: id })).data;
    const publicPage = await visitor.newPage();
    let spotifyRequests = 0;
    // Intercept automatically loaded Spotify iframes before first navigation:
    // the test must never depend on Spotify's network or logged-in state.
    await publicPage.route("https://open.spotify.com/embed/**", (route) => {
      spotifyRequests++;
      return route.abort();
    });
    const events: string[] = [];
    publicPage.on("request", (req) => { if (req.url().endsWith("/api/v1/analytics/view")) events.push(req.postData() ?? ""); });
    await publicPage.goto("/" + name);
    await enterPublicBio(publicPage);
    await expect(publicPage.locator(".discord-presence-card")).toHaveCount(0);
    expect((await visitor.request.get("/api/v1/discord/presence?username=" + name)).status()).toBe(404);
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
    await enterPublicBio(publicPage);
    await expect(publicPage.getByText("Analytics preferences", { exact: true })).toBeVisible();
    expect(events).toHaveLength(2);
    // Spotify is a visible native iframe, while YouTube still waits for opt-in.
    const spotify = publicPage.getByTitle("Spotify: Playlist");
    await expect(spotify).toHaveCount(1);
    await expect(publicPage.locator("iframe")).toHaveCount(1);
    await expect(publicPage.getByRole("button", { name: /Load Spotify player|Hide Spotify player/ })).toHaveCount(0);
    await expect(publicPage.getByText("Learn more about Spotify privacy")).toHaveCount(0);
    let embedRequests = 0;
    await publicPage.route("https://www.youtube-nocookie.com/**", (route) => { embedRequests++; return route.abort(); });
    await publicPage.getByRole("button", { name: "Load YouTube player" }).click();
    await expect(publicPage.getByTitle("YouTube: Video")).toHaveAttribute("referrerpolicy", "strict-origin");
    await expect.poll(() => embedRequests).toBe(1);
    await expect(publicPage.getByRole("link", { name: "Video", exact: false })).toHaveAttribute("href", "https://www.youtube.com/watch?v=M7lc1UVf-VE");
    await publicPage.getByRole("button", { name: "Hide YouTube player" }).click();
    await expect(publicPage.locator("iframe")).toHaveCount(1);
    // The compact themed card replaces the former duplicate link and the
    // Spotify player renders automatically, independent of analytics consent.
    await expect(spotify).toHaveAttribute("src", "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M");
    await expect(spotify).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(spotify).toHaveAttribute("height", "352");
    await expect(publicPage.locator(".spotify-widget__brand")).toContainText("Spotify");
    await expect(publicPage.locator(".spotify-widget__open")).toHaveAttribute("href",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
    await expect(publicPage.locator(".spotify-link-slot > a")).toHaveCount(0);
    await spotify.scrollIntoViewIfNeeded();
    await expect.poll(() => spotifyRequests).toBeGreaterThan(0);
    expect(events).toHaveLength(2); // displaying a Spotify player does not enable Snoozer analytics
    expect((await visitor.request.get("/api/v1/analytics/export?profile=" + id)).status()).toBe(401);

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    // Wait for the server action to finish and persist the account session before navigating.
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/studio/discord");
    await expect(page.getByRole("heading", { name: "Discord Presence" })).toBeVisible();
    await expect(page.getByText("Discord account not connected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Discord" })).toBeEnabled();
    await expect(page.getByRole("checkbox", { name: /Show Discord Presence on this profile/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Custom status/ })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: /I meet Discord’s minimum age requirement/ })).not.toBeChecked();
    await page.getByRole("link", { name: "Back to Page Builder" }).click();
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
    await enterPublicBio(page);
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
    await enterPublicBio(publicPage);
    await publicPage.getByText("Analytics preferences", { exact: true }).click();
    await publicPage.getByRole("button", { name: "Allow profile analytics", exact: true }).click();
    await expect.poll(traffic).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Newsletter", source: "email", device: "desktop", views: 1, clicks: 0 }),
    ]));
    await page.getByRole("button", { name: "Pause campaign", exact: true }).click();
    await expect.poll(async () => (await owner.rpc("get_my_analytics_campaigns", { p_profile: id })).data?.[0]?.active).toBe(false);
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect.poll(traffic).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Newsletter", source: "email", views: 1 }),
      expect.objectContaining({ campaign: null, source: "email", views: 1 }),
    ]));
    await page.getByRole("button", { name: "Resume campaign", exact: true }).click();
    await expect.poll(async () => (await owner.rpc("get_my_analytics_campaigns", { p_profile: id })).data?.[0]?.active).toBe(true);
    await publicPage.reload();
    await enterPublicBio(publicPage);
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
    await expect(publicPage.getByRole("link", { name: "Community", exact: true })).toHaveAttribute("href", `https://discord.gg/${discordInvite}`);
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
    await enterPublicBio(publicPage);
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
    await page.getByRole("link", { name: "Premium & Usage" }).click();
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
    const selectedProfile = new URL(page.url()).searchParams.get("profile");
    expect(selectedProfile).toMatch(/^[0-9a-f-]{36}$/);
    await page.getByRole("link", { name: "Customize", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/studio/customize\\?profile=" + selectedProfile));
    await page.getByRole("link", { name: "Page Builder", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/studio/builder\\?profile=" + selectedProfile));
    await page.getByRole("link", { name: "Templates", exact: true }).click();
    await expect(page.getByRole("link", { name: "Use this template", exact: true }).first())
      .toHaveAttribute("href", new RegExp("^/studio/builder\\?template=.*&profile=" + selectedProfile));
    await page.goto("/studio/builder?profile=" + selectedProfile);
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByRole("link", { name: "View live page" })).toHaveAttribute("href", `/${second}`);
    expect((await request.get(`/${name}`)).status()).toBe(404);
    expect((await request.get(`/${second}`)).status()).toBe(200);
    await page.getByRole("link", { name: "Premium & Usage" }).click();
    await page.getByRole("link", { name: `Edit @${name}`, exact: true }).click();
    await expect(preview.getByText(`@${name}`, { exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Username").fill(name);
    await page.getByRole("button", { name: "Claim address", exact: true }).click();
    await editorTab(page, "Settings");
    await expect(page.getByLabel("Domain hostname", { exact: true })).toBeDisabled();
    await page.getByRole("link", { name: "Premium & Usage", exact: true }).click();
    const gift = await admin.rpc("issue_gift_code", { p_plan: "plus", p_version: 1, p_duration_days: 1, p_redeem_by: new Date(Date.now()+3600000).toISOString() }).single<{ code: string }>();
    expect(gift.error).toBeNull();
    await page.getByText("Redeem a plan gift", { exact: true }).click();
    await page.getByLabel("Gift code", { exact: true }).fill(gift.data!.code);
    await page.getByRole("button", { name: "Redeem gift code", exact: true }).click();
    await page.getByRole("link", { name: "Back to Page Builder", exact: true }).click();
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
    await page.getByRole("link", { name: "Referral choices and Growth", exact: true }).click();
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

test("portfolio projects persist, publish and restore with responsive public rendering", async ({ page, browser }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const name = `portfolio-${randomUUID().slice(0, 8)}`;
  const email = `${name}@example.com`;
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(error).toBeNull();
  let scheduledProfileId = "";
  const visitor = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://localhost:3000" });
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Username").fill(name);
    await page.getByRole("button", { name: "Claim address" }).click();
    await page.getByLabel("Display name").fill("Portfolio first publication");
    await editorTab(page, "Sections");
    for (const index of [1, 2]) {
      await page.getByRole("button", { name: "Add text section", exact: true }).click();
      await page.getByRole("combobox", { name: `Section ${index} type`, exact: true }).selectOption("project");
      await page.getByLabel(`Section ${index} heading`, { exact: true }).fill(`Project ${index}`);
      await page.getByLabel(`Section ${index} text`, { exact: true }).fill(`The story behind project ${index}.`);
      await page.getByLabel(`Section ${index} project URL`, { exact: true }).fill(`https://example.com/project-${index}`);
    }
    await editorTab(page, "Design");
    await expect(page.getByRole("button", { name: "Portfolio grid", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Portfolio grid", exact: true }).click();
    await page.getByRole("combobox", { name: "Background entrance", exact: true }).selectOption("rise");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Draft saved.");
    await page.reload();
    await editorTab(page, "Sections");
    await expect(page.getByLabel("Section 1 project URL", { exact: true })).toHaveValue("https://example.com/project-1");
    expect((await visitor.request.get(`/${name}`)).status()).toBe(404);
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    const publicPage = await visitor.newPage();
    await publicPage.goto(`/${name}`);
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("link", { name: "Explore Project 1" })).toHaveAttribute("href", "https://example.com/project-1");
    await editorTab(page, "Settings");
    await page.getByLabel("SEO title", { exact: true }).fill("Custom portfolio title");
    await page.getByLabel("SEO description", { exact: true }).fill("Custom portfolio description");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Draft saved.");
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage).toHaveTitle("Portfolio first publication · Snoozer");
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Publishing custom SEO metadata" })).toContainText("requires Plus or higher");
    await page.getByRole("link", { name: "Premium & Usage", exact: true }).click();
    const gift = await admin.rpc("issue_gift_code", { p_plan: "plus", p_version: 1, p_duration_days: 1, p_redeem_by: new Date(Date.now() + 3600000).toISOString() }).single<{ code: string }>();
    expect(gift.error).toBeNull();
    await page.getByText("Redeem a plan gift", { exact: true }).click();
    await page.getByLabel("Gift code", { exact: true }).fill(gift.data!.code);
    await page.getByRole("button", { name: "Redeem gift code", exact: true }).click();
    await expect(page.getByText("Plus", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Back to Page Builder", exact: true }).click();
    await page.getByLabel("Display name").fill("Portfolio SEO publication");
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage).toHaveTitle("Custom portfolio title · Snoozer");
    await expect(publicPage.locator('meta[name="description"]')).toHaveAttribute("content", "Custom portfolio description");
    await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    const social = await test.step("Generate the published social card", () => visitor.request.get(`/media/profile-card/${name}`, { timeout: 15000 }));
    expect(social.status()).toBe(200);
    expect(social.headers()["content-type"]).toContain("image/png");
    expect((await social.body()).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect((await visitor.request.get("/media/profile-card/unclaimed-profile")).status()).toBe(404);
    await editorTab(page, "Settings");
    const alias = name + "-alt";
    await page.getByLabel("New alias", { exact: true }).fill(alias);
    await page.getByRole("button", { name: "Claim alias", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alias saved for 90 days." })).toBeVisible();
    const redirected = await visitor.request.get(`/${alias}?campaign=qa-code`, { maxRedirects: 0 });
    expect(redirected.status()).toBe(307);
    expect(redirected.headers().location).toContain(`/${name}?campaign=qa-code`);
    expect(redirected.headers()["cache-control"]).toContain("no-store");
    await page.getByRole("button", { name: `Renew @${alias} for 90 days`, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alias saved for 90 days." })).toBeVisible();
    await page.getByText(`Retire @${alias}`, { exact: true }).click();
    await page.getByRole("button", { name: `Retire @${alias} permanently`, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alias retired." })).toBeVisible();
    expect((await visitor.request.get(`/${alias}`, { maxRedirects: 0 })).status()).toBe(404);
    const competitorEmail = `${name}-race@example.com`;
    const competitor = await admin.auth.admin.createUser({ email: competitorEmail, password, email_confirm: true });
    expect(competitor.error).toBeNull();
    try {
      const ownerClient = createClient(project!, publishableKey!, { auth: { persistSession: false } });
      const otherClient = createClient(project!, publishableKey!, { auth: { persistSession: false } });
      expect((await ownerClient.auth.signInWithPassword({ email, password })).error).toBeNull();
      expect((await otherClient.auth.signInWithPassword({ email: competitorEmail, password })).error).toBeNull();
      const ownerDraft = await ownerClient.rpc("get_draft");
      expect(ownerDraft.error).toBeNull();
      expect(ownerDraft.data.profile_id).toMatch(/^[0-9a-f-]{36}$/);
      scheduledProfileId = ownerDraft.data.profile_id;
      const collision = name + "-race";
      const results = await Promise.all([
        ownerClient.rpc("manage_profile_alias", { p_profile: ownerDraft.data.profile_id, p_name: collision, p_operation: "create" }),
        otherClient.rpc("claim_profile", { p_name: collision }),
      ]);
      expect(results.filter((result) => !result.error)).toHaveLength(1);
      expect(results.filter((result) => result.error).map((result) => result.error!.code)).toEqual(["23505"]);
    } finally { if (competitor.data.user) await admin.auth.admin.deleteUser(competitor.data.user.id); }
    await editorTab(page, "Sections");
    for (const width of [360, 1280]) {
      await publicPage.setViewportSize({ width, height: 850 });
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const columns = await publicPage.locator(".profile-sections").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(width === 360 ? 1 : 2);
    }
    await publicPage.emulateMedia({ reducedMotion: "reduce" });
    expect(await publicPage.locator(".profile-decoration").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await publicPage.emulateMedia({ reducedMotion: "no-preference" });
    expect(await publicPage.locator(".profile-decoration").evaluate((element) => getComputedStyle(element).animationName)).toBe("profile-rise");
    // Keep the no-JavaScript rendering checks; axe itself needs script execution.
    const accessiblePage = await page.context().newPage();
    await accessiblePage.goto(publicPage.url());
    expect((await new AxeBuilder({ page: accessiblePage }).analyze()).violations).toEqual([]);
    await accessiblePage.close();
    await page.getByLabel("Section 1 project URL", { exact: true }).fill("https://example.com/updated");
    await editorTab(page, "Profile");
    await page.getByLabel("Display name").fill("Portfolio second publication");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Draft saved.");
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("link", { name: "Explore Project 1" })).toHaveAttribute("href", "https://example.com/project-1");
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Publish History", exact: true }).click();
    await page.getByRole("listitem").filter({ hasText: "Portfolio first publication" }).getByRole("link", { name: /Preview version/ }).click();
    await page.getByRole("button", { name: "Restore to draft", exact: true }).click();
    await editorTab(page, "Sections");
    await expect(page.getByLabel("Section 1 project URL", { exact: true })).toHaveValue("https://example.com/project-1");
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Portfolio second publication", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Portfolio first publication", exact: true })).toBeVisible();
    await expect(publicPage.getByRole("link", { name: "Explore Project 1" })).toHaveAttribute("href", "https://example.com/project-1");
    await editorTab(page, "Profile");
    await page.getByLabel("Display name").fill("Scheduled future version");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toBeVisible();
    await editorTab(page, "Settings");
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    await page.getByLabel("Publish at (UTC)", { exact: true }).fill(future);
    await page.getByRole("button", { name: "Schedule saved draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved version scheduled." })).toBeVisible();
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Portfolio first publication", exact: true })).toBeVisible();
    await editorTab(page, "Profile");
    await page.getByLabel("Display name").fill("Draft after scheduling");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toBeVisible();
    // Only this disposable fixture's due time changes; production code never accepts a simulated clock.
    execFileSync("docker", ["exec", "supabase_db_snoozer-uk", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `update snoozer.publication_schedules set run_at=now()-interval '1 second' where profile_id='${scheduledProfileId}'`]);
    await editorTab(page, "Settings");
    await page.getByRole("button", { name: "Check due publication", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Scheduled version is now live." })).toBeVisible();
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Scheduled future version", exact: true })).toBeVisible();
    await editorTab(page, "Profile");
    await expect(page.getByLabel("Display name")).toHaveValue("Draft after scheduling");
    await editorTab(page, "Settings");
    await page.getByLabel("Publish at (UTC)", { exact: true }).fill(future);
    await page.getByRole("button", { name: "Schedule saved draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved version scheduled." })).toBeVisible();
    await page.getByRole("button", { name: "Cancel scheduled publication", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Schedule cancelled." })).toBeVisible();
    await expect(page.locator("form form")).toHaveCount(0);
  } finally {
    // The browser fixture closes visitor contexts even when a timed-out test has already closed them.
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  }
});

test("Studio builder adds, reorders, saves and publishes blocks across desktop and mobile layouts", async ({ page }) => {
  test.setTimeout(120000);
  const name = `builder-${randomUUID().slice(0, 8)}`;
  const email = `${name}@example.com`;
  const admin = createClient(project!, adminKey!, { auth: { persistSession: false } });
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(account.error).toBeNull();
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Claim address", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Account overview", exact: true })).toBeVisible();
    await page.goto("/studio/builder");
    await expect(page.getByRole("heading", { name: "Page Builder", exact: true })).toBeVisible();

    const workspace = page.locator("main.studio-shell");
    for (const width of [1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await workspace.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(900);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `Studio at ${width}px`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Add to page", exact: true })).toBeVisible();
    await expect(page.locator(".block-library-item")).toHaveCount(18);
    await expect(page.locator(".block-library-item").filter({ hasText: "Add a styled native callout" })).toBeVisible();
    await expect(page.locator(".block-library-item").filter({ hasText: "Add a styled quotation" })).toBeVisible();

    await page.locator(".block-library-item").filter({ hasText: "Text" }).click();
    await editorTab(page, "Sections");
    await expect(page.getByLabel("Section 1 heading", { exact: true })).toHaveValue("New section");

    await page.locator(".block-library-item").filter({ hasText: "Highlight an update" }).dragTo(page.locator(".preview"));
    await editorTab(page, "Sections");
    await expect(page.locator('[data-reorder-index="1"] select')).toHaveValue("callout");

    await page.locator(".block-library-item").filter({ hasText: "FAQ" }).dragTo(page.locator(".preview"));
    await editorTab(page, "Widgets");
    await expect(page.getByLabel("Enable FAQ", { exact: true })).toBeChecked();

    await page.locator(".block-library-item").filter({ hasText: "Guestbook" }).click();
    await editorTab(page, "Widgets");
    await expect(page.getByLabel("Enable Guestbook", { exact: true })).toBeChecked();

    const blocks = page.locator(".preview-card .profile-layout-block");
    await expect(blocks).toHaveCount(3);
    await expect(blocks.nth(0)).toHaveAttribute("data-layout-type", "section");
    await expect(blocks.nth(2)).toHaveAttribute("data-layout-type", "widgets");
    await blocks.nth(2).locator(".profile-layout-drag-handle").dragTo(blocks.nth(0));
    await expect(blocks.nth(0)).toHaveAttribute("data-layout-type", "widgets");
    await expect(blocks.nth(1)).toHaveAttribute("data-layout-type", "section");

    await blocks.nth(0).getByRole("button", { name: "Move Interactive widgets down" }).press("Enter");
    await expect(blocks.nth(0)).toHaveAttribute("data-layout-type", "section");
    await expect(blocks.nth(1)).toHaveAttribute("data-layout-type", "widgets");
    await blocks.nth(1).getByRole("button", { name: "Move Interactive widgets up" }).press("Enter");
    await expect(blocks.nth(0)).toHaveAttribute("data-layout-type", "widgets");
    await expect(blocks.nth(1)).toHaveAttribute("data-layout-type", "section");

    // Add a typed custom block, edit its content and verify the live preview.
    await page.locator(".block-library-item").filter({ hasText: "Project" }).dragTo(page.locator(".preview-card"));
    await editorTab(page, "Blocks");
    await page.getByLabel("Project title", { exact: true }).fill("Studio portfolio project");
    await page.getByLabel("Description", { exact: true }).fill("A project created in the custom block editor.");
    await page.getByLabel("Project URL", { exact: true }).fill("https://portfolio.example.org/work");
    const firstProjectEditor = page.locator(".studio-block-editor").first();
    await firstProjectEditor.getByLabel("Locked").check();
    await expect(firstProjectEditor.getByLabel("Width")).toBeDisabled();
    await expect(firstProjectEditor.getByLabel("Project title")).toBeDisabled();
    await firstProjectEditor.getByLabel("Locked").uncheck();
    await expect(firstProjectEditor.getByLabel("Width")).toBeEnabled();
    await expect(page.locator(".preview-card .profile-block-project").first()).toContainText("Studio portfolio project");
    await expect(page.locator(".preview-card .profile-block-project")).toContainText("A project created in the custom block editor.");
    await page.getByRole("button", { name: "Duplicate block 1" }).click();
    await expect(page.locator(".studio-block-editor")).toHaveCount(2);
    await expect(page.locator(".preview-card .profile-block-project")).toHaveCount(2);

    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toBeVisible();
    await page.reload();
    const reloadedBlocks = page.locator(".preview-card .profile-layout-block");
    await expect(reloadedBlocks).toHaveCount(5);
    await expect(reloadedBlocks.nth(0)).toHaveAttribute("data-layout-type", "widgets");
    await expect(reloadedBlocks.nth(1)).toHaveAttribute("data-layout-type", "section");
    await expect(page.locator(".preview-card .profile-block-project").first()).toContainText("Studio portfolio project");

    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText("Live · Up to date", { exact: true })).toBeVisible();
    await page.goto("/" + name);
    await enterPublicBio(page);
    const publicBlocks = page.locator(".public-page .profile-layout-block");
    await expect(publicBlocks).toHaveCount(5);
    await expect(publicBlocks.nth(0)).toHaveAttribute("data-layout-type", "widgets");
    await expect(publicBlocks.nth(1)).toHaveAttribute("data-layout-type", "section");
    await expect(page.locator(".public-page .profile-block-project")).toHaveCount(2);
    await expect(page.locator(".public-page .profile-block-project").first()).toContainText("Studio portfolio project");
    await expect(page.locator(".public-page .profile-block-project a").first()).toHaveAttribute("href", "https://portfolio.example.org/work");

    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "Account overview", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    const mobileNavigationButton = page.getByRole("button", { name: "Open navigation", exact: true });
    const mobileNavigationBounds = await mobileNavigationButton.boundingBox();
    expect(mobileNavigationBounds?.width).toBeGreaterThanOrEqual(44);
    expect(mobileNavigationBounds?.height).toBeGreaterThanOrEqual(44);
    await mobileNavigationButton.click();
    await expect(page.getByRole("link", { name: "Page Builder", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Close navigation", exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto("/studio/builder");
    await expect(page.getByRole("heading", { name: "Add to page", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expect(page.locator(".preview-card")).toBeVisible();

    await page.goto("/studio/customize");
    await expect(page.getByRole("heading", { name: "Customize", exact: true })).toBeVisible();
    await expect(page.locator(".editor-grid.panel-only")).toBeVisible();
    await expect(page.locator(".editor-grid.panel-only .editor-sidebar")).toBeHidden();
    await expect(page.locator(".preview-card")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    if (account.data.user) await admin.auth.admin.deleteUser(account.data.user.id);
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
    await page.getByRole("link", { name: "Premium & Usage" }).click();
    await expect(page.getByRole("heading", { name: "Plan and usage" })).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 20", { exact: true })).toBeVisible();
    await expect(page.getByText(`@${name} · Draft`, { exact: true })).toBeVisible();
    const editProfile = page.getByRole("link", { name: `Edit @${name}` });
    const profileHref = (await editProfile.getAttribute("href"))!;
    expect(profileHref).toMatch(/^\/studio\/builder\?profile=[a-f0-9-]{36}$/);
    await editProfile.click();
    await expect(page.getByRole("link", { name: "Gallery & Assets" })).toHaveAttribute("href", profileHref.replace("/studio/builder?", "/studio/gallery?"));
    await page.getByRole("link", { name: "Premium & Usage" }).click();
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
    await page.getByRole("link", { name: "Back to Page Builder" }).click();

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
    await page.locator('a[href="/studio/builder?template=project-notebook"]').click();
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
    await page.getByLabel("Enable effects").check();
    await page.locator("#profile-effect-background").selectOption("gradient");
    await expect(page.getByRole("region", { name: "Page preview" }).locator(".profile-effects-layer")).toHaveAttribute("data-background", "gradient");
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
    const instagramProvider = page.getByRole("button", { name: "Instagram" });
    await expect(instagramProvider.locator("svg path")).toHaveAttribute("d", /^M/);
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
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();
    await expect(publicPage.locator(".profile-links li")).toHaveText(["First ↗", "Second ↗"]);
    const kofiLink = publicPage.locator('.profile-social-links a[title="Support my projects"]');
    await expect(kofiLink).toHaveAttribute("href", "https://ko-fi.com/creator");
    await expect(kofiLink.locator(".profile-social-mark svg path")).toHaveAttribute("d", /^M/);

    await expect(publicPage.locator(".profile-text-section h2")).toHaveText(["Current projects", "Notes", "Launch"]);
    await expect(publicPage.locator(".countdown time")).toHaveAttribute("datetime", "2096-02-29T18:15:00.000Z");
    await expect(publicPage.locator(".countdown time")).toContainText("18:15 UTC");
    const bioCard = publicPage.locator(".profile-card");
    await expect(bioCard).toHaveClass(/profile-card--bio-experience/);
    await expect(bioCard).toHaveAttribute("data-layout", "editorial");
    await expect(bioCard).toHaveAttribute("data-density", "compact");
    await expect(bioCard).toHaveCSS("text-align", "center");
    expect(await bioCard.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(576);
    expect(await bioCard.evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThan(16);
    expect(await publicPage.locator(".profile-identity").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
    expect(await publicPage.locator(".profile-more-content .profile-links a").first()
      .evaluate((element) => parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThan(0);
    await expect(publicPage.locator(".profile-callout h2")).toHaveText("Notes");
    await expect(publicPage.locator("blockquote")).toHaveText("Stay curious.");
    await expect(publicPage.locator("figcaption")).toHaveText("Studio notebook");
    await expect(publicPage.getByText("Literal <em>markup</em>.", { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(publicPage.locator(".profile-effects-layer")).toHaveAttribute("data-background", "gradient");
    await expect(publicPage.getByRole("checkbox", { name: "Disable profile effects" })).toHaveCount(0);
    await expect(publicPage.locator(".profile-effects-layer")).toHaveAttribute("data-background", "gradient");
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
    await page.getByRole("link", { name: "Publish History", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Publish history" })).toBeVisible();
    const firstVersion = page.getByRole("listitem").filter({ hasText: "Snoozer Creator" });
    const historyPreviewHref = (await firstVersion.getByRole("link", { name: /Preview version/ }).getAttribute("href"))!;
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
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Second publication" })).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Notes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByText("Live · Up to date")).toBeVisible();
    await publicPage.reload();
    await enterPublicBio(publicPage);
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();

    const responsivePage = await page.context().newPage();
    try {
      await responsivePage.setViewportSize({ width: 360, height: 812 });
      for (const path of [profileHref, ...["analytics", "gallery", "gallery/folders", "history", "plan"].map((section) => profileHref.replace("/studio/builder?", `/studio/${section}?`)), historyPreviewHref, "/studio/plan/gifts", "/studio/billing-diagnostics", `/${name}`]) {
        const response = await responsivePage.goto(path);
        expect(response?.status()).toBe(path === "/studio/billing-diagnostics" ? 404 : 200);
        expect(await responsivePage.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(360);
      }
      await responsivePage.goto(profileHref);
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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
    await expect(page.getByRole("heading", { name: "Page Builder", exact: true })).toBeVisible();
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
  await page.getByRole("link", { name: "Gallery & Assets" }).click();
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
  const blueShorelineId = privatePath.split("/").at(-1)!;
  expect((await page.request.get(privatePath)).headers()["content-type"]).toBe("image/webp");
  expect((await request.get(privatePath)).status()).toBe(404);
  expect((await request.get(publicPath)).status()).toBe(404);

  await page.goto("/studio/plan");
  await expect(page.getByText("Media storage", { exact: true }).locator("..").locator("dd")).toHaveText(/^[1-9]\d* B of 100 MB$|^[\d.]+ MB of 100 MB$/);
  await expect(page.getByText("0 MB of 100 MB", { exact: true })).toHaveCount(0);
  await page.goto("/studio/gallery");

  await page.getByRole("group", { name: "Actions for Open water" }).getByRole("button", { name: "Move earlier" }).click();
  await expect(page.getByRole("img").first()).toHaveAttribute("alt", "Open water");
  await page.getByRole("link", { name: "Back to Page Builder" }).click();
  await expect(page.getByRole("region", { name: "Gallery may use more memory on phones" })).toContainText("12.5 MiB");
  await expect(page.getByRole("link", { name: "Manage gallery images" })).toHaveAttribute("href", "/studio/gallery");
  await editorTab(page, "Design");
  await page.getByRole("button", { name: "Use Blue shoreline as profile background" }).click();
  const previewCard = page.getByRole("region", { name: "Page preview" });
  // ProfileCard itself is the named region, not a descendant of it.
  const previewPage = previewCard;
  await expect(previewPage).toHaveAttribute("data-background-image", "true");
  await expect(previewPage).toHaveAttribute("style", new RegExp(blueShorelineId));
  await expect.poll(() => previewPage.evaluate((element) =>
    getComputedStyle(element).backgroundImage)).toContain(blueShorelineId);
  await expect(previewCard.locator(".profile-gallery img")).toHaveCount(1);
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByRole("link", { name: "View live page" })).toBeVisible();
  const liveImage = await request.get(publicPath);
  expect(liveImage.status()).toBe(200);
  expect(liveImage.headers()["content-type"]).toBe("image/webp");
  const html = await (await request.get("/" + name)).text();
  // The selected image backgrounds the whole public page, as well as the card.
  expect(html).toMatch(/<main class="public-page"[^>]*data-background-image="true"/);
  expect(html).toMatch(/<section\b[^>]*class="profile-card[^"]*"[^>]*data-background-image="true"/);
  expect(html).toContain(blueShorelineId);
  expect(html).toContain('alt="Open water"');
  expect(html).not.toContain('alt="Blue shoreline"');
  expect(html).not.toContain("Gallery may use more memory");
  await page.goto("/" + name);
    await enterPublicBio(page);
  const fullPageBackground = page.locator("main.public-page");
  await expect(fullPageBackground).toHaveAttribute("data-background-image", "true");
  await expect(fullPageBackground).toHaveCSS("background-size", "cover, cover");
  await expect.poll(() => fullPageBackground.evaluate((element) =>
    getComputedStyle(element).backgroundImage)).toContain(blueShorelineId);
  const publicPage = page.locator("main.public-page .profile-card");
  await expect(publicPage).toHaveAttribute("data-background-image", "true");
  await expect.poll(() => publicPage.evaluate((element) =>
    getComputedStyle(element).backgroundImage)).toContain(blueShorelineId);

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
  expect(afterFolders).toContain('alt="Open water"');
  expect(afterFolders).not.toContain('alt="Blue shoreline"');

  await page.goto("/studio/gallery");
  await page.getByRole("group", { name: "Actions for Blue shoreline" }).getByRole("button", { name: "Remove from draft" }).click();
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toHaveCount(0);
  expect((await request.get(publicPath)).status()).toBe(200);
  await page.getByRole("link", { name: "Back to Page Builder" }).click();
  await expect(page.getByRole("region", { name: "Gallery may use more memory on phones" })).toHaveCount(0);
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect.poll(async () => (await request.get(publicPath)).status()).toBe(404);
  expect(await (await request.get("/" + name)).text()).not.toContain('data-background-image="true"');
  expect((await page.request.get(privatePath)).status()).toBe(200);
  await page.goto("/studio/gallery/folders");
  const retained = page.getByRole("listitem").filter({ has: page.getByRole("img", { name: "Blue shoreline" }) });
  await expect(retained.getByText("In publish history")).toBeVisible();
  await retained.getByRole("button", { name: "Add to draft gallery" }).click();
  await expect(retained.getByText("In your draft")).toBeVisible();
  expect((await request.get(publicPath)).status()).toBe(404);
  await page.getByRole("link", { name: "Back to image gallery" }).click();
  await expect(page.getByRole("img", { name: "Blue shoreline" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Page Builder" }).click();
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect.poll(async () => (await request.get(publicPath)).status()).toBe(200);
  expect(await (await request.get("/" + name)).text()).toContain('data-background-image="true"');

  // The Studio preview also contains this image, but uses the owner-only URL.
  await page.goto("/" + name);
    await enterPublicBio(page);
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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
    await page.goto("/help");
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


test("interactive profile widgets publish, accept visitor interactions and enforce moderation and voting privacy", async ({ browser }) => {
  test.setTimeout(90000);
  const suffix = randomUUID().slice(0, 10);
  const name = "widgets-" + suffix;
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
    const profileId = draft.data.profile_id as string;
    const pollId = randomUUID();
    const optionA = randomUUID();
    const optionB = randomUUID();
    const widgets = {
      version: 1,
      order: ["guestbook", "testimonials", "poll", "faq"],
      guestbook: { enabled: true, heading: "Guestbook", description: "Leave a message for the creator.", maxEntries: 10, submissionsOpen: true },
      testimonials: { enabled: true, heading: "Kind words", items: [
        { id: randomUUID(), quote: "A lovely project.", author: "A customer", role: "Client" },
      ] },
      poll: { enabled: true, id: pollId, question: "Which feature do you use most?", options: [
        { id: optionA, label: "Community" }, { id: optionB, label: "Polls" },
      ], open: true, closesAt: null, showResultsBeforeVote: false },
      faq: { enabled: true, heading: "Questions", items: [
        { id: randomUUID(), question: "Where can I find updates?", answer: "Check the creator's links." },
      ] },
    };
    const saved = await owner.rpc("save_profile", {
      p_profile: profileId, p_expected: 0, p_name: "Interactive widgets fixture",
      p_bio: "Widget test profile", p_theme: "midnight", p_indexable: false,
      p_links: [], p_publish: true, p_remove_avatar: false, p_sections: [],
      p_appearance: { density: "balanced", corners: "soft" },
      p_seo: { title: "", description: "" }, p_widgets: widgets,
    });
    expect(saved.error).toBeNull();

    await visitor.addInitScript(() => {
      try { localStorage.setItem("snoozer-analytics-consent-v3", "no"); } catch { /* Optional storage. */ }
    });
    const page = await visitor.newPage();
    await page.goto("/" + name);
    await enterPublicBio(page);
    await expect(page.getByRole("heading", { name: "Kind words" })).toBeVisible();
    await expect(page.getByText("A lovely project.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
    await expect(page.getByText("Where can I find updates?", { exact: true })).toBeVisible();

    const privateResults = await visitor.request.get("/api/v1/widgets/poll", {
      params: { username: name, pollId },
    });
    expect(privateResults.status()).toBe(403);

    await page.getByRole("button", { name: "Community", exact: true }).click();
    await page.getByRole("button", { name: "Vote", exact: true }).click();
    await expect(page.getByText("Your vote has been recorded.", { exact: true })).toBeVisible();
    await expect(page.getByText("1 votes", { exact: true })).toBeVisible();
    await page.reload();
    await enterPublicBio(page);
    await page.getByRole("button", { name: "I already voted — show results", exact: true }).click();
    await expect(page.getByText("1 votes", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Guestbook" })).toHaveCount(0);
    await expect(page.locator(".profile-guestbook")).toHaveCount(0);
    await expect(page.getByLabel("Your name")).toHaveCount(0);

  } finally {
    await visitor.close();
    if (created.data.user) await admin.auth.admin.deleteUser(created.data.user.id);
  }
});
