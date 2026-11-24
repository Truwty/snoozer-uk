# Snoozer project status

Snoozer is an actively developed, pre-1.0 profile publishing platform built with Next.js, TypeScript and Supabase.

## Release policy

- `main` is the release branch.
- Changes are released only after review, automated validation and deployment checks.
- Feature branches and open pull requests are proposals, not production-release evidence.
- Database schema changes are delivered through ordered migrations and must be validated against a disposable local database before production rollout.
- Production changes are deployed separately from source-control changes; a successful merge alone does not prove deployment.

## Current development

Public Creator Discovery is under development in [pull request #101](https://github.com/Truwty/snoozer-uk/pull/101). It is not part of a release until its review and release gates are complete.

## Project capabilities

The platform includes profile publishing, customisation, analytics, widgets, moderation and account-management workflows. See the individual guides in this directory for feature behaviour and development setup.

## Contributing

Read [CONTRIBUTING.md](../CONTRIBUTING.md), run the checks documented there, and avoid committing environment files, credentials, private user data, operational identifiers or local test artefacts.
