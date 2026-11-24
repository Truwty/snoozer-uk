#requires -Version 7.0
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repository = "Truwty/snoozer-uk"
$CloneUrl = "https://github.com/$Repository.git"
$NewPublicEmail = Read-Host "Enter the GitHub noreply email shown in https://github.com/settings/emails"
if ($NewPublicEmail -notmatch "^[^\s@]+@users\.noreply\.github\.com$") {
    throw "Use the GitHub-provided users.noreply.github.com address. Do not use a personal email."
}
$PublicAuthorName = Read-Host "Public commit author name (press Enter for Snoozer Maintainers)"
if ([string]::IsNullOrWhiteSpace($PublicAuthorName)) { $PublicAuthorName = "Snoozer Maintainers" }

foreach ($tool in @("git", "gh", "git-filter-repo", "gitleaks")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing required tool: $tool. Install Git, GitHub CLI, git-filter-repo and Gitleaks before running this script."
    }
}
& gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) { throw "Authenticate GitHub CLI first with: gh auth login" }
& gh auth setup-git
if ($LASTEXITCODE -ne 0) { throw "Could not configure Git to use GitHub CLI credentials." }

$visibility = & gh api "repos/$Repository" --jq ".visibility"
if ($LASTEXITCODE -ne 0) { throw "Could not read repository metadata." }
Write-Host "Current repository visibility: $visibility"
Write-Host "This script does not change repository visibility."

