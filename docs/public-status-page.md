# Public status page

The public status page is served at https://status.snoozer.uk/ and remains available at https://snoozer.uk/status. It is deliberately separate from the authenticated Owner Control Centre.

## Domain routing

The status subdomain is a host alias for the existing Snoozer web service, not a second application. Requests to the subdomain root are rewritten internally to /status; status API and Next.js assets remain on that host. Other site paths redirect to the main Snoozer site.

Render service currently used by the workspace:

- Service: snoozer-uk-staging
- Render hostname: snoozer-uk-staging.onrender.com

To activate the custom hostname, add status.snoozer.uk to the Render service's Settings -> Custom Domains, then add this DNS record in IONOS:

| Type | Hostname | Points to |
| --- | --- | --- |
| CNAME | status | snoozer-uk-staging.onrender.com |

Remove any AAAA record for the status host if present. Do not change the root snoozer.uk records or mail-related DNS records. Once DNS has propagated, verify the domain in Render; Render provisions HTTPS automatically.

## Public checks

- Snoozer website: serving this page confirms that the application is responding.
- Database and media storage: the non-destructive readiness probe checks the public username lookup RPC and required private storage buckets. Only a pass/fail result is exposed.
- Render, Supabase and Stripe: the page displays each provider's public status indicator. These are platform-wide signals and do not prove the health of Snoozer's individual provider account or every feature.

The page does not expose credentials, internal error messages, Owner metrics, account data, provider request details or deployment configuration. The JSON snapshot is available at /api/status and is marked no-store.

## Bug reports

Visitors can submit a report from the status page. The API validates and bounds each field, accepts an optional follow-up email only when supplied by the visitor, stores a keyed HMAC of the source address (never the raw address), and rate-limits each fingerprint to three reports per hour. A honeypot silently discards simple bot submissions. Reports are private to the Owner Control Centre and are not exposed through the public Data API.

Owner staff can review recent reports at Owner -> System and set their status to New, Reviewing, Resolved or Ignored. Status changes require verified Owner MFA (AAL2).

## Incident history and refresh

The existing hourly production-health workflow raises one public GitHub issue when monitored production probes fail and closes it after a passing recovery check. The page reads only incident lifecycle timestamps from issues with the exact monitor alert title. It does not expose issue bodies, comments or workflow diagnostics. The incident feed is cached for one minute; if GitHub cannot be reached, the page reports that the feed is unavailable rather than showing a false empty history.

Live checks run during page rendering and the browser refreshes the snapshot every minute. Scheduled production probes run hourly. The status page is exempt from visitor-facing maintenance mode.
