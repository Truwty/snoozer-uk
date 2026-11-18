# Milestone 5 — premium and creator growth

Status: in progress. Read the original master specification and the current continuation checkpoint. Preserve the tested editor and provider integrations. This milestone is not complete merely because one vertical slice passes.

Delivery sequence and exit evidence:
1. Portfolio project cards and responsive layout: validated drafts, shared renderer, publish/restore, ownership, unsafe URL rejection, mobile/keyboard tests.
2. First-party template discovery: useful search/category filters, URL state, real previews/application and empty results; preserve installed templates.
3. Advanced SEO: owner-controlled title/description, safe social previews, canonical/noindex protection and published-snapshot isolation; plan checks at publication.
4. Aliases: namespace collision/race protection, owner-scoped limits/expiry/release, safe canonical redirects and deletion handling.
5. Scheduled publishing: immutable selected revision, explicit UTC time, cancellation, revalidation of ownership/entitlements/media, durable bounded native execution and manual reconciliation.
6. Custom domains: DNS challenge, exclusive ownership, renewal/disconnection/takeover guards, trusted Host routing, Render certificate provisioning and verified free-tier limits. No production DNS cutover.
7. Additional layouts/motion: explicit supported presets, preview/public parity, reduced-motion and phone performance checks; no arbitrary scripts/CSS.
8. Creator commerce foundations: separately reviewed Connect/seller model, private products/assets, permissioned buyer access and sandbox receipt/refund paths. Keep payouts/live selling disabled until all required flows and approvals exist.
9. Referral/growth: opt-in attribution, expiry, fraud controls, honest aggregate funnel reporting and no spam rewards.

All streams require meaningful positive, negative and boundary tests, appropriate browser evidence, an entitlement decision and operational documentation. Provider limitations and remaining inventory stay explicit rather than being relabelled complete. Existing published data must survive every additive migration and downgrade.

Current slice: portfolio project sections and layout. All shipped appearance presets remain available on every plan; paid entitlement enforcement for future premium-only presets must be introduced deliberately, without retroactively restricting existing ones. No new infrastructure or dependencies are required.

Portfolio and template discovery implementation: local lint/typecheck/200 Vitest/two policy/build pass. Local filter journey passes after using its real combobox name; remaining provider journeys require disposable Supabase CI. Migration 60 is not applied to hosted staging yet.

Advanced SEO implementation: migration 61 adds bounded relational title/description columns and immutable publication values. Every save entry point reaches the publication-time plan gate, including legacy callers. Any plan can draft/preview; Plus or higher is needed to publish nonempty overrides. Downgrade keeps the existing publication; clearing overrides permits default metadata again. Restore includes metadata. Public canonical/noindex always comes from the platform configuration and published privacy flag. Generated social cards use only already-public text, without fetching creator URLs or third-party assets. Custom uploaded OG images and richer structured-data fields remain open.

Local lint/typecheck/203 unit+SQL/two policy/build pass. First provider CI **44235919108** on c4a8c0e passed 26 browser checks and four Lighthouse 100 scores but failed the newly added portfolio test's exact label-text lookup on a native section type select. The test now uses the actual combobox accessible name. The run is failure evidence, not a passing portfolio journey. Expanded SEO/provider browser checks are pending.

Alias implementation (migration 62): a permanent private public-name registry has the shared unique key for profile names, aliases and application namespaces. Claims cannot win in both tables. Owner operations enforce current plan quotas and a five-claim UTC-day cap; aliases last 90 days and may be renewed or permanently retired. Account/profile deletion cannot release an address for takeover, and deleting a target retires its aliases. Downgrades pause aliases outside deterministic slot order without deleting them. The proxy sends an uncached HTTP 307 for active aliases before streaming begins, preserving query parameters; canonical username casing uses 308. Only already-public profile destinations can resolve. SQL positive/negative/expiry/deletion checks pass. Browser redirect, retirement and actual concurrent profile-versus-alias claim tests are implemented but pending CI.

CI 44236788685 passed the existing 26 browser checks and four Lighthouse scores but the new test stopped at another exact native-select label lookup. The portfolio test now clicks the real Portfolio grid swatch, rather than relying on option text inside the native label. Local source passes lint/typecheck/204 unit+SQL/two policy/build. Migrations 60–62 are NOT yet installed on hosted staging; do not deploy the application there first. Phase 5 remains open.

Scheduled publishing (migration 63) is implemented with frozen immutable versions, prepared/activated metadata, explicit UTC times, cancellation and owner recovery. A bounded database worker revalidates current entitlements/ownership/quotas and preserves newer drafts. Live and pending snapshots are protected from version cleanup. See scheduled-publications.md. Local lint/typecheck/208 unit+SQL/two policy/build pass; provider browser and actual native-cron delivery are pending. The namespace migration and all new migrations now use explicit transactions; CI 44238204212 failed before browser tests at disposable Supabase startup. Redacted startup diagnostics report only migration names/SQLSTATE codes. Do not count that run as passing.

CI 44239946734 successfully started disposable Supabase with the explicit transactions and passed the existing 26 browser checks. The new journey reached and received the correct Free-plan SEO rejection, then its unscoped alert assertion also matched Next’s empty route announcer. The assertion now targets the actual SEO error. This was a test locator failure; the full new journey remains unverified until the next run.


CI run 103 (df82c1e): unit/database checks, disposable Supabase and build passed; 26 browser tests passed, one skipped, combined Phase 5 journey hit its 90-second deadline. Context cleanup masked the original awaited operation. The journey now bounds locator waits at 15 seconds and the PNG request at 15 seconds, with a named image-generation step and fixture-managed browser cleanup. Full combined journey remains unverified until a passing run.

IONOS checked read-only on 18 November: snoozer.uk and www currently use IONOS forwarding to the old bot service. MX, SPF, DMARC and DKIM records are present. No DNS changes made; preserve mail records when launch routing is changed. The existing signed-in IONOS tab remains available for domain verification/cutover.
