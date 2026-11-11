# Architecture decisions

- Start from an empty workspace. Use one stateless Next.js App Router service with React, strict TypeScript, Tailwind and npm. Organise server modules by domain as the application expands.
- Use Supabase Auth and Storage and PostgreSQL through the Supabase Data API. Versioned SQL owns constraints, RLS and transactional RPCs. Avoid a second ORM migration history or persistent application-side connection pool.
- Keep drafts owner-only. Store immutable snapshots separately and publish by switching a pointer in the same transaction. Check expected revision under a row lock and use a unique canonical username constraint. Public reads return only published fields.
- Begin with one profile and 20 ordered links. Add entitlements centrally before expanding quotas. Defer aliases and username changes until names can be reserved across all routes.
- Use private upload staging and server-validated raster derivatives for avatars and galleries. Plan durable jobs in Postgres for cleanup and provider reconciliation. No runtime disk, paid worker or Redis required.
- Build for private GitHub and Render Free. Keep migrations under explicit release control. Launch checks must capture cold starts, project pauses, quota pressure and webhook recovery.
- Keep media folder organisation independent of the draft revision and publication snapshots. Folder mutations use an owner scope, separate revision and a profile row lock. Images remain governed by draft and history reachability.
- Share one profile renderer between Studio previews, history and live pages. Persist named appearance choices, validate them in both TypeScript and PostgreSQL, and snapshot them with content. Keep raw CSS and script outside the editor.
- Check published profile existence in the proxy. Missing profiles return a real HTML 404 even with JavaScript disabled. Live profile rendering adds one indexed lookup before loading published content.
