# Public Creator Discovery (Feature #30)

## Overview

Discover is an opt-in public directory for published Snoozer profiles. It adds public search, category pages, editor-curated collections and opt-in related-creator suggestions. It is not a marketplace, paid placement system, follower graph or popularity contest.

Creators configure discovery per profile in **Studio → Profile → Discovery**. New profiles and existing profiles default to directory-off. A creator can turn directory visibility off and the profile is removed from directory results, categories, recommendations and curated collections immediately; the public profile itself remains available until separately unpublished or moderated.

## Creator controls

Each profile has independent settings:

- **Directory listing:** default off. Controls public directory and category visibility.
- **Category:** exactly one controlled category: Developers, Designers, Artists, Content creators, Gamers, Streamers, Musicians, Businesses, Communities or Other.
- **Interests:** up to five tags from the finite allow-list in \`src/lib/discovery.ts\`. Free-form HTML or arbitrary taxonomy values are not accepted.
- **Related creators:** default off. A profile can be recommended only when both the source and candidate have opted into directory listing and recommendations.
- **Views Leaderboard:** a separate explicit preference. Existing records use a nullable migration state that follows the published snapshot's historic \`indexable\` choice until the creator saves an explicit leaderboard preference. This preserves existing behaviour without conflating search-engine indexing and directory listing.

Discovery settings are separate from the profile content draft and immutable publication snapshots. They can be updated without publishing the profile again.

## Public presentation

- \`/discover\`: category links, curated collection shelves and the searchable directory.
- \`/discover/category/[category]\`: a validated category landing page with search, interests and pagination.
- \`/discover/collections/[slug]\`: a public editorial collection.
- Public profile pages may show a Related Creators section when the source and recommended profiles have both opted in.
- The card's verified-domain mark indicates only that Snoozer's custom-domain verification flow currently reports a ready domain. It is not an identity check, endorsement or guarantee of the creator's conduct.

Cards show only published display name, username, public biography, public avatar, selected category/interests and the verified-domain boolean. They do not show emails, account IDs, drafts, visitor analytics, follower numbers, presence data or moderation records.

## Search and ordering

Search is capped at 80 characters and a maximum of 24 displayed profiles per page. The SQL RPC returns at most 25 rows so the server can determine whether a next page exists. Cursor pagination uses stable tuples:

- Relevance: rank score, publication activation timestamp and username.
- Recently joined: activation timestamp and username.
- Name: username.

Relevance uses exact username, username prefix, exact display name, display-name prefix, username/display-name substring, biography and selected interest text. Category and interest filters are allow-listed. There is no ranking by views, clicks, analytics, follower counts, Premium status or paid placement. Pagination is bounded and cursors are validated before reaching SQL.

## Collections and moderation

The Owner Control Centre provides MFA-gated collection creation, editing, scheduling, publishing and deletion. A collection has a public slug, title, bounded description, sort order, optional start/expiry times and at most 20 explicitly ordered usernames. Every chosen member must be published, activated, opted in and unrestricted when the collection is saved.

The public collection reader rechecks eligibility on every request. A stale membership cannot bypass a creator's opt-out, unpublication or a current moderation/account restriction. Reports use the existing verified-account profile report route and moderation queue; discovery does not create a second reporting or quarantine system.

## Database and RPC security

Migrations:

- \`20261124095000_public_creator_discovery.sql\`
- \`20261124095001_public_discovery_query_fixes.sql\`
- \`20261124095002_discovery_rate_limits_and_preferences.sql\`
- \`20261124095003_discovery_tag_search.sql
- `20261124095004_discovery_slug_bounds.sql`
- `20261124095005_discovery_new_profile_defaults.sql`
- `20261124095006_discovery_prefix_search_indexes.sql`\`

Private tables live in the \`snoozer\` schema, have RLS enabled and direct privileges revoked. Public metadata is returned only through bounded SECURITY DEFINER readers with fixed empty search paths. Creator settings writes verify the authenticated owner inside the database. Collection writes call \`snoozer.admin_actor(true)\`, requiring a registered platform owner and AAL2 MFA, and write an audit event.

Directory and collection reads are called from server-only code using the service role; public callers cannot invoke the discovery listing RPCs directly with the Supabase anon key. Each server request supplies a keyed HMAC derived from the ingress network address. The private database counter permits at most 180 reads per minute per fingerprint and removes old window records after two hours. The raw network address is not written to that table. This abuse-control fingerprint is not used for analytics, advertising or ranking.

## Privacy, legal and help content

The Privacy Policy describes the fields displayed after opt-in and the short-lived abuse-prevention fingerprint. Terms explain opt-in, accuracy, reporting, no paid placements, no fake traffic and the limited meaning of verified-domain status. The Help Centre explains how to list or remove a profile.

Turning off Discover does not change SEO indexing, the public profile URL or consent-based analytics. The Views Leaderboard preference is independent from directory membership.

## Operational notes

- No migrations in this feature are applied to the hosted Supabase project by this implementation.
- Render auto-deploy remains disabled; no Render deployment is part of the feature branch.
- No third-party seller, creator commerce, tips, subscriptions or paid placements are included.
- Block/mute and follower/DM features remain out of scope.
