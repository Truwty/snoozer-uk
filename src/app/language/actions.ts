"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase";

const supportedLocale = z.enum(["en-US", "es-ES", "pt-BR", "fr-FR", "de-DE", "tr-TR"]);

export async function saveHomepageLanguage(form: FormData) {
  const parsed = supportedLocale.safeParse(form.get("locale"));
  if (!parsed.success) redirect("/?language=invalid");

  const jar = await cookies();
  jar.set("snoozer_locale", parsed.data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  try {
    const client = await sessionClient();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;

    if (data.user) {
      const metadata = data.user.user_metadata && typeof data.user.user_metadata === "object"
        && !Array.isArray(data.user.user_metadata)
          ? data.user.user_metadata as Record<string, unknown>
          : {};
      const { error: updateError } = await client.auth.updateUser({
        data: { ...metadata, snoozer_locale: parsed.data },
      });
      if (updateError) redirect("/?language=failed");
    }
  } catch {
    // Public visitors can still save a browser-level language preference.
    // Signed-in preferences are also stored in Auth metadata when available.
  }

  revalidatePath("/");
  redirect("/");
}
