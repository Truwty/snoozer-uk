# Public status page

Snoozer's public status page is available at \`/status\`. It is deliberately separate from the authenticated Owner Control Centre.

## Public checks

- **Snoozer website:** serving the status page confirms that the application is responding.
- **Database and media storage:** the same non-destructive readiness probe used by \`/health/ready\` checks the public username lookup RPC and required private storage buckets. Only a pass/fail result is exposed.
- **Render, Supabase and Stripe:** the page displays each provider's public status indicator. These are platform-wide signals and do not prove the health of Snoozer's individual provider account or every feature.

The page does not expose credentials, internal error messages, Owner metrics, account data, provider request details or deployment configuration. The JSON snapshot is available at \`/api/status\` and is marked no-store.

## Incident history

The existing hourly production-health workflow raises one public GitHub issue when monitored production probes fail and closes it after a passing recovery check. The page reads only the incident lifecycle timestamps from issues with the exact monitor alert title. It does not expose issue bodies, comments or workflow diagnostics. The incident feed is cached for one minute; if GitHub cannot be reached, the page reports that the feed is unavailable rather than showing a false empty history.

## Refresh and maintenance

Live checks run during page rendering and the browser refreshes the snapshot every minute. Scheduled production probes run hourly. The \`/status\` page is exempt from visitor-facing maintenance mode so users can still see service information while public application pages are paused.
