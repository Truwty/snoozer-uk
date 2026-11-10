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

test("verify, publish, restore, reset, delete and clean up a profile", async ({ page, browser, request }) => {
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
    const stageOwner = createClient(project!, publishableKey!, { auth: { persistSession: false } });
    const stageLogin = await stageOwner.auth.signInWithPassword({ email, password });
    expect(stageLogin.error).toBeNull();
    const stageAdmin = createClient(project!, adminKey!, { auth: { persistSession: false } });
    const { data: abandonedStage, error: stageError } = await stageAdmin.rpc("prepare_avatar_upload", {
      p_owner: stageLogin.data.user!.id, p_expected: 0, p_open: true,
    });
    expect(stageError).toBeNull();
    const abandonedPath = `${abandonedStage.scope}/${abandonedStage.key}`;
    const oldToken = await stageAdmin.storage.from("avatar-incoming").createSignedUploadUrl(abandonedPath);
    expect(oldToken.error).toBeNull();
    await page.getByRole("button", { name: "Discard pending upload" }).click();
    await expect(page.getByRole("status")).toHaveText("Pending upload cleared.");
    expect((await stageOwner.storage.from("avatar-incoming").uploadToSignedUrl(
      abandonedPath, oldToken.data!.token, image, { contentType: "image/png" },
    )).error).toBeNull();
    await page.getByRole("button", { name: "Upload or finish pending" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose an image to upload" })).toBeVisible();

    await page.getByLabel("Choose an avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Upload or finish pending" }).click();
    await expect(page.getByRole("status")).toContainText("Avatar saved");
    await page.goto("/templates");
    await page.getByRole("link", { name: "Open Project notebook in Studio" }).click();
    await expect(page.getByLabel("Preview a template")).toHaveValue("project-notebook");
    await page.getByLabel("Preview a template").selectOption("");

    await page.getByLabel("Display name").fill("Snoozer Creator");
    await page.getByLabel("Bio").fill("Private until I publish.");
    await page.getByLabel("Theme").selectOption("lagoon");
    await page.getByLabel("Preview a template").selectOption("project-notebook");
    await expect(page.getByRole("heading", { name: "Current projects" })).toBeVisible();
    await expect(page.getByLabel("Theme")).toHaveValue("lagoon");
    await page.getByRole("button", { name: "Apply with starter sections" }).click();
    await expect(page.getByLabel("Theme")).toHaveValue("midnight");
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Current projects");
    await page.getByLabel("Section 1 text").fill("First line.\nLiteral <em>markup</em>.");
    await page.getByRole("button", { name: "Move up (section 2)" }).press("Enter");
    await expect(page.getByLabel("Section 1 heading")).toBeFocused();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");
    await page.getByLabel("Preview a template").selectOption("field-guide");
    await expect(page.getByRole("button", { name: "Apply with starter sections" })).toHaveCount(0);
    await page.getByRole("button", { name: "Apply template colours" }).click();
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");
    await expect(page.getByLabel("Theme")).toHaveValue("lagoon");
    for (const [index, label] of ["First", "Second"].entries()) {
      await page.getByRole("button", { name: "Add link" }).click();
      await page.getByLabel(`Link ${index + 1} label`).fill(label);
      await page.getByLabel(`Link ${index + 1} URL`).fill(`https://example.com/${label}`);
    }
    await page.getByRole("button", { name: "Move up (link 2)" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toBeFocused();
    await expect(page.getByLabel("Link 1 label")).toHaveValue("Second");
    await page.getByRole("button", { name: "Undo edit" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toHaveValue("First");
    await page.getByRole("button", { name: "Redo edit" }).press("Enter");
    await expect(page.getByLabel("Link 1 label")).toHaveValue("Second");
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
    await expect(publicPage.locator(".profile-text-section h2")).toHaveText(["Notes", "Current projects"]);
    await expect(publicPage.getByText("Literal <em>markup</em>.", { exact: false })).toBeVisible();
    await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const avatarPath = await publicPage.locator("img").getAttribute("src");
    expect(avatarPath).toBeTruthy();
    expect((await visitor.request.get(avatarPath!)).headers()["content-type"]).toBe("image/webp");

    await page.getByLabel("Display name").fill("Second publication");
    await page.getByRole("button", { name: "Remove section 1" }).click();
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
    await expect(page.getByLabel("Section 1 heading")).toHaveValue("Notes");
    await publicPage.reload();
    await expect(publicPage.getByRole("heading", { name: "Second publication" })).toBeVisible();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(page.getByText("Live · Up to date")).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByRole("heading", { name: "Snoozer Creator" })).toBeVisible();

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
  const winnerIndex = outcomes.findIndex(({ error }…6966 tokens truncated… position ${to + 1} of ${reordered.length}.`);
    focusLink(to);
  }

  function focusLink(index: number) {
    window.requestAnimationFrame(() => (linkLabels.current[index] ?? addLink.current)?.focus());
  }

  return <div className="editor-grid">
    <form className="panel editor-form stack" onSubmit={(event) => {
      event.preventDefault();
      const button = (event.nativeEvent as SubmitEvent).submitter;
      void commit(button instanceof HTMLButtonElement && button.value === "publish" ? "publish" : "draft");
    }}>
      <div className="actions" aria-label="Editing history" role="group">
        <button type="button" className="button small" disabled={!canUndo} onClick={() => travel("undo")}>Undo edit</button>
        <button type="button" className="button small" disabled={!canRedo} onClick={() => travel("redo")}>Redo edit</button>
      </div>
      <fieldset className="stack">
        <legend className="section-title">Profile details</legend>
        <label>Display name<input name="display_name" maxLength={60} required value={content.display_name}
          onChange={(event) => set("display_name", event.target.value)} /></label>
        <label>Bio<textarea name="bio" maxLength={280} rows={4} value={content.bio}
          onChange={(event) => set("bio", event.target.value)} /></label>
        <label>Theme<select name="theme" value={content.theme}
          onChange={(event) => set("theme", event.target.value as ProfileContent["theme"])}>
          {themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}
        </select></label>
        <label className="check"><input type="checkbox" name="indexable" checked={content.indexable}
          onChange={(event) => set("indexable", event.target.checked)} /> Allow search engines to index my published page</label>
        {saved.avatar && <label className="check"><input type="checkbox" name="remove_avatar" checked={removeAvatar} disabled={pending}
          onChange={(event) => {
            const checked = event.target.checked;
            edit((current) => ({ ...current, removeAvatar: checked }));
          }} /> Remove avatar on next manual save</label>}
      </fieldset>
      <fieldset className="stack">
        <legend className="section-title">Studio templates</legend>
        <label>Preview a template
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Show my draft</option>
            {studioTemplates.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {template && <>
          <p className="muted">{template.description} The preview is private.</p>
          <div className="actions">
            <button type="button" className="button small" onClick={() => applyTemplate(false)}>Apply template colours</button>
            {content.sections.length === 0 && <button type="button" className="button small"
              onClick={() => applyTemplate(true)}>Apply with starter sections</button>}
          </div>
        </>}
      </fieldset>
      <TextSectionsEditor sections={content.sections} onChange={(sections) => set("sections", sections)} />
      <fieldset className="stack">
        <legend className="section-title">Links <small>{content.links.length}/20</small></legend>
        <p className="sr-only" aria-live="polite">{announcement}</p>
        {content.links.map((item, index) => <div className="link-editor stack" key={index}>
          <label>Link {index + 1} label<input required maxLength={80} value={item.label}
            ref={(input) => { linkLabels.current[index] = input; }}
            onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></label>
          <label>Link {index + 1} URL<input required type="url" maxLength={2048} placeholder="https://"
            value={item.url} onChange={(event) => set("links", content.links.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry))} /></label>
          <div className="actions">
            <button type="button" className="button small" disabled={index === 0} aria-label={`Move up (link ${index + 1})`} onClick={() => move(index, index - 1)}>Move up</button>
            <button type="button" className="button small" disabled={index === content.links.length - 1} aria-label={`Move down (link ${index + 1})`} onClick={() => move(index, index + 1)}>Move down</button>
            <button type="button" className="button small" aria-label={`Remove link ${index + 1}`} onClick={() => {
              set("links", content.links.filter((_, i) => i !== index));
              setAnnouncement(`Removed link ${index + 1}.`);
              focusLink(Math.min(index, content.links.length - 2));
            }}>Remove</button>
          </div>
        </div>)}
        <button className="button" type="button" ref={addLink} disabled={content.links.length >= 20}
          onClick={() => {
            set("links", [...content.links, { label: "", url: "" }]);
            focusLink(content.links.length);
          }}>Add link</button>
      </fieldset>
      <div className="actions">
        <button className="button" disabled={pending || conflict} name="intent" value="draft">Save draft</button>
        <button className="button primary" disabled={pending || conflict} name="intent" value="publish">Publish page</button>
      </div>
      {conflict && !pending ? <div className="stack">
        <p className="message error" role="alert">Your draft changed elsewhere. Your unsaved edits are still here.</p>
        <details>
          <summary>Copy unsaved edits</summary>
          <label>Unsaved profile content
            <textarea readOnly rows={6} value={JSON.stringify({
              display_name: content.display_name, bio: content.bio, theme: content.theme, indexable: content.indexable,
              links: content.links, sections: content.sections, removeAvatar,
            }, null, 2)} />
          </label>
        </details>
        <div><button className="button" type="button" onClick={() => void discardAndReload()}>Discard local edits and load saved draft</button></div>
      </div> : null}
      {pending ? <p className="message" role="status">Saving…</p> : <>
        {edits && !conflict && message.status !== "error"
          ? <p className="message" role="status">{removeAvatar ? "Save manually to remove the avatar." : "Unsaved changes"}</p>
          : <ActionMessage state={message} />}
      </>}
    </form>
    <aside className="preview stack">
      <div className="actions preview-controls">
        <p className="eyebrow">{template ? "TEMPLATE PREVIEW" : "LIVE PREVIEW"}</p>
        <button type="button" className="button small" aria-pressed={compact} onClick={() => setCompact(!compact)}>Phone width</button>
      </div>
      <div className={compact ? "preview-phone" : undefined}>
        <ProfileCard preview profile={template ? {
          ...saved, ...content, theme: template.theme,
          sections: content.sections.length ? content.sections : template.sections,
        } : { ...saved, ...content }}
          avatarSrc={saved.avatar && !removeAvatar ? `/studio/avatar/${saved.avatar}` : undefined} />
      </div>
    </aside>
  </div>;
}
