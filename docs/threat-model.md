# Threat model

## Trust boundaries

The browser handles input and signed avatar uploads. Next.js Server Actions validate form data, use Next’s Origin checks and resolve accounts via Supabase Auth. Supabase enforces ownership and verified identity independently through constrained RPCs. Only the application server has access to the storage service credential.

## Current controls

- Drafts, links and immutable published snapshots live in a non-exposed SQL schema with RLS enabled. Public RPCs project published fields only. Avatar reads check the active publication. Store and confirm avatars using a single-owner staging path and a server-generated derivative.
- Input is bounded, HTML is escaped by React, and custom link URLs are restricted to HTTP(S) DNS hostnames. Snoozer performs no link-preview fetches. Public DNS can still resolve to private addresses and public sites can serve harmful content. Add reputation reporting before wide launch.
- Account cookies are HttpOnly and SameSite=Lax, with Secure on HTTPS. Recovery and confirmation require an explicit action. Auth service quotas cover basic throttling. Tune them with real traffic and add durable abuse limits.
- CSP uses a per-request nonce and restricts frames, scripts, media origins and form actions. Drafts, session routes and avatar bytes use no-store. Public metadata defaults to noindex.
- Avatar staging and processed buckets are private. Processing allows only bounded, decoded raster files and produces a metadata-stripped WebP. Global processing capacity and malware policies need testing.

## Release risks still open

Add spam controls, moderation, phishing reports, account recovery monitoring, permissioned staff actions, retention/deletion, durable orphan cleanup, quota alarms and infrastructure incident handling. Review content and privacy policies with the owner. Payments must add verified event receipts, replay protection, reconciliation and audited entitlements before they can be offered. Future URL fetchers require DNS/IP and redirect checks at every hop.
