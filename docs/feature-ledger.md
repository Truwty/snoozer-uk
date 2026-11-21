# Feature ledger

Deferred entries are implementation work. Milestone 4 scope/entitlement decisions and reasons are in [milestone-4-review.md](milestone-4-review.md). Provider-dependent results are tracked in PROGRESS.md. The roadmap also covers the specification’s cross-cutting sections and acceptance gates.

## 4. IDENTITY AND AUTHENTICATION

| ID | Capability | Status |
| --- | --- | --- |
| 4.1 | Email/Password With Modern Hashing | Tested against disposable Supabase in CI |
| 4.2 | Email Verification | Tested against disposable Supabase in CI |
| 4.3 | Password Reset | Tested against disposable Supabase in CI |
| 4.4 | Passkeys/Webauthn Where Feasible | Deferred |
| 4.5 | Oauth Google And Discord | Deferred |
| 4.6 | Session Revocation | Partially implemented |
| 4.7 | Device/Session History | Deferred |
| 4.8 | Mfa With Totp And Recovery Codes | Deferred |
| 4.9 | Anti-Enumeration And Login Throttling | Partially implemented |
| 4.10 | Account Deletion And Export | Deferred |
| 4.11 | Multiple Identities With Clear Limits | Deferred |
| 4.12 | Username Change History | Deferred |
| 4.13 | Protected Username Reservation | Partially implemented |
| 4.14 | Account Recovery Threat Controls | Deferred |

## 5. USERNAME, ROUTING, AND ALIASES

| ID | Capability | Status |
| --- | --- | --- |
| 5.1 | Case-Insensitive Canonical Uniqueness | Tested locally |
| 5.2 | Unicode Normalization And Confusable Defense | Tested locally |
| 5.3 | Reserved Path Namespaces | Tested locally |
| 5.4 | Length And Allowed-Character Rules | Tested locally |
| 5.5 | Rename Redirect Policy | Deferred |
| 5.6 | Alias Ownership And Expiry | Implemented with plan quotas, 90-day expiry, renew/retire and permanent namespace protection; SQL and disposable provider browser pass; hosted307 and owner inventory verified in Phase5; see milestone-5.md |
| 5.7 | Custom Domains With Dns Challenge | Implemented and tested in CI and actual IONOS/Render staging DNS/TLS journey; temporary QA connection cleaned; operator-managed included-capacity gate remains |
| 5.8 | Tls Provisioning And Renewal | Actual Render certificate issuance and pinned HTTPS verified; bounded proof renewal implemented/tested; long-term provider renewal not observed |
| 5.9 | Anti-Takeover Verification | SQL/CI covers fresh claims, consumed proofs, transfer and disconnect generations; actual owner DNS/provider/TLS activation verified |
| 5.10 | Canonical Seo Redirects | Deferred |
| 5.11 | Domain Disconnect And Rollback | Actual owner routing stop, provider removal404 plus parent200 confirmation and DB removed state verified; DNS and free slot restored |
| 5.12 | Username Squatting Appeals | Deferred |
| 5.13 | Vanity Url Availability Checker | Partially implemented |

## 6. PUBLIC PROFILE RENDERER

| ID | Capability | Status |
| --- | --- | --- |
| 6.1 | Server-Rendered Metadata | Partially implemented |
| 6.2 | Open Graph And Twitter Cards | Partially implemented |
| 6.3 | Responsive Portrait And Landscape | Partially implemented |
| 6.4 | Fallback Fonts And Images | Partially implemented |
| 6.5 | Reduced-Motion Support | Partially implemented |
| 6.6 | Optional Entry Screen | Deferred |
| 6.7 | Content Warning Where Appropriate | Deferred |
| 6.8 | Share And Qr Controls | Partially implemented |
| 6.9 | Profile Visibility Modes | Partially implemented |
| 6.10 | Scheduled Publishing | Frozen snapshots, native bounded worker and owner recovery tested in CI; actual hosted09:19UTC activation retained newer draft6 |
| 6.11 | Password-Protected Pages With Secure Verification | Deferred |
| 6.12 | View Counter With Bot Filtering | Deferred |
| 6.13 | Mobile Safe-Area Insets | Partially implemented |
| 6.14 | Link Safety Warnings | Deferred |

## 7. VISUAL EDITOR

