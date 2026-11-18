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
