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
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Help Center" })).toHaveAttribute("href", "/help");
    await expect(page.locator(".home-metric-card")).toHaveCount(4);
    await expect(page.locator(".home-metric-value")).toHaveCount(4);
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


test("homepage topbar account control is icon-only and keeps its menu", async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator(".home-immersive .account-trigger");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", /Open .* menu/);
  await expect(trigger.locator(".account-trigger-identity, .account-chevron")).toHaveCount(0);
  await trigger.click();
  await expect(page.locator(".home-immersive .account-popover")).toBeVisible();
});

test("homepage footer language menu opens upward and lists supported locales", async ({ page }) => {
  await page.goto("/");
  const picker = page.locator(".home-footer-language");
  await expect(picker).toBeVisible();
  await expect(picker.locator("summary").getByText(/English \(United States\)/)).toBeVisible();
  await picker.locator("summary").click();
  await expect(picker.locator(".home-language-menu button")).toHaveCount(6);
  await expect(picker.getByRole("button", { name: /Español/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: /Türkçe/ })).toBeVisible();
});


test("homepage footer language selection is saved for the current browser", async ({ page }) => {
  await page.goto("/");
  const picker = page.locator(".home-footer-language");
  await picker.locator("summary").click();
  await picker.getByRole("button", { name: /Español/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-ES");
  await expect(picker).toContainText("Español (España)");
});


test("homepage translates visible content for every supported language and persists the choice", async ({ page }) => {
  const cases = [
    { button: /Español/, locale: "es-ES", heading: "Todo lo que quieres, aquí mismo.", faq: "Preguntas frecuentes", nav: "Centro de ayuda", username: "Nombre de usuario" },
    { button: /Português/, locale: "pt-BR", heading: "Tudo o que você quer, em um só lugar.", faq: "Perguntas frequentes", nav: "Central de ajuda", username: "Nome de usuário" },
    { button: /Français/, locale: "fr-FR", heading: "Tout ce que vous voulez, au même endroit.", faq: "Foire aux questions", nav: "Centre d’aide", username: "Nom d’utilisateur" },
    { button: /Deutsch/, locale: "de-DE", heading: "Alles, was du willst. An einem Ort.", faq: "Häufig gestellte Fragen", nav: "Hilfezentrum", username: "Benutzername" },
    { button: /Türkçe/, locale: "tr-TR", heading: "İstediğin her şey, tek bir yerde.", faq: "Sıkça Sorulan Sorular", nav: "Yardım Merkezi", username: "Kullanıcı adı" },
  ] as const;

  await page.goto("/");
  for (const item of cases) {
    const picker = page.locator(".home-footer-language");
    await picker.locator("summary").click();
    await picker.getByRole("button", { name: item.button }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", item.locale);
    await expect(page.getByRole("heading", { level: 1, name: item.heading })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: item.faq })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: item.nav })).toBeVisible();
    await expect(page.getByLabel(item.username, { exact: true })).toHaveCount(2);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", item.locale);
    await expect(page.getByRole("heading", { level: 1, name: item.heading })).toBeVisible();
  }
});
