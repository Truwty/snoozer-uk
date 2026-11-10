# Continuation

Start in this source directory. Read [PROGRESS.md](PROGRESS.md), [implementation-plan.md](implementation-plan.md), and the original specification. Milestone 1 is active.

1. Check the `CI` workflow in the private `Truwty/snoozer-uk` repository. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm audit`, and `npm run build` in order. Build and type generation both write `.next` and must run sequentially. Run `npm run test:e2e` with Chromium installed. On this Windows host, `$env:PLAYWRIGHT_CHANNEL='msedge'` uses installed Edge.
2. Run `npx --yes supabase@3.1.0 start` on a host with Docker or Podman. It failed here because neither runtime is installed. Follow [setup-supabase.md](setup-supabase.md), export local env values with `SNOOZER_TEST_LOCAL_SUPABASE=1`, rebuild and run the two provider tests in `e2e/supabase.spec.ts`. Check auth emails, valid and invalid uploads, exact-origin Server Actions, signed upload permissions, and concurrent claims. Fix any provider-only failure.
3. Resolve Milestone 1 gaps. Add a profile deletion flow with durable media cleanup and an anti-takeover reservation policy. Verify persistent rate limits, storage cleanup and retry behaviour. Add owner-facing conflict recovery, complete accessibility checks on Studio and published profiles, and record evidence.
4. After Milestone 1 passes, implement editor history/rollback, autosave and asset jobs. Follow the milestone order for Stripe and Ko-fi, analytics, growth, moderation, and launch.
5. Provision a dedicated Supabase Free project, use secure provider config for keys and SMTP, and follow [deploy-render.md](deploy-render.md) for staging. Verify scope and spend limits before provisioning. DNS, domain cutover, test-mode billing, live-mode billing and hosted recovery remain release gates.

No hosted project secrets were used during this milestone. No payment or hosting resources were provisioned.
