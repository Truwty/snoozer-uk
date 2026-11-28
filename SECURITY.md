# Security policy

Snoozer.uk handles account identities, private drafts, profile media, analytics data and subscription records. Security reports are welcome and should be handled privately.

## Supported code

The latest code on the default `main` branch is the only actively supported development line. There are no separately maintained release branches or versioned security-support guarantees before v1.0.

A fix is not considered released merely because it exists on a feature branch or in an open pull request. The release process requires review, passing CI and an authorised deployment.

## Reporting a vulnerability

**Do not** report security vulnerabilities through public GitHub Issues, Discussions, pull requests or social media.

Preferred route:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability** to create a private GitHub Security Advisory.
3. Include the affected commit or route, impact, prerequisites and a minimal reproduction using test accounts and test data.

Do not include access tokens, passwords, payment details, private user content or unnecessary personal data. Redact any credential from screenshots and logs.

If private vulnerability reporting is unavailable, contact the repository maintainer through the private contact route shown on the maintainer's GitHub profile. Do not use a public issue as a fallback.

## Scope

The repository's security boundary includes:

- Supabase Auth sessions, OAuth/PKCE callbacks, MFA and account switching.
- Owner authorization and the AAL2 requirement for sensitive administrative actions.
- PostgreSQL functions, grants, RLS and Storage bucket policies.
- Next.js Server Actions, API routes, public profile rendering and custom-domain routing.
- Media upload, processing, download and account export.
- Stripe and Ko-fi webhook verification, replay handling and billing entitlements.
- Discord presence ingestion, provider integrations and GitHub Actions.
- Dependency, build and deployment configuration.

Third-party provider infrastructure and unrelated self-hosted deployments are not controlled by this project. Reports should still explain when a third-party integration creates an exploitable Snoozer boundary.

## Safe research

Good-faith testing is authorised only against an instance and data you control, or where the maintainer has given explicit written permission. Use disposable accounts and local/test provider credentials.

Do not:
- access, alter, enumerate or export another person's data;
- test denial-of-service, destructive upload or payment attacks against the live service;
- create real charges, refunds, disputes or account bans as a proof of concept;
- persist access after the test or disclose a vulnerability before a fix is coordinated.

## Response

The maintainer will acknowledge reports as soon as reasonably practical, validate the issue, agree a remediation and disclosure plan, and publish a security advisory when appropriate. No fixed response-time or remediation SLA is guaranteed for this pre-v1.0 project.

## Current security posture

The latest repository and connected Supabase review is recorded in [docs/security-audit.md](docs/security-audit.md). That report distinguishes verified controls from configuration items that still require operator action. A clean CI run is not a guarantee that the service is unhackable.