| ID | Capability | Status |
| --- | --- | --- |
| 7.1 | Drag-And-Drop Blocks | Studio section and link reordering verified with mouse and emulated touch in disposable Supabase CI. Other block groups remain open |
| 7.2 | Keyboard-Accessible Reorder | Partially implemented |
| 7.3 | Undo And Redo | Tested in disposable CI for profile fields and link order within the current Studio session |
| 7.4 | Autosave With Revision Numbers | Tested in disposable CI for persistence, overlapping edits and stale-tab recovery |
| 7.5 | Draft Versus Published State | Tested locally |
| 7.6 | Version History | Tested in disposable CI for owner preview, restore-to-draft and republish of retained versions |
| 7.7 | Live Responsive Preview | Tested in disposable CI for live preview, with matching Studio and public card measurements at 320 and 375 px |
| 7.8 | Snap-To-Grid Where Applicable | Deferred |
| 7.9 | Global Design Tokens | Partially implemented |
| 7.10 | Per-Block Overrides | Deferred |
| 7.11 | Theme Presets | Partially implemented |
| 7.12 | Copy And Paste Styles | Versioned appearance transfer and undo verified in disposable Supabase CI |
| 7.13 | Template Import With Asset Attribution | Deferred |
| 7.14 | Component Lock And Hide | Section visibility and locking verified in disposable Supabase CI |
| 7.15 | Bulk Edits | Deferred |
| 7.16 | Asset Library Picker | Retained image reuse verified in disposable Supabase CI |
| 7.17 | Contrast Inspector | Studio reports contrast for three link accent presets. Unit, SQL and provider browser tests passed |
| 7.18 | Performance Budget Warnings | Studio gallery memory advisory verified in unit tests and disposable Supabase CI. Other budget metrics remain open |

## 8. LAYOUT AND THEME ENGINE

| ID | Capability | Status |
| --- | --- | --- |
| 8.1 | Minimal Centred Card | Partially implemented |
| 8.2 | Portfolio Editorial | Editorial card verified in disposable Supabase CI. Wider portfolio features remain open |
| 8.3 | Grid Dashboard | Deferred |
| 8.4 | Streamer Overlay Style | Deferred |
| 8.5 | Immersive Full-Screen | Deferred |
| 8.6 | Terminal Developer Profile | Deferred |
| 8.7 | Music-Focused Layout | Deferred |
| 8.8 | Professional Business Card | Deferred |
| 8.9 | Split Hero Layout | Deferred |
| 8.10 | Masonry Gallery | Deferred |
| 8.11 | Custom Sections | Text, callout and quote sections verified in disposable Supabase CI for preview, publication and restore |
| 8.12 | Safe Advanced Css Tokens Without Arbitrary Script | Named spacing, corner, layout and link accent values verified in disposable Supabase CI |
| 8.13 | Fluid Typography | Partially implemented |
| 8.14 | Font Pairing | Deferred |
| 8.15 | Borders And Radii | Partially implemented |
| 8.16 | Shadows And Glass Effects | Deferred |
| 8.17 | Light/Dark/Auto Variants | Deferred |

## 9. MOTION AND VISUAL EFFECTS

| ID | Capability | Status |
| --- | --- | --- |
| 9.1 | Particle Field | Deferred |
| 9.2 | Aurora Background | Deferred |
| 9.3 | Soft Snowfall | Deferred |
| 9.4 | Stars | Deferred |
| 9.5 | Subtle Rain | Deferred |
| 9.6 | Gradient Mesh | Deferred |
| 9.7 | Parallax Depth | Deferred |
| 9.8 | Typewriter Descriptions | Deferred |
| 9.9 | Animated Border | Deferred |
| 9.10 | Cursor Trail | Deferred |
| 9.11 | Hover Tilt | Deferred |
| 9.12 | Glitch Title | Deferred |
| 9.13 | Neon Outline | Deferred |
| 9.14 | Spotlight Cursor | Deferred |
| 9.15 | Entrance Transitions | Optional background fade and reduced-motion fallback verified in disposable Supabase CI |
| 9.16 | Sound Effects Opt-In | Deferred |
| 9.17 | Frame-Rate Adaptive Degradation | Deferred |
| 9.18 | Prefers-Reduced-Motion Fallback | Partially implemented |
| 9.19 | Mobile Battery Saving | Deferred |

