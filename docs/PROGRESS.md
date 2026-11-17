# Progress — 17 November 2026

## Current checkpoint

Stages 0–3 have passed their recorded core/staging checks. **Stage 4 remains in progress.** Analytics collection, daily view/click totals, charts and owner-only CSV export are implemented in this working increment. Local lint, typecheck, 125 unit/SQL tests and production build pass. Disposable Supabase browser/HTTP verification and staging rollout are pending. The chronological notes below include older, superseded limitations.

Stage 3's signed provider sandbox journeys closed at the latest checkpoint below. Live billing, production rollout and advanced abuse controls remain open.

## Implemented

- Next.js App Router with React, TypeScript and Tailwind. Render Free Blueprint, Dockerfile, CI, environment template, threat model and operational guides.
- Supabase email/password signup, explicit verification, sign-in, reset and logout. Configured templates for the local CLI stack and hosted setup instructions.
- Atomic username claim, availability lookup and reserved routes. One page per verified account and 20 ordered links per page.
- Owner-only drafts, three themes, live responsive preview, optimistic revision checks, immutable published snapshots, unpublish, link sharing, canonical metadata and opt-in indexing.
- Twenty SQL migrations under `supabase/migrations`. Private avatar staging, signed direct upload, bounded raster decoding, WebP generation, private derivatives and active-publication checks.

- Permanent profile deletion retires the username and queues media cleanup. Replacement profiles have separate storage and reject stale editor writes. See [avatar cleanup](avatar-cleanup.md).

- Milestone 2 started with owner-only publish history, version previews and restore to draft. Publishing a restored draft creates a new publication. The current live page stays in place until then.

- Studio saves valid drafts after a one-second pause. It retains edits made while a save is pending and lets owners copy unsaved edits or load the saved version after a revision conflict. Publishing and avatar removal remain explicit.

- The avatar cleanup worker also sweeps processed files older than 24 hours on active profiles when neither the draft nor a retained publication references them.

- Avatar staging uses a distinct key for each attempt. Studio expires attempts after 24 hours and permits 12 new attempts per UTC day per profile. Discard and completion retire the old key, and cleanup can remove expired staged files safely.

- Studio supports undo and redo for profile fields and links during the current editor session, including edits already autosaved. Keyboard focus follows added, moved and removed links.

- Studio text sections support headings and multiline plain text. The editor can add, reorder and remove up to six sections, with autosave and undo. Publishing and history restore include ordered section snapshots.
- Studio and the public gallery include three first-party templates. Creators can preview privately, apply colours alone, or add starter text when their draft has no sections.

- Studio offers wide, 375 px and 320 px previews. Profile card spacing and type respond to the card width so a phone preview on a desktop follows the same rules as the public page.

- Studio image galleries support private uploads, draft reordering and removal, and publication snapshots. The media worker now clears expired gallery attempts and unreferenced assets. An operator command blocks gallery images across draft, live page and retained history, with a recorded case reference. See [Studio image gallery](image-gallery.md).

- Studio now has private media folders for current draft and retained history images. Folder operations use their own revision and leave public gallery order unchanged. See [Studio image gallery](image-gallery.md).

- Studio sections now support Text, Callout and Quote. Callouts and attributed quotes use the shared preview, public renderer and publication history. See [Studio sections and templates](studio-sections.md).

- Card spacing and corners use built-in choices shared by Studio and public pages. Appearance settings are saved in drafts, included in immutable publications and restored with history.

- The Editorial layout uses a split avatar and title at wider card widths and a single column on phones. It uses the existing appearance save and restore flow.

- Studio offers Mint, Rose and Ink link accents. It displays the measured contrast of the chosen link text and background. The shared renderer selects black or white text for each accent.

- Studio has a Countdown section with a UTC target, a readable date in server HTML and a minute-by-minute preview. The target is saved and restored with publish history.

- Studio can hide any section from the public profile. The editor and owner history retain the content. The public profile response contains only visible sections from the active publication.

- Studio sections and links have a drag handle for pointer reordering alongside the keyboard move buttons. A completed drag is a single undoable edit.

- Studio warns when the draft gallery's estimated decoded memory exceeds 12 MiB and links to image management. The advisory leaves save and publish available.

- Studio owners can lock a valid section to prevent accidental edits, dragging or removal. The lock is undoable and retained in private publish history.

