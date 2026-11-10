# Deploy to Render Free

This deployment is gated on successful local-stack provider E2E, approval of public launch, and valid private GitHub and Supabase access. Production remains unverified.

1. Merge the reviewed source and `render.yaml` into the private repository’s `main` branch after CI succeeds.
2. In Render, select **New → Blueprint**, connect GitHub, grant access to the private repository, then choose `main`. Check that the plan creates exactly one **Free** web service.
3. Enter the exact initial site origin and the Supabase URL and keys from [setup-supabase.md](setup-supabase.md). For staging, use the assigned Render hostname as the site origin and add its specific Auth redirect URLs.
4. Apply the Blueprint. For manual setup, choose **New → Web Service**, select the private repo and branch, select Frankfurt and **Free**, use the Node runtime and the commands from `render.yaml`, and set health path to `/health/live`. Configure **After CI Checks Pass**.
5. Inspect the deploy event and test both health routes. Verify a complete signup and publish path and repeat after a restart. Run checks with separate staging and production projects.
6. Add `www.snoozer.uk` as the primary custom domain. Follow the record instructions shown by Render for both hostnames. Render documents redirecting the paired apex to `www` when `www` is added first. Wait for TLS, verify the apex redirect and canonical profile metadata, update the site origin and Auth settings, then redeploy.
7. Use **Manual Deploy** for a known commit when troubleshooting. Roll back the service to a previously healthy deploy only if its code works with the live schema. Use forward-fix migrations after additive schema changes and test the rollback path before launch.

Health liveness does not depend on Supabase. Readiness checks the public Data API and avatar bucket with a bounded request. Measure a real cold start and check both routes after release.

[Render web services](https://render.com/docs/web-services) · [Render custom domains](https://render.com/docs/custom-domains)
