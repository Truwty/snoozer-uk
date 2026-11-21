// Studio-only QA draft defaults. Using these values does not approve or publish an offer.
export const creatorQaDraft = {
  title: "Snoozer isolated sandbox QA (not for sale)",
  description: "Synthetic PDF fixture for a separate Stripe sandbox-only creator-commerce test. Not a real product.",
  price: "0.50",
} as const;

export function creatorOfferStatus(offer: { enabled: boolean; reviewExpiresAt: string }, now = Date.now()) {
  const expiration = Date.parse(offer.reviewExpiresAt);
  if (!Number.isFinite(expiration) || expiration <= now) return "Review expired — not available for purchase";
  return offer.enabled ? "Published for sandbox testing" : "Reviewed — not published";
}
