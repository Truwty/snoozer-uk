# Implementation roadmap

The numbered feature inventory is tracked in [feature-ledger.md](feature-ledger.md). Each feature needs a permission model, durable storage where applicable, positive and negative tests, and evidence from its normal user journey. Free-tier constraints govern capacity and scheduling.

| Milestone | Scope and delivery order | Exit evidence |
| --- | --- | --- |
| 0 | Audit, runtime and lint, SQL migration workflow, private GitHub, CI, local Supabase, Render config, threat model, design tokens and operational limits | Reproducible build and clean database reset |
| 1 | Email verification, registration, login, recovery, logout, atomic username claim and availability, onboarding, draft editing and CRUD, themes, ordered links, avatar, immutable publication, metadata and visibility | Two-user and anonymous isolation, concurrent claim and save tests, full auth-to-publish browser journey |
| 2 | Responsive Studio, autosave and conflict handling, history and rollback, accessible block ordering and undo, layouts and visual effects, safe token engine, templates, gallery, processing, quotas and asset moderation | Keyboard and mobile editing, reduced motion, safe storage and processing, rollback checks |
| 3 | Versioned plan catalogue, usage, Checkout, Billing Portal, signed Stripe events and reconciliation, invoices, disputes and refunds, grants and gifts, verified Ko-fi receipts and support links, staff diagnostics | Provider test-mode flows, forged/replayed/out-of-order event tests, no browser entitlement grants |
| 4 | Consent-aware events and click redirects, aggregation, retention, charts and exports, experiments groundwork, platform widgets and consent-scoped integrations | Verified attribution, bot controls, no cross-owner leakage, revoked integration and provider failure tests |
| 5 | Advanced layouts/effects and SEO, aliases and verified domains, publishing schedules, portfolios, template discovery, safe digital-product storefront, buyer access, referral and growth | Domain takeover checks, scheduled jobs, permissioned downloads and approved commerce model |
| 6 | Workspace roles and approvals, API keys and webhooks, moderation, appeal and admin audit, directory/community, notifications, account export/deletion, operational dashboards, rate limits and load/recovery drills | Role matrix, staff step-up auth, privacy workflow, quota and backup restore evidence |
| 7 | Owner-approved terms/privacy/tax, SMTP, production config, DNS/TLS, deployment and rollback, launch accessibility/performance/security gates | Real production smoke tests and verified deployment. Live payment activation requires approved legal/tax settings and secure live credentials |

The Studio milestone checks cover revision conflicts, keyboard and touch reorder, undo and restore, preview widths of 320 and 375 pixels, validated appearance options, reduced motion, signed image uploads, gallery limits and moderation takedowns. The [feature ledger](feature-ledger.md) tracks additional presets, effects, layouts and media types as separate implementation work.

Commerce payouts require a separate Stripe Connect design and approval before release. Advanced capability decisions and release dependencies remain visible in the ledger. Default to UK English, GBP, UTC storage and configurable Europe/London display.
