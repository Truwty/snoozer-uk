# Snoozer documentation

This directory contains the maintained product, engineering and operations guides. Use this index rather than relying on historical task notes or old implementation plans.

**Documentation review date:** 27 November 2026. Feature guides describe intended contracts; the current source, migrations and CI results remain authoritative where a guide and implementation differ.

## Start here

| Document | Purpose |
| --- | --- |
| [Progress and release state](PROGRESS.md) | Current main-branch and release boundary |
| [Continuation notes](CONTINUE.md) | Concise hand-off for the next engineering session |
| [Feature ledger](feature-ledger.md) | Current product capability inventory |
| [Architecture decisions](architecture-decisions.md) | Cross-cutting engineering decisions |
| [Threat model](threat-model.md) | Assets, trust boundaries and threat controls |
| [Security audit](security-audit.md) | Verified findings, residual risks and operator actions |

## Operations

| Document | Purpose |
| --- | --- |
| [Render deployment](deploy-render.md) | Web service configuration and release procedure |
| [Supabase setup](setup-supabase.md) | Local and hosted database setup |
| [Operations](operations-free-tier.md) | Capacity, monitoring, backup and recovery |
| [Billing operations](billing-operations.md) | Subscription and webhook support |
| [Premium launch](premium-live-launch.md) | Current Snoozer-owned live subscription configuration |
| [Premium acceptance](premium-live-acceptance.md) | Acceptance record and operator attestation |
| [Dependency audit](dependency-audit.md) | npm audit policy and reviewed advisories |
| [Avatar cleanup](avatar-cleanup.md) | Private media cleanup operations |
| [Owner notification email](owner-notification-email.md) | Internal notification delivery |
| [Owner signup hook](owner-signup-hook.md) | Supabase Auth signup hook |
| [Owner administration acceptance](owner-administration-acceptance.md) | Owner panel acceptance evidence |
| [Owner bans and appeals](owner-auth-bans-and-appeals.md) | Restriction and appeal flows |
| [Owner privacy fulfilment](owner20-privacy-fulfilment.md) | Privacy-request operations |
| [Safe erasure](owner20-safe-erasure.md) | Account erasure controls |

## Product and feature guides

| Area | Documents |
| --- | --- |
| Account security and rewards | [Account security](account-security-and-rewards.md), [Google OAuth](google-oauth-setup.md), [referrals](referrals.md) |
| Profiles and Studio | [Profile blocks](profile-blocks.md), [Studio sections](studio-sections.md), [profile templates](profile-templates.md), [profile widgets](profile-widgets.md), [compact public bio](compact-public-bio.md) |
| Discovery and analytics | [Discovery](profile-discovery.md), [analytics](analytics.md), [analytics API](analytics-api.md), [browser methodology](analytics-browsers.md), [campaigns](analytics-campaigns.md), [views leaderboard](views-leaderboard.md) |
| Media and domains | [Custom domains](custom-domains.md), [scheduled publications](scheduled-publications.md), [public widgets](public-widgets.md) |
| Integrations | [Discord presence](discord-presence.md), [Spotify embeds](spotify-integration.md), [YouTube widget](youtube-widget.md), [Ko-fi webhook](kofi-webhook.md), [Stripe sandbox](stripe-sandbox.md) |

## Document rules

- Keep configuration and command examples aligned with `package.json`, `.env.example`, CI and the Render/Supabase configuration.
- Put a review date on operational and security documents; update the index when documents are added, moved or removed.
- Distinguish implementation, automated tests, hosted acceptance and operator attestation. They are not interchangeable.
- Never place live secrets, webhook signatures, customer records or private personal details in documentation.
- Historical migration files and financial records are retained for audit; retired product functionality must not be described as currently available.
- When in doubt, inspect source and migrations first and correct the document instead of guessing.
