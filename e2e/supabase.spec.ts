import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

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

test("verify, publish, reset, delete and clean up a profile", async ({ page, browser, request }) => {
  test.setTimeout(90000);
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

    const image = await sharp({ create: { width: 25, height: 25, channels: 3, background: "blue" } }).png().toBuffer();
    await page.getByLabel("Choose an avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Upload or finish pending" }).click();
    await expect(page.getByRole("status")).toContainText("Avatar saved");

    await page.getByLabel("Display name").fill("Snoozer Creator");
    await page.getByLabel("Bio").fill("Private until I publish.");
    await page.getByLabel("Theme").selectOption("lagoon");
    for (const [index, label] of ["First", "Second"].entries()) {
      await page.getByRole("button", { name: "Add link" }).click();
      await page.getByLabel(`Link ${index + 1} label`).fill(label);
      await page.getByLabel(`Link ${index + 1} URL`).fill(`https://example.com/${label}`);
    }
    await page.getByRole("button", { name: "Move link 2 up" }).press("Enter");
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
    await expect(publicPage.locator(".profile-links li")).toHaveText(["Second ↗", "First ↗"]);
    await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const avatarPath = await publicPage.locator("img").getAttribute("src");
    expect(avatarPath).toBeTruthy();
    expect((await visitor.request.get(avatarPath!)).headers()["content-type"]).toBe("image/webp");

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

    await page.getByText("Review profile deletion").click();
    await page.getByLabel(`Type ${name} to confirm`).fill("wrong-name");
    await page.getByRole("button", { name: "Permanently delete profile" }).click();
    await expect(page.getByRole("alert")).toContainText("exact username");
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
  const image = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  expect((await users[0].client.storage.from("avatar-incoming").upload(`${users[1].id}/pending`, image)).error).toBeTruthy();
  expect((await users[0].client.rpc("set_avatar", { p_owner: users[1].id, p_expected: 0, p_avatar: randomUUID() })).error).toBeTruthy();
});
