# Dependency audit review — 17 November 2026

The [GitHub-reviewed picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) was updated on 17 November 2026 and lists no patched version. The full npm audit reports 16 high findings through the same root advisory and development dependency chains. `npm audit --omit=dev` reports zero vulnerabilities in this lockfile.

Exposure: malicious single-branch repeated extglob patterns can cause regex denial of service. Snoozer uses these packages through Vitest, Vite and ESLint tooling, with repository-controlled patterns, not visitor-submitted patterns. Do not enable a network-exposed Vite/Vitest development server or feed profile fields into glob tooling. This review does not claim the dependency is fixed.

CI runs `npm run audit`, which performs both full and production JSON audits. It fails for any production advisory, any additional root advisory, invalid/unavailable audit responses and this exception on or after **1 December 2026 UTC**. Only GHSA-fc5q-39xc-vjpf in picomatch is temporarily accepted through development dependency chains. Tests exercise unknown advisories, production exposure, response failure and expiry.

Check the upstream advisory for a supported patched release, update the lockfile, run the full regression suite and remove the exception. Do not use npm's proposed forced Vitest downgrade as evidence of a security fix: the advisory lists no patched picomatch.
