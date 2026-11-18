# Design overhaul — 18 November 2026

Source: the owner's Downloads/DESIGN.md, read in full. Styling/markup and presentation interactions only. Keep routes, API, auth/billing/data/analytics operations unchanged. No new dependencies.

Scope: global tokens/styles; existing shared shell, controls and messages; editor/avatar/deletion navigation; public widgets; home preview and availability UI; templates; authentication presentation; analytics display; gallery/folders; history; plan/gifts. Existing form names, IDs, labels, upload validation, revision protection and service calls remain the contracts. Browser tests must follow visible tabs/disclosures.

Tasks, in order:

1. Foundation — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
2. Tabbed Studio and sticky preview/actions — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
3. Public profile consent disclosures — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
4. Home claim/preview/steps/FAQ/footer. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
5. Twelve template presentations. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
6. Shared auth layout and password presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
7. Analytics hierarchy, chart and disclosures. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
8. Gallery/folders presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
9. History presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.
10. Plan/gifts presentation. — implemented; lint/typecheck/192 unit+SQL/two policy/build passed after this task. Final browser verification pending.

Run lint, typecheck, unit/SQL tests and build after each task. Final browser/accessibility/mobile checks cover the changed user journeys.

Decisions: preserve the live accent and existing profile themes. Move UI colours into tokens; do not rewrite historical migrations, validated palette values, test fixtures or standalone brand assets merely to satisfy a repository-wide colour grep. That would conflict with the instruction to preserve the data model and existing profile rendering.

Owner authorises drafting footer/policy content. Use only implemented behaviour; missing legal operator/contact details remain clearly marked TODO(owner). Do not invent company identity, approved prices, URLs, reviews, users or statistics. Keep policies on existing home-page anchors so no routes are added. Actual production legal/tax readiness remains an existing release gate.

Task 8 boundary: the existing upload description is editable. Saved-item alt editing is not advertised: the existing actions have no metadata-edit operation, and adding one would violate presentation-only scope.

Policy drafting reference: https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/are-you-transparent-about-how-you-use-peoples-data/ — missing operator/contact facts are not invented.

Verification: final lint/typecheck/194 Vitest/two policy/build pass. Initial local Edge smoke/axe passed 15 with seven provider skips; expanded home/password/template checks and pinned Lighthouse 13.6.0 are running. CI runs Lighthouse on /, /templates, /sign-in and an authenticated disposable /studio fixture; only scores are retained, temporary fixture-cookie/report files are removed. The tool is fetched ephemerally and no dependency manifest/lockfile was changed.

CI 44225645050 verified Lighthouse 100 on all four required routes but failed a redundant visual-picker group label; fixed in 098c088. CI 44226574841 progressed to dragging and found a handle obscured by the sticky toolbar; shared scroll-margin clearance fixes the product interaction without changing reorder logic. Both failed runs are retained as failure evidence, not counted as passing. Final verification pending.

CI 44227690374 passed desktop dragging but failed touch reordering after an open row menu. The phone grid now gives the handle its own column, and action menus close after selection. Sort/save algorithms remain unchanged. Final source now has 195 unit/SQL tests; final CI is still required.
