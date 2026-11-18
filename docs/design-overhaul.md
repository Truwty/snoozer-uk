# Design overhaul — 18 November 2026

Source: the owner's Downloads/DESIGN.md, read in full. Styling/markup and presentation interactions only. Keep routes, API, auth/billing/data/analytics operations unchanged. No new dependencies.

Scope: global tokens/styles; existing shared shell, controls and messages; editor/avatar/deletion navigation; public widgets; home preview and availability UI; templates; authentication presentation; analytics display; gallery/folders; history; plan/gifts. Existing form names, IDs, labels, upload validation, revision protection and service calls remain the contracts. Browser tests must follow visible tabs/disclosures.

Tasks, in order:

1. Foundation — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
2. Tabbed Studio and sticky preview/actions — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
3. Public profile consent disclosures — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
4. Home claim/preview/steps/FAQ/footer. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
5. Twelve template presentations. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
6. Shared auth layout and password presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
7. Analytics hierarchy, chart and disclosures. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
8. Gallery/folders presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
9. History presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.
10. Plan/gifts presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. See final verification below.

Run lint, typecheck, unit/SQL tests and build after each task. Final browser/accessibility/mobile checks cover the changed user journeys.

Decisions: preserve the live accent and existing profile themes. Move UI colours into tokens; do not rewrite historical migrations, validated palette values, test fixtures or standalone brand assets merely to satisfy a repository-wide colour grep. That would conflict with the instruction to preserve the data model and existing profile rendering.

Owner authorises drafting footer/policy content. Use only implemented behaviour; missing legal operator/contact details remain clearly marked TODO(owner). Do not invent company identity, approved prices, URLs, reviews, users or statistics. Keep policies on existing home-page anchors so no routes are added. Actual production legal/tax readiness remains an existing release gate.

Task 8 boundary: the existing upload description is editable. Saved-item alt editing is not advertised: the existing actions have no metadata-edit operation, and adding one would violate presentation-only scope.

Policy drafting reference: https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/are-you-transparent-about-how-you-use-peoples-data/ — missing operator/contact facts are not invented.

Verification: local lint/typecheck/195 Vitest/two policy/build/audit pass. Expanded public Edge smoke/axe/360px coverage passed 19 with seven provider-dependent skips; public Lighthouse scores are 100. Pinned Lighthouse 13.6.0 is used. CI runs Lighthouse on /, /templates, /sign-in and an authenticated disposable /studio fixture; only scores are retained, temporary fixture-cookie/report files are removed. The tool is fetched ephemerally and no dependency manifest/lockfile was changed.

CI 44225645050 verified Lighthouse 100 on all four required routes but failed a redundant visual-picker group label; fixed in 098c088. CI 44226574841 progressed to dragging and found a handle obscured by the sticky toolbar; shared scroll-margin clearance fixes the product interaction without changing reorder logic. Both failed runs are retained as failure evidence, not counted as passing. Final verification pending.

CI 44227690374 passed desktop dragging but failed touch reordering after an open row menu. The phone grid now gives the handle its own column, and action menus close after selection. Sort/save algorithms remain unchanged. Final source now has 195 unit/SQL tests; final CI is still required.

CI 44228794454 passed both drag paths and reached taking a page offline. It found the moved Unpublish form nested inside the editor form. Unpublish is now a sibling alongside deletion settings, restoring the existing server action without modifying it. A browser assertion guards against nested forms. Final CI pending.

CI 44230235615 passed on e57efb4: secret scan, dependency audit, lint/typecheck, 195 Vitest, two policy tests, build and 22 browser/HTTP checks with one expected missing-secret skip. Lighthouse accessibility scored 100 on /, /templates, /sign-in and the authenticated /studio fixture. The first four failed runs above are not counted as passing. Test-only commit 0527ef1 adds all existing page routes and all five editor panels to 360px overflow checks; final CI and hosting evidence follow.

Hosted visual review found the separate Settings grid row was displaced by the tall preview. Grouping the editor form and its sibling Settings actions in one left column keeps the safe form boundary and places Settings directly below its tabs. A viewport assertion guards this presentation regression.

Final source d2748eb passed CI 44232517177: lint/typecheck, secret scan, dependency audit, 195 Vitest unit/SQL tests, two audit-policy tests, production build, 25 browser/HTTP checks and one expected missing-secret skip. All existing pages and five Studio panels pass 360px overflow checks. Automated axe checks cover public/account pages and key owner/visitor journeys. Lighthouse accessibility is 100 on /, /templates, /sign-in and authenticated /studio. This is automated accessibility evidence, not a claim of full manual assistive-technology certification. Earlier 0527ef1 also passed CI 44230712644. e14f6e6 CI was superseded/cancelled, not counted as passing.

Final hosted chart review aligned sparse daily groups with the first/last date labels using flex spacing and the axis gutter. Recorded values, ordering and collection remain unchanged. Final layout-only follow-up requires matching CI/deployment evidence below.
