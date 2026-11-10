# Private source control

The GitHub repository is `Truwty/snoozer-uk`. Private visibility was verified in the UI and through the connector. Use `main` as the release branch and short-lived branches for changes. Never commit real environment files, local test traces, database exports or credentials.

Enable PR review and require the `validate` CI check where the account plan supports private branch protection. For a private GitHub Free repository, use a documented manual review and release process when protection cannot be enforced. Grant Render’s GitHub integration access to this repository only. Review Actions billing and configure a budget for the account.

[Private repository](https://github.com/Truwty/snoozer-uk) · [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
