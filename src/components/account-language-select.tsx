"use client";

import { updateLanguagePreference } from "@/app/studio/account/actions";

type LocaleOption = { value: string; label: string };

export function AccountLanguageSelect({
  locale,
  label,
  options,
}: {
  locale: string;
  label: string;
  options: readonly LocaleOption[];
}) {
  return (
    <form action={updateLanguagePreference} className="studio-language-form">
      <label htmlFor="snoozer-locale">{label}</label>
      <select
        id="snoozer-locale"
        name="locale"
        defaultValue={locale}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </form>
  );
}
