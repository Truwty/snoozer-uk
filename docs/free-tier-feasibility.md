# Free-tier feasibility

Reviewed 10 November 2026. These are documented ceilings and operating characteristics. Actual account eligibility and usage require dashboard verification.

| Provider | Checked characteristics | Impact |
| --- | --- | --- |
| Render Free | 0.1 CPU, 512 MB RAM, 750 instance hours per workspace per month. Service sleeps after 15 minutes of inactivity and typically takes about a minute to wake. Filesystem is ephemeral. Pipeline and bandwidth allowances are workspace-specific. | Keep storage and state in Supabase. Use bounded avatar work and verify restart behavior. Do not market guaranteed uptime or latency. |
| Supabase Free | 50,000 monthly active users, 500 MB database, 1 GB file storage, 5 GB egress plus 5 GB cached egress. Projects may pause after one week of inactivity. Up to two active free projects. | Track usage, limit uploads and separate production from staging. Verify backups and email delivery independently. |
| GitHub Actions | Private repository runner and artifact use counts against the account’s included quota. | Confirm the account allowance and set a budget. Cancel superseded jobs and avoid uploading traces containing credentials or email tokens. |

[Render Free](https://render.com/docs/free) · [Render service types](https://render.com/docs/service-types) · [Supabase pricing](https://supabase.com/pricing) · [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
