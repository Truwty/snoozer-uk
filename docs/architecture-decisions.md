# Architecture decisions

- Public provider summaries are optional, origin-checked and bound to current published links. Fetch fixed provider API hosts without credentials/visitor headers, retain only versioned minimal projections, and use PostgreSQL refresh leases, hourly budgets and provider backoff. Keep provider failure independent of outbound navigation. Twitch players require a real parent hostname and 400×300 space; smaller views keep the outbound link.

- Analytics starts with consented anonymous event totals, never fingerprinted visitors. Use daily PostgreSQL aggregates with expiring per-event receipts and service-only writes. Exclude owners with server-validated Auth; owner-scoped RPCs and CSV exports enforce plan retention. Keep direct link navigation independent of analytics availability. Do not label event ratios as CTR or event IDs as unique people.

- Start from an empty workspace. Use one stateless Next.js App Router service with React, strict TypeScript, Tailwind and npm. Organise server modules by domain as the application expands.
- Use Supabase Auth and Storage and PostgreSQL through the Supabase Data API. Versioned SQL owns constraints, RLS and transactional RPCs. Avoid a second ORM migration history or persistent application-side connection pool.
- Keep drafts owner-only. Store immutable snapshots separately and publish by switching a pointer in the same transaction. Check expected revision under a row lock and use a unique canonical username constraint. Public reads return only published fields.
- Begin with one profile and 20 ordered links. Add entitlements centrally before expanding quotas. Defer aliases and username changes until names can be reserved across all routes.
- Use private upload staging and server-validated raster derivatives for avatars and galleries. Plan durable jobs in Postgres for cleanup and provider reconciliation. No runtime disk, paid worker or Redis required.
- Build for private GitHub and Render Free. Keep migrations under explicit release control. Launch checks must capture cold starts, project pauses, quota pressure and webhook recovery.
- Keep media folder organisation independent of the draft revision and publication snapshots. Folder mutations use an owner scope, separate revision and a profile row lock. Images remain governed by draft and history reachability.
- Share one profile renderer between Studio previews, history and live pages. Persist named appearance choices, validate them in both TypeScript and PostgreSQL, and snapshot them with content. Keep raw CSS and script outside the editor.
- Check published profile existence in the proxy. Missing profiles return a real HTML 404 even with JavaScript disabled. Live profile rendering adds one indexed lookup before loading published content.
