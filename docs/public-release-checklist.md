# Public repository release checklist

This checklist is separate from production deployment. It does not make the repository public, apply database migrations or change hosting.

## Included in this hardening branch

- Public-facing replacements for internal progress and continuation notes.
- Redaction of operational identifiers from feature documentation.
- An MIT licence and an updated README.
- CI Gitleaks checks for checked-out files and reachable Git history.
- A guarded PowerShell script for full history rewriting and branch cleanup.

## Before publication

1. Review the documentation changes and ensure no owner-only, customer-specific or deployment-specific records remain.
2. Install Git, GitHub CLI, `git-filter-repo` and Gitleaks on a trusted workstation.
3. Authenticate GitHub CLI with an account that can push to this repository.
4. Run `scripts/prepare-public-release.ps1` in PowerShell 7.
5. Review the author and committer email addresses it finds. Map each personal address to the GitHub-provided `users.noreply.github.com` address. Do not use a personal email.
6. The script makes a local mirror backup, scans every reachable branch and tag with Gitleaks, rewrites commit metadata and historical text, scans the rewritten history and each retained branch's current files, pushes rewritten `main` and open-PR heads, then deletes branches that are not `main` or the head of an open pull request.
7. Inspect the retained branches and tags on GitHub. Check every open PR after the force-push because commit IDs and review anchors change.
8. Wait for the rewritten-history Gitleaks CI check to pass before considering a visibility change.

## Important limitations

- The script aborts before pushing when Gitleaks reports a finding. Review it locally; if it is a real credential, revoke or rotate it with the issuing provider. Removing a token from Git history does not invalidate it.
- GitHub may reject force-pushes where repository rules or branch protection prohibit them. Resolve that deliberately; do not bypass unrelated protections blindly.
- Open pull-request head branches are preserved automatically. All other branches are deleted.
- Existing public forks, clones, caches, releases and copies cannot be recalled by rewriting the source repository.
- This script does not switch repository visibility or increase any GitHub spending limit.