## 10. LINKS AND SOCIAL PRESENCE

| ID | Capability | Status |
| --- | --- | --- |
| 10.1 | Custom Buttons | Partially implemented |
| 10.2 | Icon Library | Deferred |
| 10.3 | Link Grouping | Deferred |
| 10.4 | Reordering | Partially implemented |
| 10.5 | Scheduling | Deferred |
| 10.6 | Expiration | Deferred |
| 10.7 | Utm Builder | Deferred |
| 10.8 | Link Click Events | Deferred |
| 10.9 | Nofollow/Sponsored Controls | Deferred |
| 10.10 | Broken-Link Checker | Deferred |
| 10.11 | Safe Redirects | Deferred |
| 10.12 | Platform Username Validation | Deferred |
| 10.13 | Discord Invite Preview | Tested public summary/cached adapter in CI 44187169499 and real staging provider responses. See public-widgets.md |
| 10.14 | Roblox Profile And Game Links | Validated Roblox game links; no API statistics. Cookie-based legacy integration not used. See public-widgets.md |
| 10.15 | Github Repositories | Tested public summary/cached adapter in CI 44187169499 and real staging provider responses. See public-widgets.md |
| 10.16 | Youtube | Deferred |
| 10.17 | Twitch | Partial: optional Twitch player with sizing/parent/mute controls, CI and hosted offline/hide checks pass; no first-party live-status API. See public-widgets.md |
| 10.18 | Spotify | Deferred |
| 10.19 | Tiktok | Deferred |
| 10.20 | Instagram | Deferred |
| 10.21 | Bluesky | Deferred |
| 10.22 | Steam | Deferred |
| 10.23 | Ko-Fi | Deferred |
| 10.24 | Stripe Payment Links | Deferred |
| 10.25 | Custom Url And Mailto | Partially implemented |

## 11. WIDGETS AND INTEGRATIONS

| ID | Capability | Status |
| --- | --- | --- |
| 11.1 | Discord Presence With Consent | Deferred |
| 11.2 | Discord Server Preview | Tested public summary/cached adapter in CI 44187169499 and real staging provider responses. See public-widgets.md |
| 11.3 | Github Contribution Summary | Deferred |
| 11.4 | Roblox Game Showcase | Deferred API showcase: stable API/OAuth design required; validated outbound game links work. See public-widgets.md |
| 11.5 | Youtube Video Embed | Tested in disposable CI 44173960711 and hosted staging for opt-in, provider fallback and removal. See youtube-widget.md |
| 11.6 | Twitch Live Status | Partial: optional Twitch player with sizing/parent/mute controls, CI and hosted offline/hide checks pass; no first-party live-status API. See public-widgets.md |
| 11.7 | Spotify Currently Playing Where Authorised | Deferred |
| 11.8 | Music Playlist | Deferred |
| 11.9 | Weather Opt-In Location | Deferred |
| 11.10 | Time Zone Clock | Deferred |
| 11.11 | Calendar Availability | Deferred |
| 11.12 | Countdown | First-party countdown verified in disposable Supabase CI for preview, expiry, publication and restore |
| 11.13 | Guestbook With Moderation | Deferred |
| 11.14 | Testimonials | Deferred |
| 11.15 | Poll | Deferred |
| 11.16 | Faq | Deferred |
| 11.17 | Project Cards | Implemented validated outbound project sections, shared rendering and snapshot restore; unit/SQL tested, provider browser pending |
| 11.18 | Product Cards | Deferred |
| 11.19 | Support/Donation Panel | Deferred |
| 11.20 | Newsletter Signup | Deferred |
| 11.21 | Contact Form With Spam Protection | Deferred |

## 12. MEDIA AND FILE HOSTING