$openHeads = @(& gh pr list --repo $Repository --state open --json headRefName --jq ".[].headRefName")
if ($LASTEXITCODE -ne 0) { throw "Could not read open pull requests; refusing to delete branches blindly." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$root = Join-Path $env:TEMP "snoozer-public-history-$stamp"
$mirror = Join-Path $root "snoozer-uk.git"
$scan = Join-Path $root "scan-worktree"
$mailmapPath = Join-Path $root "mailmap.txt"
$replacePath = Join-Path $root "replace-text.txt"
$messagePath = Join-Path $root "replace-messages.txt"
New-Item -ItemType Directory -Path $root | Out-Null

Write-Host "Creating a local mirror backup at $mirror"
& git clone --mirror $CloneUrl $mirror
if ($LASTEXITCODE -ne 0) { throw "Mirror clone failed. Nothing on GitHub was changed." }

$authorEmails = @(& git -C $mirror log --all --format=%ae)
$committerEmails = @(& git -C $mirror log --all --format=%ce)
$emails = @($authorEmails + $committerEmails | Where-Object { $_ } | Sort-Object -Unique)
$privateEmails = @($emails | Where-Object { $_ -notmatch "@users\.noreply\.github\.com$" })

$mailmapLines = @()
foreach ($oldEmail in $privateEmails) {
    Write-Host "Commit history contains: $oldEmail"
    $answer = Read-Host "Map this address to the GitHub noreply identity above? Type YES to map"
    if ($answer -cne "YES") {
        throw "No history was rewritten. Map every non-noreply author/committer email before continuing."
    }
    $mailmapLines += "$PublicAuthorName <$NewPublicEmail> <$oldEmail>"
}
if ($mailmapLines.Count -gt 0) {
    Set-Content -LiteralPath $mailmapPath -Value $mailmapLines -Encoding utf8
}

# Public-safe replacements for historical documentation and commit-message residue.
$replaceRules = @(
    'regex:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}==>[redacted email]',
    'regex:\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b==>[redacted test identifier]',
    'regex:\bsrv-[a-z0-9]{20,}\b==>[redacted service id]',
    'regex:\bdep-[a-z0-9]{20,}\b==>[redacted deployment id]',
    'regex:\b(?:sk|rk)_live_[A-Za-z0-9_]{12,}\b==>[redacted Stripe secret]',
    'regex:\bwhsec_[A-Za-z0-9_]{20,}\b==>[redacted webhook secret]',
    'regex:\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b==>[redacted GitHub token]',
    'regex:\bsb_secret_[A-Za-z0-9_]{20,}\b==>[redacted Supabase secret]',
    'regex:\bacct_[A-Za-z0-9]{10,}\b==>[redacted Stripe account id]',
    'regex:\bwe_[A-Za-z0-9]{10,}\b==>[redacted Stripe webhook id]',
    'regex:\bprod_[A-Za-z0-9]{10,}\b==>[redacted Stripe product id]',
    'regex:\bprice_[A-Za-z0-9]{10,}\b==>[redacted Stripe price id]',
    'regex:\bcs_(?:test|live)_[A-Za-z0-9_-]{12,}\b==>[redacted Checkout session id]',
    'literal:edgptbiwswcdmmxzwhxv==>[redacted Supabase project ref]',
    'literal:snoozer-uk-staging.onrender.com==>[redacted staging host]',
    'literal:profile-qa.snoozer.uk==>[redacted test subdomain]',
    'regex:\bShae Smith\b==>the repository owner',
    'regex:(?mi)^[^\r\n]*(?:sole trader|not VAT registered|VAT[- ]taxable turnover|taxable turnover|below £90,000|under £90,000)[^\r\n]*$==>[redacted private operator tax information]'
)
Set-Content -LiteralPath $replacePath -Value $replaceRules -Encoding utf8
Set-Content -LiteralPath $messagePath -Value $replaceRules -Encoding utf8

Write-Host "Pre-rewrite Gitleaks scan across every reachable branch and tag..."
& gitleaks git "--log-opts=--all --full-history" --redact --no-banner --verbose $mirror
if ($LASTEXITCODE -ne 0) {
    throw "Gitleaks found a possible secret or could not complete. Stop, inspect the redacted finding locally, rotate any real credential, and do not publish."
}

$localBranches = @(& git -C $mirror for-each-ref refs/heads --format="%(refname:strip=2)")
if ($LASTEXITCODE -ne 0 -or $localBranches -notcontains "main") {
    throw "Could not verify the release branch. Nothing on GitHub was changed."
}

$keep = @("main") + @($openHeads | Where-Object { $_ }) | Sort-Object -Unique
$keep = @($keep | Where-Object { $localBranches -contains $_ })
Write-Host "Branches to preserve: $($keep -join ', ')"
Write-Host "All other branch refs will be deleted. Open PR heads are preserved automatically."

Write-Host ""
Write-Host "WARNING: this rewrites Git commit IDs and removes all non-preserved branch refs."
Write-Host "A mirror backup is retained at: $mirror"
$confirm = Read-Host "Type REWRITE AND DELETE to continue"
if ($confirm -cne "REWRITE AND DELETE") { throw "Cancelled. GitHub was not changed." }

$filterArgs = @("-C", $mirror, "filter-repo", "--force", "--replace-text", $replacePath, "--replace-message", $messagePath)
if ($mailmapLines.Count -gt 0) { $filterArgs += @("--mailmap", $mailmapPath) }
& git @filterArgs
if ($LASTEXITCODE -ne 0) { throw "git-filter-repo failed. Do not force-push; inspect the backup mirror." }

$branchesAfterFilter = @(& git -C $mirror for-each-ref refs/heads --format="%(refname:strip=2)")
foreach ($name in $branchesAfterFilter) {
    if ($keep -notcontains $name) {
        & git -C $mirror update-ref -d "refs/heads/$name"
        if ($LASTEXITCODE -ne 0) { throw "Could not remove local ref $name from the rewritten mirror." }
    }
}
$branchesAfterFilter = @(& git -C $mirror for-each-ref refs/heads --format="%(refname:strip=2)")
foreach ($name in $keep) {
    if ($branchesAfterFilter -notcontains $name) {
        throw "Expected preserved branch $name is missing after rewrite."
    }
}

Write-Host "Post-rewrite Gitleaks scan across all retained Git history..."
& gitleaks git "--log-opts=--all --full-history" --redact --no-banner --verbose $mirror
if ($LASTEXITCODE -ne 0) { throw "Post-rewrite history scan failed. Nothing has been force-pushed." }

& git clone --no-hardlinks $mirror $scan
if ($LASTEXITCODE -ne 0) { throw "Could not create the scan worktree." }
foreach ($name in $keep) {
    & git -C $scan checkout --force $name
    if ($LASTEXITCODE -ne 0) { throw "Could not check out preserved branch $name for file scanning." }
    Write-Host "Scanning current files on $name..."
    & gitleaks dir --redact --no-banner --verbose $scan
    if ($LASTEXITCODE -ne 0) { throw "Current-tree scan failed on $name. Nothing has been pushed." }
}

# git-filter-repo intentionally removes remotes; add the original remote back explicitly.
& git -C $mirror remote add origin $CloneUrl
if ($LASTEXITCODE -ne 0) { throw "Could not restore origin remote." }

Write-Host "All pre-push scans passed. Rewriting retained remote branch history..."
foreach ($name in $keep) {
    $refspec = "refs/heads/" + $name + ":refs/heads/" + $name
    & git -C $mirror push --force origin $refspec
    if ($LASTEXITCODE -ne 0) { throw "Force-push failed for $name. Stop and inspect the mirror backup." }
}
& git -C $mirror push --force --tags origin
if ($LASTEXITCODE -ne 0) { throw "Tag push failed. Inspect the mirror backup and remote tags." }

$remoteBranches = @(& gh api --paginate "repos/$Repository/branches?per_page=100" --jq ".[].name")
if ($LASTEXITCODE -ne 0) { throw "Could not list remote branches after rewrite." }
foreach ($name in $remoteBranches) {
    if ($keep -notcontains $name) {
        Write-Host "Deleting experimental branch: $name"
        & gh api --method DELETE "repos/$Repository/git/refs/heads/$name"
        if ($LASTEXITCODE -ne 0) { throw "Remote branch deletion failed for $name. Some branches may remain." }
    }
}

$verified = @(& gh api --paginate "repos/$Repository/branches?per_page=100" --jq ".[].name")
if ($LASTEXITCODE -ne 0) { throw "Could not verify final branch list." }
$unexpected = @($verified | Where-Object { $keep -notcontains $_ })
if ($unexpected.Count -gt 0) {
    throw "Unexpected branches remain: $($unexpected -join ', ')"
}

Write-Host ""
Write-Host "History rewrite and experimental-branch cleanup completed."
Write-Host "Preserved branches: $($verified -join ', ')"
Write-Host "Local pre-rewrite backup retained at: $mirror"
Write-Host "Repository visibility has NOT been changed."
