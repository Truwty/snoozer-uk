# Repository governance

Snoozer is developed in the open. The default branch is the release branch; feature work should use short-lived branches and pull requests.

## Contribution rules

- Do not commit credentials, environment files, customer information, production identifiers, database exports or private operational notes.
- Use disposable local services and synthetic data for automated testing.
- Keep provider credentials in the deployment platform's secret manager.
- Require review and passing quality checks before release.
- Treat feature branches as unreleased until merged and independently deployed.
- Report security vulnerabilities privately using GitHub's Security Advisories feature where available; do not publish exploit details in issues.

## Releases

Database changes must be versioned as migrations and validated against a clean disposable database. Hosted migrations and application deployments are separate release steps and must be explicitly reviewed.

## Security checks

The CI workflow scans the checked-out files and reachable Git history with Gitleaks. A finding must be investigated and removed; real exposed credentials must also be revoked or rotated with their provider.