| ID | Capability | Status |
| --- | --- | --- |
| 12.1 | Avatar Cropper | Deferred |
| 12.2 | Background Image | Select a processed image from the draft gallery as the profile-card background; preview and publication/history behavior verified in unit, SQL and disposable browser tests. A separate background upload pipeline is not used |
| 12.3 | Background Video | Deferred |
| 12.4 | Audio Uploads | Deferred |
| 12.5 | Gallery And Folders | Image galleries and private folders verified in disposable Supabase CI |
| 12.6 | Drag-And-Drop Uploads | Single-image drop and picker paths verified in disposable Supabase CI |
| 12.7 | Resumable Multipart Uploads | Deferred |
| 12.8 | Presigned Urls | Tested against disposable Supabase in CI |
| 12.9 | Image Transcoding | Avatar and gallery WebP conversion verified in disposable Supabase CI |
| 12.10 | Thumbnail Variants | Deferred |
| 12.11 | Video Poster Frames | Deferred |
| 12.12 | Audio Metadata | Deferred |
| 12.13 | Virus/Malware Scanning | Deferred |
| 12.14 | File Mime Sniffing | Tested locally |
| 12.15 | Content Hash Deduplication Scoped Safely | Deferred |
| 12.16 | Quotas And Usage Meters | Partially implemented |
| 12.17 | Private/Public Acl | Partially implemented |
| 12.18 | Short Links | Deferred |
| 12.19 | Hotlink Controls | Deferred |
| 12.20 | Cdn Cache Policy | Partially implemented |
| 12.21 | Delete And Retention Policies | Deferred |
| 12.22 | Copyright Reporting | Deferred |

## 13. CREATOR STOREFRONT AND PRODUCTS

