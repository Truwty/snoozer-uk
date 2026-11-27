import { createHmac } from "node:crypto";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { storageAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportSchema = z.object({
  category: z.enum(["bug", "visual", "account", "payments", "other"]),
  title: z.string().trim().min(6).max(120),
  description: z.string().trim().min(20).max(3000),
  steps: z.string().trim().max(2500).optional().default(""),
  contactEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).optional().default(""),
  pagePath: z.string().trim().min(1).max(180)
    .refine((value) => value.startsWith("/") && !value.startsWith("//") && !/[?#\u0000-\u001f]/.test(value)),
  website: z.string().max(200).optional().default(""),
}).strict();

function json(body: Record<string, unknown>, status: number, extraHeaders?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 12_000) {
    return json({ error: "The report is too large." }, 413);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigins = new Set([
      siteUrl().origin,
      "https://status.snoozer.uk",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    if (!allowedOrigins.has(origin)) return json({ error: "This request origin is not allowed." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "A valid report is required." }, 400);
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Check the required fields and try again." }, 400);

  // Honeypot fields are quietly accepted but never saved.
  if (parsed.data.website.trim()) return json({ ok: true }, 202);

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return json({ error: "Bug reporting is temporarily unavailable." }, 503);

  // Render's edge supplies CF-Connecting-IP and appends the visitor IP to
  // X-Forwarded-For. Use the edge-overwritten header first; the fallback uses
  // Render's documented left-most client address. Store only a keyed HMAC.
  const forwarded = request.headers.get("x-forwarded-for");
  const address = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("true-client-ip")
    ?? forwarded?.split(",").map((part) => part.trim()).filter(Boolean)[0]
    ?? "unknown";
  const fingerprint = createHmac("sha256", secret).update(address).digest("hex");
  const browserInfo = (request.headers.get("user-agent") ?? "").slice(0, 500);

  try {
    const { data, error } = await storageAdmin().rpc("submit_status_bug_report", {
      p_request_fingerprint: fingerprint,
      p_category: parsed.data.category,
      p_title: parsed.data.title,
      p_description: parsed.data.description,
      p_steps: parsed.data.steps,
      p_page_path: parsed.data.pagePath,
      p_browser_info: browserInfo,
      p_contact_email: parsed.data.contactEmail || null,
    });

    if (error) {
      if (error.message.includes("rate_limited")) {
        return json({ error: "You’ve sent a few reports recently. Please try again in an hour." }, 429, {
          "Retry-After": "3600",
        });
      }
      return json({ error: "The report could not be saved. Please try again later." }, 503);
    }

    if (typeof data !== "string") {
      return json({ error: "The report could not be confirmed. Please try again." }, 503);
    }

    return json({ ok: true, reportId: data }, 201);
  } catch {
    return json({ error: "Bug reporting is temporarily unavailable." }, 503);
  }
}
