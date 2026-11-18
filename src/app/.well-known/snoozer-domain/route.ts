import { domainVerificationMarker } from "@/lib/domains";
export function GET() {
  return new Response(domainVerificationMarker, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