| ID | Capability | Status |
| --- | --- | --- |
| 13.1 | Digital Downloads | Hosted owner PDF/quota/removal proof; private snapshots pass CI44423125617 (hosted positive snapshot blocked by upload-network failure). Buyer ownership/current-provider/SHA-256 delivery passes unit/SQL/CI44463174220; schema76/gated source16aba31 hosted. Actual sandbox buyer payment/delivery and production scanning remain unverified |
| 13.2 | Product Detail Cards | Hosted private GBP drafts/archive/revisions and reviewed frozen sandbox store, with existing durable Checkout/resume. A dedicated sandbox `/store/{username}/{versionId}` details route now uses exactly the existing server-gated, anonymous **reviewed-offers-only** RPC and seller readiness refresh (no extra purchase bypass). Store cards link to detail pages; route is noindexed and rejects invalid/foreign/withdrawn/unlisted versions, disabled Checkout and failed provider reads. Nine targeted SSR, gate, noindex, privacy and outage tests plus the whole pipeline passed [CI #203](https://github.com/Truwty/snoozer-uk/actions/runs/44860934467); [PR #13](https://github.com/Truwty/snoozer-uk/pull/13) merged and Render deployed `d979d1a` Live 21 Nov 2026 03:30:41 UTC. Real independent Checkout remains unverified |
| 13.3 | Creator Collections | Implemented, merged and deployed: [PR #15](https://github.com/Truwty/snoozer-uk/pull/15) `2e3ad20`, [full CI #225](https://github.com/Truwty/snoozer-uk/actions/runs/44864950501), Render `dep-dc0hma6c6qcc73ed7s60` Live at 04:18:06 UTC. Hosted additive migration `20261121041146` installed/tracked with verified owner-only grants. Owner-only capped collection CRUD (up to five groups per profile, five existing profile-owned drafts each), optimistic revisions, deletion without touching PDFs/orders, and public titles/version links **only** when the existing canonical sandbox store approves those frozen versions. Private by default; never opens a separate Checkout path. Unit, SQL owner/privacy/staleness/expiry and authenticated Playwright checks added. CI #220 and final-head #225 passed all stages; hosted migration `20261121041146` installed/tracked with verified authenticated-only owner RPC grants and public read projection, original paid order and processed receipt intact. Human hosted owner UI check remains pending. |
| 13.4 | Inventory For Limited Digital Items | Implemented and deployed: [PR #17](https://github.com/Truwty/snoozer-uk/pull/17) `9d1603d`, [final CI #251](https://github.com/Truwty/snoozer-uk/actions/runs/44871234982) passed, Render `dep-dc0ir0u1egvs7383a5jg` Live 2026-11-21 05:36:33 UTC, hosted migration `20261121053005` installed and tracked. Seller-owned frozen-version Checkout reservation cap (1–50), default unlimited; durable monotonic slot counter independent of order retention; service-only atomic allocation under existing seller lock in the original Checkout reservation RPC, preserving buyer idempotency and all reviewed-offer/buyer/merchant gates. Owner/noindex Studio editor and public remaining/sold-out states limited to reviewed live sandbox offers. Failed/expired/refunded attempts **never auto-restock** without provider proof. Unit/PGlite positive/negative/expiry and verified-owner browser tests added. Initial full [CI #247](https://github.com/Truwty/snoozer-uk/actions/runs/44870897821) passed; hosted migration `20261121053005` applied/tracked, owner-only grants and service-only reservation verified, zero inventory limits by default and original order/receipt intact. Final-head CI passed and matching source deployed Live; real independent buyer/provider stock acceptance and human hosted UI confirmation remain open. |
| 13.5 | Discount Codes | Sandbox source CI passed (44879648821); hosted schema tracked 20261121072318 and grants verified; Render Live 11e675c; human hosted and real provider acceptance pending |
| 13.6 | Purchase Receipts | Buyer-only sandbox history and downloadable paid-order text record; receipt-download CI 44880062043 passed and Render Live 11e675c; human hosted verification pending; not a tax invoice |
| 13.7 | Refund Status | Canonical partial/full refund and sticky delivery holds pass CI44460593527; buyer held status passes CI44461446340. Actual creator refund delivery and case resolution remain unverified |
| 13.8 | Download Access Expiry | Fixed first-verified-paid30-day window, database-time inventory and per-request paid/unheld/fresh proof pass SQL/unit/CI44461446340. Actual hosted expiry/delivery unverified |
| 13.9 | Licence Keys If Appropriate | Deferred |
| 13.10 | Tips And Donations | Partial **Live** implementation: [PR #18](https://github.com/Truwty/snoozer-uk/pull/18) merged as `6261e80` after [CI #258](https://github.com/Truwty/snoozer-uk/actions/runs/44871843506) passed; Render `dep-dc0iuvm1egvs7383l4d0` Live 2026-11-21 05:44:56 UTC. Reuses creator's existing published Ko-fi profile link on the sandbox creator store, with strict HTTPS host/path validation, no unpublished link exposure, external real-money warning and no Snoozer entitlement/receipt claims. Unit/SSR positive, malicious URL and empty-state tests added. Full creator-level donation receipts/attribution/refunds/provider reconciliation still deferred; no tax or entitlement claims. Host-side authenticated public-store check still pending. No SQL migration or original order/receipt mutation. |
| 13.11 | Membership Offers | Preview and sandbox recurring implementation merged via PR #21; full CI 44923692980 passed; hosted schema 20261121162149 verified with disabled gate and no subscribers. Real seller, buyer, recurring-provider/risk acceptance, production readiness and legal/tax approvals remain open |
| 13.12 | Creator Storefront Analytics | Implemented, tested, hosted and deployed (PR #14, `9bdac81`, [full CI #212](https://github.com/Truwty/snoozer-uk/actions/runs/44862797211), Render `dep-dc0ha9d9el5s73e4i590` Live 2026-11-21 03:52:31 UTC). Hosted additive migration `20261121034500` is tracked and authenticated-only RPC grants verified. Verified-account seller-only read-only RPC aggregates retained test orders (pending/expired/paid/held/downloadable), gross test amount and fourteen UTC order-creation days without any buyer/payment identity. Studio has a private noindex owner report, real empty state, and explicit non-revenue/refund disclaimers. Unit/SQL permission and state regressions and authenticated disposable-browser tests passed CI; hosted human owner-browser check and real Stripe risk acceptance remain pending. No Stripe payout, tax, net refund or production analytics claims. |
| 13.13 | Affiliate Disclosures | Implemented, migrated and deployed: [PR #16](https://github.com/Truwty/snoozer-uk/pull/16) `796763f`, final [CI #239](https://github.com/Truwty/snoozer-uk/actions/runs/44866456576) passed, Render `dep-dc0ijdbm8hqs73el38j0` Live 2026-11-21 05:20:10 UTC, hosted migration `20261121042952` applied/tracked. Profile-owned private draft/explicit public toggle (≤500 chars) with verified-owner revision-checked RPC, private noindex Studio editor and public disclosure visible only via canonical sandbox-store readiness. SQL anonymous/foreign/unverified denial, stale conflict, invalid and expired offer tests plus verified-owner Playwright added. Free-text profile-level disclosure is not automatic product-by-product advertising-law compliance. Initial [CI #234](https://github.com/Truwty/snoozer-uk/actions/runs/44865966237) passed all gates after fixing a real no-approved-products disclosure leakage; hosted additive migration `20261121042952` applied and tracked, authenticated owner RPC grants validated, original order/receipt unchanged. Final-head CI #239 passed and exact app commit deployed Live; buyer order/receipt unchanged. Authenticated hosted human UI review and item-by-item advertising compliance remain open. |
| 13.14 | Tax-Ready Receipts Where Supported | Deferred |
| 13.15 | Fraud Review | Current direct-charge/early-fraud reads and sticky dispute/fraud holds pass CI44460593527/44463174220. Bounded retry/backoff/dead-letter/read-only diagnostics pass CI and schema76 is hosted; real provider warning/case resolution and operational job execution unverified |
| 13.16 | Product Moderation | Service-only reviewed sandbox-fixture SHA attestation with 24-hour expiry and explicit owner publication passes CI44462265410. Added private Studio comparison of each candidate frozen QA version's title, amount, size and SHA against the deterministic reference, with visible version UUID and independent operator review warnings; read-only operator SQL now validates offer status against the exact frozen version and excludes expired reviews from `published_test_offer`, with a separate raw enabled flag. Migration-backed SQL and unit regressions plus full Playwright passed [CI #197](https://github.com/Truwty/snoozer-uk/actions/runs/44859312561); PR #12 merged and source is Live on Render as `f9e8896`. This is not production content or malware scanning. This is not production malware/content moderation; those remain open |
| 13.17 | Buyer Support Flow | Buyer-owned sandbox purchase page now provides tested state-specific support guidance for pending/expired/paid/inactive/held orders, discourages duplicate payment, and repairs the storefront/purchase dead contact link to the established support mailbox and displays the order reference. No automatic risk-hold release or payment claim. Monitored ticket intake, case management, identity-safe support tooling and live support policy remain open |

## 14. ANALYTICS AND EXPERIMENTS

| ID | Capability | Status |
| --- | --- | --- |
| 14.1 | Profile Views | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.2 | Unique Visitors With Privacy-Conscious Methodology | Daily scoped browser observations tested in CI 44218187287 and hosted staging; approximate browsers, not people. See analytics-browsers.md |
| 14.3 | Link Clicks | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.4 | Ctr | Daily clicked-browser CTR tested in CI 44218187287 and hosted staging/CSV. See analytics-browsers.md |
| 14.5 | Referrers | Tested coarse consented reports and registered campaign attribution in CI 44180646763 and hosted staging. See analytics-campaigns.md |
| 14.6 | Device Class | Tested coarse consented reports and registered campaign attribution in CI 44180646763 and hosted staging. See analytics-campaigns.md |
| 14.7 | Country-Level Aggregates | Deferred |
| 14.8 | Time-Series Charts | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.9 | Utm Attribution | Tested coarse consented reports and registered campaign attribution in CI 44180646763 and hosted staging. See analytics-campaigns.md |
| 14.10 | Campaign Comparisons | Tested coarse consented reports and registered campaign attribution in CI 44180646763 and hosted staging. See analytics-campaigns.md |
| 14.11 | Bot Filtering | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.12 | Event Deduplication | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.13 | Csv Export | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.14 | Retention Settings | Partial: plan-controlled retention/purge and native hosted schedule verified; owner-selectable settings deferred |
| 14.15 | Timezone Selection | Deferred |
| 14.16 | Consent-Aware Event Collection | Core tested in disposable CI and hosted staging. See analytics.md |
| 14.17 | Scheduled Reports | Deferred |
| 14.18 | A/B Test Assignment | Deferred |
| 14.19 | Statistical Guardrails | Deferred |
| 14.20 | Real-Time Approximate Metrics | Deferred |
| 14.21 | Anti-Self-View Controls | Core tested in disposable CI and hosted staging. See analytics.md |

## 15. TEMPLATES AND MARKETPLACE

| ID | Capability | Status |
| --- | --- | --- |
| 15.1 | First-Party Templates | Tested in the public gallery and Studio with twelve built-in presentations across three starter content families; validated existing appearance options, distinct example handles and working application flow |
| 15.2 | Creator-Submitted Templates | Deferred |
| 15.3 | Draft And Publish States | Deferred |
| 15.4 | Search And Filters | First-party template search/theme/layout filters and URL state tested locally; creator marketplace discovery remains deferred |
| 15.5 | Tags | Deferred |
| 15.6 | Preview | Tested for public examples and private previews using the creator’s draft |
| 15.7 | Apply Full Template | Implemented for colours and starter sections when the draft has no sections |
| 15.8 | Apply Selected Components | Implemented for colours while preserving existing sections |
| 15.9 | Fork With Attribution | Deferred |
| 15.10 | Versioning | Deferred |
| 15.11 | Safe Asset Handling | Deferred |
| 15.12 | Moderation Queue | Deferred |
| 15.13 | Paid Template Purchases If Implemented | Deferred |
| 15.14 | Ratings With Abuse Prevention | Deferred |
| 15.15 | Featured Collections | Deferred |
| 15.16 | Licensing And Takedown | Deferred |

## 16. TEAMS AND COLLABORATION

| ID | Capability | Status |
| --- | --- | --- |
| 16.1 | Workspace Creation | Deferred |
| 16.2 | Owner/Admin/Editor/Analyst Roles | Deferred |
| 16.3 | Invitation Tokens | Deferred |
| 16.4 | Seat Limits | Deferred |
| 16.5 | Shared Asset Library | Deferred |
| 16.6 | Approval Workflow | Deferred |
| 16.7 | Activity Log | Deferred |
| 16.8 | Comments On Drafts | Deferred |
| 16.9 | Role-Scoped Analytics | Deferred |
| 16.10 | Billing Ownership | Deferred |
| 16.11 | Transfer Ownership Safeguards | Deferred |
| 16.12 | Brand Kits | Deferred |
| 16.13 | Multi-Profile Management | Deferred |
| 16.14 | Team Offboarding | Deferred |
| 16.15 | Least-Privilege Api Keys | Deferred |

## 17. NOTIFICATIONS AND COMMUNICATIONS

| ID | Capability | Status |
| --- | --- | --- |
| 17.1 | Transactional Email | Deferred |
| 17.2 | Verified Sender Setup | Deferred |
| 17.3 | In-App Inbox | Deferred |
| 17.4 | Billing Alerts | Deferred |
| 17.5 | Security Alerts | Deferred |
| 17.6 | Moderation Notices | Deferred |
| 17.7 | Upload Processing Notices | Deferred |
| 17.8 | Weekly Analytics Digest | Deferred |
| 17.9 | Product Announcements Opt-In | Deferred |
| 17.10 | Notification Preferences | Deferred |
| 17.11 | Unsubscribe Compliance | Deferred |
| 17.12 | Email Template Previews | Deferred |
| 17.13 | Retry And Dead-Letter Handling | Deferred |

## 18. COMMUNITY AND DISCOVERY

| ID | Capability | Status |
| --- | --- | --- |
| 18.1 | Opt-In Public Directory | Deferred |
| 18.2 | Category Pages | Deferred |
| 18.3 | Verified Ownership Indicators | Deferred |
| 18.4 | Search With Safe Ranking | Deferred |
| 18.5 | Profile Collections | Deferred |
| 18.6 | Featured Creators | Deferred |
| 18.7 | Curated Spotlight | Deferred |
| 18.8 | Community Guidelines | Deferred |
| 18.9 | Report Button | Deferred |
| 18.10 | Block And Mute | Deferred |
| 18.11 | Spam-Resistant Guestbook | Deferred |
| 18.12 | Profile Recommendation Privacy Controls | Deferred |
| 18.13 | Opt-Out Of Indexing | Partially implemented |
| 18.14 | No Purchased Fake Traffic | Deferred |

## 19. ADMIN AND TRUST SAFETY

| ID | Capability | Status |
| --- | --- | --- |
| 19.1 | Role-Based Admin Console | Deferred |
| 19.2 | User Lookup | Deferred |
| 19.3 | Report Queues | Deferred |
| 19.4 | Appeal Management | Deferred |
| 19.5 | Media Takedown | Operator gallery takedown verified in disposable Supabase CI; dashboard, notices and other media remain open |
| 19.6 | Impersonation Handling | Deferred |
| 19.7 | Phishing Detection | Deferred |
| 19.8 | Malware Link Checks | Deferred |
| 19.9 | Fraud Signals | Deferred |
| 19.10 | Rate-Limit Management | Deferred |
| 19.11 | Suspension And Ban | Deferred |
| 19.12 | Time-Limited Restrictions | Deferred |
| 19.13 | Immutable Audit Trail | Deferred |
| 19.14 | Legal Hold Policy | Deferred |
| 19.15 | Data Export Requests | Deferred |
| 19.16 | Support Ticket Notes | Deferred |
| 19.17 | Transparent Enforcement Reasons | Deferred |

## 20. PUBLIC API AND DEVELOPER PLATFORM

| ID | Capability | Status |
| --- | --- | --- |
| 20.1 | Api Keys With Scopes | Deferred |
| 20.2 | Oauth Application Registration Where Justified | Deferred |
| 20.3 | Profile Read Api | Deferred |
| 20.4 | Link Management Api | Deferred |
| 20.5 | Webhooks For Profile Updates | Deferred |
| 20.6 | Signature Verification | Deferred |
| 20.7 | Pagination | Partially implemented |
| 20.8 | Rate Limits | Deferred |
| 20.9 | Sdk Examples | Deferred |
| 20.10 | Openapi Schema | Deferred |
| 20.11 | Sandbox Environment | Deferred |
| 20.12 | Developer Docs | Deferred |
| 20.13 | Key Rotation | Deferred |
| 20.14 | Api Audit Log | Deferred |
| 20.15 | Versioning And Deprecation Policy | Deferred |

## 21. PERFORMANCE AND RELIABILITY

| ID | Capability | Status |
| --- | --- | --- |
| 21.1 | Server-Side Caching | Deferred |
| 21.2 | Edge Cdn For Public Pages | Deferred |
| 21.3 | Cache Invalidation On Publish | Deferred |
| 21.4 | Database Indexes | Tested locally |
| 21.5 | Connection Pooling | Deferred |
| 21.6 | Background Queue | Deferred |
| 21.7 | Request Timeouts | Partially implemented |
| 21.8 | Circuit Breakers | Deferred |
| 21.9 | Image Optimisation | Partially implemented |
| 21.10 | Lazy Embeds | Deferred |
| 21.11 | Code Splitting | Partially implemented |
| 21.12 | Load Testing | Deferred |
| 21.13 | Graceful Degradation | Partially implemented |
| 21.14 | Slo Dashboards | Deferred |
| 21.15 | Error Budgets | Deferred |
| 21.16 | Recovery Drills | Deferred |

## 22. PRIVACY AND LEGAL

| ID | Capability | Status |
| --- | --- | --- |
| 22.1 | Uk Gdpr Data Inventory | Deferred |
| 22.2 | Privacy Notice | Deferred |
| 22.3 | Cookie Consent Where Needed | Deferred |
| 22.4 | Consent Withdrawal | Deferred |
| 22.5 | Subject Access Export | Deferred |
| 22.6 | Deletion Workflow | Deferred |
| 22.7 | Retention Schedule | Deferred |
| 22.8 | Processor Inventory | Deferred |
| 22.9 | Data Residency Documentation | Deferred |
| 22.10 | Age-Appropriate Safeguards | Deferred |
| 22.11 | Copyright Notice Process | Deferred |
| 22.12 | Acceptable Use Policy | Deferred |
| 22.13 | Terms Of Sale | Deferred |
| 22.14 | Refund/Cancellation Policy | Deferred |
| 22.15 | Privacy-Friendly Analytics Defaults | Deferred |

## 23. ACCESSIBILITY AND INTERNATIONALISATION

| ID | Capability | Status |
| --- | --- | --- |
| 23.1 | Wcag 2.2 Aa Target | Partially implemented |
| 23.2 | Keyboard Navigation | Partially implemented |
| 23.3 | Focus Management | Deferred |
| 23.4 | Screen-Reader Labels | Partially implemented |
| 23.5 | Semantic Headings | Partially implemented |
| 23.6 | Colour Contrast | Partially implemented |
| 23.7 | Touch Target Sizing | Partially implemented |
| 23.8 | Reduced Motion | Partially implemented |
| 23.9 | Captions And Transcripts | Deferred |
| 23.10 | Locale-Aware Dates | Deferred |
| 23.11 | Uk English Default | Tested locally |
| 23.12 | Rtl-Ready Layout | Deferred |
| 23.13 | Screen Zoom Support | Partially implemented |
| 23.14 | Form Error Summaries | Partially implemented |
| 23.15 | Accessible Charts | Deferred |
| 23.16 | Non-Colour-Only Status Indicators | Partially implemented |
