import { accountLocales } from "@/lib/account-locale";
import { getCurrentAccountLocale } from "@/lib/locale-server";
import { saveHomepageLanguage } from "@/app/language/actions";

export async function FooterLanguagePicker() {
  const locale = await getCurrentAccountLocale();
  const selected = accountLocales.find((item) => item.value === locale) ?? accountLocales[0];

  return (
    <div className="home-footer-language">
      <details className="home-language-picker">
        <summary aria-label={"Language: " + selected.label}>
          <span>{selected.label}</span>
          <svg className="home-language-chevron" viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
            <path d="m5 12.5 5-5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="home-language-menu" aria-label="Choose language">
          {accountLocales.map((item) => (
            <form action={saveHomepageLanguage} key={item.value}>
              <input type="hidden" name="locale" value={item.value} />
              <button type="submit" aria-current={item.value === locale ? "true" : undefined}>
                {item.label}
              </button>
            </form>
          ))}
        </div>
      </details>
    </div>
  );
}
