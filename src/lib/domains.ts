import { z } from "zod";

export const domainName = z.string().max(220).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)
  .refine((host) => !/\.(?:local|localhost|internal|test|invalid|example|onion|onrender\.com|supabase\.co)$/.test(host));
// Render documents this apex load-balancer address in configure-other-dns.
export const renderApexAddress = "216.24.57.1";
export const domainVerificationMarker = "snoozer-domain-v1";
export const domainChallenge = z.string().regex(/^snoozer-domain=[0-9a-f-]{36}$/);

export function domainRoute(path: string, method: string, username: string) {
  if (method === "POST") return ["/api/v1/analytics/view", "/api/v1/widgets/public", "/api/v1/widgets/guestbook", "/api/v1/widgets/poll"].includes(path);
  if (!["GET", "HEAD"].includes(method)) return false;
  return path === "/" || path === "/.well-known/snoozer-domain" || path === "/icon.svg"
    || new RegExp("^/media/(?:avatar|gallery)/" + username + "/[0-9a-f-]{36}$").test(path)
    || path === "/media/profile-card/" + username
    || path === "/api/v1/discord/presence"
    || path === "/api/v1/widgets/guestbook" || path === "/api/v1/widgets/poll";
}

export function publicIPv4(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)) return false;
  const [a, b, c] = parts.map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    && !(a === 203 && b === 0 && c === 113);
}

export const domainInventory = z.object({
  quota: z.number().int().nonnegative(), used: z.number().int().nonnegative(),
  items: z.array(z.object({ id: z.uuid(), hostname: domainName, challenge: domainChallenge,
    expiresAt: z.iso.datetime({ offset: true }), verifiedUntil: z.iso.datetime({ offset: true }).nullable(),
    state: z.enum(["pending", "provisioning", "active", "disconnecting", "retired", "expired", "transferred"]),
  })).max(100),
});
