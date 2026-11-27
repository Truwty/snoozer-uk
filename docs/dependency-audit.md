# Dependency security policy

**Reviewed:** 27 November 2026

## Audit contract

CI runs `npm run audit`, which executes two independent npm audit reports:

1. The complete dependency tree, including development tooling.
2. The production dependency tree with development packages omitted.

Both reports must be valid npm audit JSON and must contain **zero vulnerabilities**. An unavailable, malformed or incomplete audit response fails closed. There are no standing advisory exceptions.

Run locally after changing dependencies:

```bash
npm ci
npm run audit
npm ls --all
```

Regenerate `package-lock.json` using npm; do not hand-edit dependency resolutions. Review direct and transitive changes before committing.

## Previously reviewed picomatch advisory

GitHub Advisory `GHSA-fc5q-39xc-vjpf` for picomatch was **withdrawn on 18 November 2026**. The GitHub Advisory Database now identifies it as a withdrawn advisory, not an outstanding vulnerability. The old time-boxed exception in the audit script and its expiry test are therefore obsolete and are removed in this security update.

Sources:
- [GitHub Advisory — withdrawal notice](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
- [Picomatch upstream discussion](https://github.com/micromatch/picomatch/issues/247)

A withdrawn advisory does not mean npm audit can be skipped. The policy remains strict: any current advisory in either the full or production tree must be investigated and fixed or explicitly resolved through an updated authoritative advisory record before release.

## Dependency update procedure

1. Identify the direct dependency and every lockfile path affected.
2. Check the advisory against the upstream maintainer and package registry.
3. Update the direct dependency or approved override; regenerate the lockfile with npm.
4. Run `npm run audit`, lint, typecheck, tests and production build.
5. Confirm the production dependency tree separately.
6. Record any residual exposure in [the security audit](security-audit.md).

Never force a downgrade simply to make an audit command return zero. Do not hide current findings behind a blanket ignore or a long-lived waiver.
