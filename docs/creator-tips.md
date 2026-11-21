# Creator Tips and Donations — external Ko-fi link (partial §13.10)

The existing Profile editor already allows public HTTPS links and renders validated Ko-fi profiles. This increment **reuses that existing published configuration** on the reviewed sandbox creator store; no parallel donation balance, payment processing or new public account field is created.

## Owner experience

1. Sign into Studio and add a public profile link with a canonical address such as `https://ko-fi.com/your_name`; publish the profile. This is the **same** profile-link configuration already used by public profile cards.
2. When that creator's sandbox storefront is eligible to load, it extracts the first valid Ko-fi URL from their **published** profile links, canonicalises it using the existing first-party `kofiProfileUrl` helper, and displays **Support this creator**.
3. If there is no valid published Ko-fi link, an invalid host, an unpublished draft, a different profile or the published profile fetch fails, the panel does not appear. Other store and Checkout operations remain available.
4. The link opens Ko-fi in a separate tab with `noopener noreferrer`. Ko-fi is a third party and may charge **real money**, even though the Snoozer creator store is in Stripe test mode. The panel makes clear that a tip **does not purchase a PDF, confer download access, create a Snoozer purchase/receipt, settle tax, or establish paid entitlements**.
5. Creators remove the panel by unpublishing/removing that Ko-fi link from the Profile editor; there is no separate persistence or review gate on the donation URL.

## Security and scope

- Link selection operates only on `readPublished` data from the canonical matching username, *not* unsaved drafts. The same strict trusted-host HTTPS Ko-fi URL parser is applied once for selection and again before rendering the anchor. No redirect parameters or lookalike domains are accepted.
- Does **not** add a new Stripe or Ko-fi webhook, donation balance, automatic donor attribution, support entitlement, automatic user payouts, tax record or live selling permission. Existing platform-level Ko-fi webhook is a separate billing workflow and must not be confused with creator donations.
- The store already fails closed for disabled/unready reviewed creator commerce; the optional published Ko-fi profile query fails open **only for omission of the tip panel**, never to expose a private product or override the core store gate.

## Tests and future work

Unit/SSR tests cover trusted Ko-fi URLs, canonicalisation, lookalike hosts, missing links, disallowed HTTP/query strings, rendering without third-party scripts, and no-link omission. Run the full lint/TypeScript/unit/PGlite/Playwright/build pipeline and deploy the exact verified main commit to Render. Check no paid buyer orders, receipts, policy flags or current reviewed offers were altered.

This is a **partial** implementation of master §13.10: external creator-tip discovery via existing published links. Creator-level verified donation receipts, refunds, attribution, provider failure handling and revenue reporting remain deferred and must not be claimed as delivered. Phase 5 continues to require an independently verified seller, real second-account sandbox buyer and genuine Stripe risk/refund/dispute/retry evidence.