- Studio can export and apply a versioned appearance code containing the theme, layout, spacing, corners and link accent. Applying a code is one undoable draft edit.

- The gallery accepts a single image dropped onto the upload form. The file picker, image description, validation and explicit Upload action remain available.

- Media folders can add an image retained in publish history back to the draft gallery. This reuses the existing file and respects the eight-image limit.

- Studio offers a background entrance fade. Drafts and publications retain the choice. Reduced motion keeps the background static.

## Verification evidence

| Command | Evidence | Result |
| --- | --- | --- |
| `npm test` | `tests/profile.test.ts`, `tests/avatar.test.ts`, `tests/database.test.ts`. Canonical names, malformed links and image rejection, actual SQL migration constraints, cross-owner denial, revision conflicts, publication and avatar isolation. | 13 passed locally after adding deletion, queue and version restore coverage |
| `npm run lint`, `npm run typecheck`, `npm run build` | ESLint, Next route types, strict TypeScript and production compiler. | Passed |
| `npm audit` | Locked production and development dependency tree. Resolved the initial development minimatch advisory via a scoped override. | 0 reported vulnerabilities |
| `npm run test:e2e -- --workers=2` with `PLAYWRIGHT_CHANNEL=msedge` | Six homepage widths, anonymous Studio redirect, liveness and four mobile axe scans. Fixed the brand label mismatch and reran. | 12 passed, 2 provider tests skipped |
| [GitHub Actions 42831324792](https://github.com/Truwty/snoozer-uk/actions/runs/42831324792) | Disposable Supabase with actual Auth and Storage. Version restore and republish, authenticated Studio and public-page axe scans, profile deletion, signed upload after deletion, and worker cleanup that preserves the replacement profile’s files. | 13 unit/SQL tests and 14 browser tests passed |
| [GitHub Actions 42832744852](https://github.com/Truwty/snoozer-uk/actions/runs/42832744852) | Autosave persistence, public-page isolation, changes made during an in-flight save and conflict recovery across two tabs. | 13 unit/SQL and 15 browser tests passed |
| [GitHub Actions 42833454025](https://github.com/Truwty/snoozer-uk/actions/runs/42833454025) | Processed avatar sweep migration and worker on disposable Supabase. SQL tests cover aged orphan selection, draft and history protection, and access control. | Passed |
| [GitHub Actions 42908138432](https://github.com/Truwty/snoozer-uk/actions/runs/42908138432) | Disposable Supabase verified signed upload replay after discard, replacement staging and profile cleanup. SQL tests cover stage expiry and the per-profile attempt limit. | 16 unit/SQL and 15 browser tests passed |
| [GitHub Actions 42908876092](https://github.com/Truwty/snoozer-uk/actions/runs/42908876092) | Current Studio and asset baseline. Verified keyboard reordering, focus following the moved link, undo and redo across autosaves, stale-tab recovery, upload replay isolation and profile cleanup. | 16 unit/SQL and 15 browser tests passed |
| [GitHub Actions 42922122949](https://github.com/Truwty/snoozer-uk/actions/runs/42922122949) | Template gallery and Studio selection, starter application, section ordering, literal HTML-like text, publish and history restore. | 17 unit/SQL and 16 browser tests passed |
| [GitHub Actions 42922738910](https://github.com/Truwty/snoozer-uk/actions/runs/42922738910) | Full disposable Supabase suite, with browser comparison of Studio and public card widths and title sizes at 320 and 375 pixels. | 17 unit/SQL and 16 browser tests passed |
| Local gallery verification | Raster orientation, metadata stripping, disguised and animated input rejection, pixel limits, owner-only media access, snapshot ordering, restore, cleanup selection, upload quotas and idempotent takedowns. | 22 unit/SQL tests and 13 browser smoke tests passed locally; four provider tests skipped locally |
| [GitHub Actions 42924787549](https://github.com/Truwty/snoozer-uk/actions/runs/42924787549) | Initial gallery run: signed upload and disguised raster rejection reached the expected UI, but the test matched both the validation alert and the Next.js navigation announcer. The assertion now targets the validation message. | 20 unit/SQL and 16 of 17 browser tests passed |
| [GitHub Actions 42925475389](https://github.com/Truwty/snoozer-uk/actions/runs/42925475389) | Verified valid upload, draft isolation, reorder, publication, removal and retained private access. The takedown test read the Studio preview URL before client navigation finished; the test now loads the public page explicitly and checks the media path. | 22 unit/SQL and 16 of 17 browser tests passed |
| [GitHub Actions 42926076818](https://github.com/Truwty/snoozer-uk/actions/runs/42926076818) | Full suite on disposable Supabase verified signed uploads, private buckets and readiness, reorder and publish, retained history access, and the operator command blocking both public and owner image routes. | 22 unit/SQL and 17 browser tests passed |
| Local folder verification | Embedded PostgreSQL checks validation, cross-owner access, stale folder revisions, profile replacement, unfiling on deletion, and unchanged public snapshots. | 23 unit/SQL tests passed locally |
| [GitHub Actions 42927327264](https://github.com/Truwty/snoozer-uk/actions/runs/42927327264) | Private folders verified on disposable Supabase: create, move, filter after reload, rename and delete at phone width, axe scan and no change to public gallery order or metadata. | 23 unit/SQL and 17 browser tests passed |
| Local section types | Real SQL rejects unknown types and preserves text, callout and quote order through draft changes, publish and restore. | 23 unit/SQL tests passed locally |
| [GitHub Actions 42927900939](https://github.com/Truwty/snoozer-uk/actions/runs/42927900939) | Callouts and quotes preview, publish and restore against disposable Supabase, alongside the private folder regressions. | 23 unit/SQL and 17 browser tests passed |
| Local appearance verification | SQL rejects unknown keys and values, accepts old save requests, keeps draft choices private and restores snapshot values. | 24 unit/SQL tests passed locally |
| [GitHub Actions 42928490301](https://github.com/Truwty/snoozer-uk/actions/runs/42928490301) | Appearance controls, phone preview parity, reduced motion and history restore against disposable Supabase. | 24 unit/SQL and 17 browser tests passed |
| Local editorial layout | The migration accepts existing two-field appearance objects and rejects unknown or malformed layout values. SQL tests verify publication isolation and restore. | 24 unit/SQL tests passed locally |
| [GitHub Actions 43024795782](https://github.com/Truwty/snoozer-uk/actions/runs/43024795782) | Editorial layout rendered in two columns on wider cards and matched Studio at 320 and 375 px. The layout was restored from publish history. | 24 unit/SQL and 17 browser tests passed |
| Local link accent verification | Unit tests check known contrast ratios and the three preset pairs. SQL tests reject arbitrary colour values and verify draft isolation and restore. | 26 unit/SQL tests and 13 browser smoke tests passed locally |
| [GitHub Actions 43025481392](https://github.com/Truwty/snoozer-uk/actions/runs/43025481392) | The browser test's Theme selector also matched the new Use theme colours option. A local Chromium check reproduced the ambiguity and confirmed the exact accessible combobox name identifies the intended control. | 26 unit/SQL and 16 of 17 browser tests passed |
| [GitHub Actions 43026274391](https://github.com/Truwty/snoozer-uk/actions/runs/43026274391) | Full browser rerun verified computed link colours on published profiles, Studio contrast feedback and history restore. | 26 unit/SQL and 17 browser tests passed |
| Local countdown verification | Unit tests cover leap dates, minute rounding and expiry. SQL tests reject invalid targets and preserve the target during publishing and restore. | 28 unit/SQL tests passed |
| [GitHub Actions 43027685605](https://github.com/Truwty/snoozer-uk/actions/runs/43027685605) | Countdown preview and expiry, published UTC date with JavaScript disabled, and history restore verified on disposable Supabase. | 28 unit/SQL and 17 browser tests passed |
| Local section visibility verification | SQL tests cover draft and public isolation, anonymous and cross-owner denial, boolean validation and history restore. | 29 unit/SQL tests passed |
| [GitHub Actions 43028391980](https://github.com/Truwty/snoozer-uk/actions/runs/43028391980) | Verified hidden sections leave the live page after publish, restore preserves visibility, and countdown still renders and expires correctly. | 29 unit/SQL and 17 browser tests passed |
| [GitHub Actions 43029507928](https://github.com/Truwty/snoozer-uk/actions/runs/43029507928) | Section drag, cancellation outside the list, focus, undo and redo, published order and history restore. | 29 unit/SQL and 17 browser tests passed |
| [GitHub Actions 43030266457](https://github.com/Truwty/snoozer-uk/actions/runs/43030266457) | Shared section and link reordering, including an emulated touch drag at phone width, focus and published link order. | 29 unit/SQL and 17 browser tests passed |
| Local gallery budget verification | Estimates cover empty galleries, images below budget, the exact threshold and a gallery over budget. | 31 unit/SQL tests passed locally |
| [GitHub Actions 43031015136](https://github.com/Truwty/snoozer-uk/actions/runs/43031015136) | Gallery memory advisory appears above the budget, clears after removal and stays out of public HTML. | 31 unit/SQL and 17 browser tests passed |
| [GitHub Actions 43032220212](https://github.com/Truwty/snoozer-uk/actions/runs/43032220212) | Section locks verified for disabled fields, undo and redo, public projection and history restore. A README update superseded the first run. | 32 unit/SQL and 17 browser tests passed |
| Local appearance transfer | Versioned code round trip and validation, including exclusion of profile content. | 34 unit/SQL tests passed locally |
| [GitHub Actions 43032802421](https://github.com/Truwty/snoozer-uk/actions/runs/43032802421) | Clipboard copy, malformed code rejection, valid draft application and undo verified alongside the section lock regressions. | 34 unit/SQL and 17 browser tests passed |
| [GitHub Actions 43033253649](https://github.com/Truwty/snoozer-uk/actions/runs/43033253649) | Gallery drop selection, multiple-file rejection and explicit signed upload alongside the file picker path. | 34 unit/SQL and 17 browser tests passed |
| [GitHub Actions 43106675082](https://github.com/Truwty/snoozer-uk/actions/runs/43106675082) | Reused a retained image through Media folders, verified it stayed private until publishing, and checked stale revisions, the gallery limit, duplicates and ownership in SQL. | 34 unit/SQL and 17 browser tests passed |
| [GitHub Actions 43107185551](https://github.com/Truwty/snoozer-uk/actions/runs/43107185551) | Profile background fade, reduced motion and Studio regressions against disposable Supabase. | 34 unit/SQL and 17 browser tests passed |
| Render JSON Schema | Validated the Blueprint against the public Render schema. | Passed. Render deployment remains unverified. |
| `npx --yes supabase@3.1.0 start` | The local stack requires a container engine. | Blocked locally. Docker and Podman unavailable. |

The embedded PostgreSQL tests execute the actual application migrations with small adapters for Supabase-specific roles and catalogues. They do not verify hosted Auth, Storage or network behaviour. [GitHub Actions run 42827654246](https://github.com/Truwty/snoozer-uk/actions/runs/42827654246) passed all 10 unit/SQL tests and 14 browser tests against disposable Supabase. It covered registration through publishing and password recovery, concurrent claims, and direct storage denial.

The first deletion CI run caught accessible names on Studio reorder buttons that differed from their visible labels. The labels were corrected. A later run stalled on optional Ubuntu font downloads, so CI now installs only the headless Chromium binary on the hosted runner.

## Milestone 3 — Monetisation in progress

- Migration 20261110002100 seeds version 1 of Free, Plus, Pro and Studio in typed relational columns. The owner-only plan RPC resolves active grants by tier, version and expiry, falling back to Free. Grant records and provider references remain private.
- Studio now displays the current tier, grant expiry when applicable, published profiles and draft links. The typed server-side policy checks ownership, grant expiry, feature access and quota boundaries.
- Local lint, type checking, dependency audit and all 35 unit/SQL tests passed. The Edge smoke run passed 13 browser tests. The [private main CI run](https://github.com/Truwty/snoozer-uk/actions/runs/43108591062) passed all 35 unit/SQL and 17 browser tests, including the private Free tier and usage page against disposable Supabase. CI also passed the source secret scan, dependency audit, lint, type checks and production build.
- Existing profile writes still enforce one profile and 20 links. Ko-fi creator features and live readiness remain open.

- Added a Stripe sandbox webhook with the official SDK, bounded raw request handling, signature verification and private deduplicated receipts. The receipt stores IDs and timestamps for later reconciliation. Added a private versioned GBP Stripe price catalogue with retirement and current-offer lookup.
- Local checks passed 40 unit and SQL tests and 14 browser or HTTP tests. Four browser cases require disposable Supabase. Lint, type checks and the production build passed. A Stripe sandbox delivery and end-to-end purchase remain unverified. See [Stripe sandbox setup](stripe-sandbox.md).

- The authenticated Plan and usage page can start sandbox Checkout for configured offers. It verifies the Stripe price against the catalogue, binds the customer and session to one verified account, and reuses idempotency keys on creation retries. Attempt replacement and the provider round trip remain pending. The local unit and SQL suite passed 41 tests.

- Verified sandbox Checkout completion receipts now resolve to a saved session, and the server checks the session, customer and account against Stripe before storing the subscription binding. The binding and receipt marker are committed together. Unmatched receipts remain available for replay. All 42 local unit and SQL tests passed. Subscription state reconciliation and access changes remain pending.

- Sandbox subscription reconciliation now reads current Stripe state for bound Checkout, subscription and invoice events. It grants access only for the mapped active subscription with a paid invoice and withdraws access when it no longer qualifies. It limits access to the paid period or scheduled cancellation, whichever ends first. Database revision checks reject stale results. Local verification passed 49 unit and SQL tests. Refunds and disputes, automated reconciliation of missed events and the real Stripe sandbox round trip remain open.

- Added an owner-only Stripe sandbox Billing Portal action for accounts with linked subscriptions. The app generates the session server-side with a fixed Studio return URL. Invoice history and cancellation are provided by the configured Stripe portal. The real sandbox portal journey remains unverified.
- Added Ko-fi GBP donation intake with form and token validation, duplicate protection and private receipt storage. Payments remain unclaimed. Local verification passed 63 unit and SQL tests. See [Ko-fi webhook setup](kofi-webhook.md).

- Stripe sandbox refund, dispute and early fraud warning events now create invoice holds through verified provider relationships. The current held invoice cannot sustain a plan grant. Duplicate events and older held invoices do not prevent a later eligible renewal. The conservative sandbox policy holds partial refunds and retains holds after disputes. Provider delivery and automatic release after dispute resolution remain unverified or pending. Local verification passed 65 unit and SQL tests.

- Added operator recovery of missed Stripe sandbox events by ID. The endpoint retrieves the canonical event directly from Stripe and uses the same validation and reconciliation path as webhook delivery. Automated event discovery and sandbox verification remain open.
- A verified Stripe expiry now lets an account replace a bound, unpaid Checkout attempt, preserving the prior session in history and reusing its customer. Completed subscriptions and attempts without a saved session are outside this replacement flow. Local verification passed 69 unit and SQL tests.

- Added an opt-in Stripe sandbox subscription sweep with bounded leases, aggregate drift reporting and a GitHub Actions schedule. It corrects grant drift from current Stripe state for linked subscriptions. The configured provider run and recovery of unreceived refund, dispute and Checkout events still need verification or replay. Local verification passed 70 unit and SQL tests.

- Added recovery for Checkout attempts without a saved Stripe session. After the recovery window, Snoozer looks up any matching session. A completed match is rebound for webhook replay. A confirmed expiry or a complete lookup with no match permits replacement. The database rejects late writes to retired attempts. All 74 local unit and SQL tests passed. Real Stripe recovery remains unverified.

- Stripe sandbox reconciliation now archives canceled and incomplete-expired subscriptions, revokes their grants and allows a replacement Checkout with the same customer. Billing Portal remains available to the owner for previous invoices. Local verification passed 76 unit and SQL tests. Real provider cancellation and resubscription remain unverified.

- Studio supports adding direct Ko-fi profiles as ordered support links with an editable label. The shared profile renderer identifies Ko-fi in preview and publication, and the home footer can link to the platform Ko-fi profile. Local verification passed 83 unit and SQL tests. A disposable Supabase browser scenario now checks the Studio-to-public flow.

- Verified users can request and track a platform Ko-fi donation review. The queue is private and submission does not reveal whether a receipt exists. An authorised operator can confirm after independently verifying the payer, or decline. Confirmation locks the receipt against reuse, persists its use marker after account deletion, and leaves plan access unchanged. Local verification passed 84 unit and SQL tests. The disposable Supabase browser scenario also includes submission and pending status.

- Added operator-issued single-use gift codes, authenticated redemption and service-only revocation. Codes are stored as hashes and grants expire after the configured duration. Added aggregate billing diagnostics for authorised operators. Local verification passed 86 unit and SQL tests. A disposable Supabase browser scenario covers redemption. See the later sandbox paid-gift checkpoint. See [Billing operations](billing-operations.md).

- Added a read-only staff billing diagnostics page. The database verifies the current staff role and records successful web reads. SQL tests cover anonymous and ordinary-account denial, access logging and immediate revocation. Local verification passed 87 unit and SQL tests. Disposable Supabase browser coverage was added.

- Added one-time GBP sandbox gift Checkout, verified fulfillment, owner-only gift retrieval and payment holds. Refund or dispute events can block issuance or revoke an issued gift and its grant. The purchaser sees the code only after payment confirmation. Local verification passed 90 unit and SQL tests. The real Stripe sandbox purchase, refund and cross-account redemption need provider verification.

- Stripe sandbox now releases the matching subscription invoice hold when the provider confirms a won dispute. Independent refund and fraud holds remain active, and late or repeated events cannot recreate the released hold. Earlier invoice holds and paid gift disputes still require manual review. Stripe dispute IDs now use the provider's du_ prefix. Local verification passed 92 unit and SQL tests.

- New Stripe sandbox gift disputes have separately tracked payment holds. A won outcome can restore the original code or its unexpired grant after checking the remaining holds. Replays preserve other refund and fraud holds and operator revocations. Legacy gift holds remain in manual review. Local verification passed 93 unit and SQL tests. Provider delivery remains unverified.

- Added a service-only, paginated legacy hold report and disposable CI fixtures for signed Stripe and Ko-fi requests against the application routes. The [disposable CI run](https://github.com/Truwty/snoozer-uk/actions/runs/43929950654) passed 94 unit and SQL tests and 18 browser or HTTP checks, including both payment webhook fixtures. The no-secrets Stripe smoke case was skipped because fixture signing values were configured. The connected Stripe account list exposes no sandbox account, and the local host lacks Docker, Podman and provider environment configuration. Real provider verification remains open.

- Added a provider preflight for the isolated billing environment. It validates required settings and probes Stripe sandbox and Supabase using read-only calls. In the current workspace it correctly stopped at the missing configuration check without contacting either provider.

- Subscription and gift Checkout now share the sandbox grant configuration check. Expired gift sessions are recorded without triggering the subscription expiry workflow. Regression coverage exercises the disabled grant setting and an expired gift receipt.

- Billing diagnostics now distinguish known gifts awaiting fulfillment from receipts without a billing link. Completed gifts no longer appear in the unresolved receipt count.

- Plan and usage displays the current Studio limits even when a paid grant is active. The paid-grant browser journey checks the enforced link count. Tier-specific quotas remain a release dependency.

- Added plan-specific link limits at draft save, publication and history restore. A downgrade preserves existing links and publications. The app supports up to 2,000 links per profile, and the Server Action body limit now accommodates larger drafts.

## Remaining

- The private `Truwty/snoozer-uk` repository was created and the source was pushed. The first CI run passed concurrent claims and cross-user storage denial. Its full browser journey reached avatar upload and draft save, then caught a blank HTTP 404 for unpublished profiles with JavaScript disabled. The fix returned a readable 404 in a local HTTP regression check and passed the full CI rerun.
- Hosted Supabase configuration, transactional email, Render Free deployment, restart testing, domain/TLS, capacity benchmarks and recovery rehearsal are unverified.
- Configure hosted cleanup scheduling and extend abuse controls. Additional theme controls, interactive blocks and media types remain tracked in the feature ledger. The wider moderation dashboard, notices and appeals remain open in the [feature ledger](feature-ledger.md).

- Migration 20261110004400 measures retained avatar and gallery bytes from Supabase Storage and enforces the active plan quota at upload initiation and completion. A downgrade preserves stored images and blocks uploads while usage exceeds the allowance. Studio shows measured usage and warns at 85%. Temporary originals remain bounded by staging limits and expire. Existing gallery, library and per-file limits still apply. The embedded suite passed 98 tests. The disposable Supabase suite adds a browser check that stored images appear on the usage meter. Real payment provider verification remains blocked by missing isolated configuration.

- Migration 20261110004500 assigns existing and new profiles a stable UUID independent of account ownership and media paths. The verified owner can see their draft and published profiles in Plan and usage. Embedded SQL tests cover identity stability through publishing and inventory isolation. Multiple profiles remain disabled while the draft, publication and cleanup operations still use the account as their profile key.

- Migration 20261110004600 backfills profile IDs on links, text sections, media folders, gallery items and publication snapshots. The foreign keys enforce matching account ownership and prevent publication child rows from referring to another profile's revision. Existing writers still populate the IDs during the transition. The embedded upgrade fixture publishes a page before the migration and checks its links and live page afterward.

- Migration 20261110004700 reads draft content, public profiles and publication history by stable profile ID. Authenticated callers can request a specific profile and only receive rows owned by their verified account. Existing Studio routes call the compatibility functions. Anonymous pages resolve the live revision by public username, omit hidden sections and exclude blocked gallery images. Added an embedded regression for owner access, cross-account denial and anonymous publication visibility.

- Migration 20261110004800 moves saves, publishing, unpublishing and restores to profile IDs and retains the existing RPC signatures for compatibility. Studio submits the draft UUID and revision on those actions. Publishing locks by account and checks the proposed live profile count against the active plan. Added a regression for cross-account writes, stale revisions and the selected-profile save, restore and unpublish sequence.

- Migration 20261110004900 binds Studio avatar upload, processing and profile deletion to the profile ID and authenticated account. Avatar publication and cleanup look up snapshots by profile ID, while media quota checks cover retained bytes across the account. Embedded SQL coverage verifies permission boundaries, stale deletion protection and the cleanup scope.

- Migration 20261110005000 and Studio use profile IDs for gallery uploads, ordering, retained image reuse and media folders. Gallery serving, moderation and cleanup resolve references by profile. Plan and usage sums retained bytes across owned media scopes. Added SQL coverage for selected-profile upload and folder permissions.

- Migration 20261110005100 replaces owner-only keys with profile-scoped keys for drafts, media and publication records. The SQL suite exercises two profiles on one account, independent links and publication revisions, Free and Plus allowances, and downgrade recovery. Studio accepts a verified profile selection through Plan and usage, the editor, gallery, folders and publish history. The onboarding claim RPC still permits a single profile.

- Migration 20261110005200 and Plan and usage let eligible accounts claim and switch between profiles. The database serializes claims by account, enforces the active plan’s profile allowance and disables legacy implicit mutations permanently after a second claim. Bare Studio opens the oldest remaining profile. The SQL regression exercises Free denial, Plus claims up to the allowance, downgrade preservation and rejection of legacy writes. A disposable Supabase browser case covers claiming, publishing and switching.

- GitHub Actions run 43975909389 reached the disposable Supabase browser suite. The creator journey failed because the exact draft label locator also saw the adjacent Edit link. Plan and usage now renders the draft label as its own element. Lint, type checking and the production build passed locally. Real billing verification remains gated on isolated provider configuration.

- Run 43976779652 reached the new Plus journey and confirmed the second profile appeared in Studio. The browser assertion matched both the header and preview. The test now checks the handle inside the Page preview region.

- [CI run 43977313274](https://github.com/Truwty/snoozer-uk/actions/runs/43977313274) passed on 9fee313. It ran 105 unit and SQL tests and 19 browser or HTTP checks against disposable Supabase, including the Plus claim, publish and switch journey and the full creator journey. The missing-Stripe-secret test was skipped because the fixture signing secret was configured.

- Migration 20261110005300 lets the billing preflight verify the configured Stripe subscription and gift prices and the Billing Portal settings. The database test confirms retired prices are excluded and ordinary accounts cannot read the preflight catalogue. The local preflight stopped at missing isolated configuration before contacting providers.

- [CI run 43978342636](https://github.com/Truwty/snoozer-uk/actions/runs/43978342636) applied migration 20261110005300 to disposable Supabase and passed on 29de544. It ran 105 unit and SQL tests and 19 browser or HTTP checks. One test that expects an unconfigured Stripe signing secret was skipped because CI used a fixture secret.

- Hosted staging is available at https://snoozer-uk-staging.onrender.com on Render Free. Applied all 53 migrations to the dedicated Supabase Free project snoozer-staging. Both liveness and readiness returned HTTP 200. Supabase Auth points to the staging origin with exact confirmation and recovery redirects, email confirmation and a 12-character password minimum. Hosted Supabase requires custom SMTP to install the repository email templates on this Free project.

- Billing preflight can now check Stripe or Ko-fi independently. The default still checks both. Local lint and a loopback fixture passed provider selection, rejection of unknown arguments, missing Stripe settings, and Ko-fi diagnostic access without Stripe credentials. The Stripe connector listed the live Lingua account only. Ko-fi dashboard access was verified, but no provider event was sent. Real provider verification remains open.

- Verified Stripe test mode in the Dashboard. Created the Plus monthly subscription and one-off gift test offers and the staging snapshot webhook for all 12 supported events. The application credentials, staging catalogue mappings, portal and provider journey verification are still pending. See [Continuation](CONTINUE.md).

- Verified both 399p offers in the staging Supabase preflight catalogue. The gift mapping uses 30 days. Created active test-only Stripe Billing Portal bpc_1Ucd4UIqN5aCtEjClHQVA6vA (invoices, payment method updates, cancel at period end, plan switching disabled). Configure this ID as STRIPE_SANDBOX_PORTAL_CONFIGURATION in Render staging. Test API key, webhook signing secret and a staging gift secret must be installed before enabling grants. Provider delivery and purchase verification remain open.

- Render staging deployed with the Stripe test API and webhook settings, portal configuration, a staging gift secret, and sandbox grants enabled. Stripe Workbench expired an unpaid setup-mode Checkout session and delivered checkout.session.expired to staging. The first delivery and manual resend both returned HTTP 204. Supabase returned exactly one receipt for evt_1UcdB8IqN5aCtEjCAvxuSB63 after replay. This verifies signed intake and deduplication. The test made no payment and did not verify the app API key, Checkout fulfillment, portal sessions, or Ko-fi. Next use a verified staging test account to complete the paid sandbox journeys and verify Ko-fi dashboard delivery.

- Hosted Stripe staging verification: a new confirmed fixture account bought the £3.99 Plus monthly offer with a Stripe test card. Snoozer granted Plus. The Billing Portal showed the invoice and scheduled cancellation for the end of the billing period. The fixture then bought the £3.99 30-day gift. A second confirmed fixture redeemed the issued code (Free to Plus). Refunding the gift in Stripe test mode revoked the recipient grant (Plus to Free). Both accounts are staging fixtures. The Ko-fi verification token is installed in Render staging and the previously empty Ko-fi webhook URL now points there. Ko-fi dashboard single-tip test was attempted after deployment, with zero receipts observed. The current single-tip sample is Donation in USD, while Snoozer currently accepts only GBP donations. Do not count this as verified GBP receipt delivery. Remaining provider checks include GBP Ko-fi receipt and replay, Stripe renewal and dispute lifecycle.

- Ko-fi staging now stores GBP and USD donations in the original minor units, with existing rows defaulting to GBP. Deployed 905d93c after manually applying migration 20261110005400 to staging. The Ko-fi dashboard single-tip test produced one USD 300-cent receipt in Supabase. Repeating the dashboard test still left one receipt. SQL regression coverage verifies currency preservation, access control and deduplication. No real donation was made. Stripe renewal and dispute verification remain open. A billing anchor reset through Workbench did not produce a distinct invoice, so use a dedicated Stripe test-clock customer for the renewal check.

- Stripe dispute staging check passed. A Sandbox gift payment made with the product-not-received test card was held, and no code was issued while the dispute was active. Stripe confirmed the simulated win, Supabase showed the hold released, and replaying the original Checkout completion issued the gift. Stripe renewal is partially verified. A clock attached to the existing test customer produced a distinct subscription_cycle invoice, paid 399p in full, and Snoozer recorded invoice.paid. The simulated period starts after staging PostgreSQL real time, and the reconciliation guard withheld the future-period grant. Use a fresh test clock started in the past and advance only up to real time for the entitlement check. Never weaken the paid-period guard to pass a sandbox simulation.

- Stage 3 staging exit passed on 17 November 2026. A dedicated Stripe Sandbox test clock started 35 days in the past. A confirmed staging fixture completed the actual Snoozer Checkout, then the clock advanced through renewal and stopped before real time. Stripe issued a distinct £3.99 subscription_cycle invoice with nothing outstanding. Supabase stored one matching signed invoice.paid receipt and an active Plus grant expiring at Stripe’s renewed period end. Studio showed Plus through 13 December 2026. This closes the remaining sandbox renewal check. Stage 4 analytics is next. Live billing activation remains a production release task.
