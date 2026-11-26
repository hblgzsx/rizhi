param([switch]$SkipWatch)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$repository = 'hblgzsx/rizhi'
function Invoke-Checked {
  param([string]$Program, [string[]]$Arguments)
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). Publishing stopped; no force push was used." }
}
foreach ($program in @('git','gh','node','npm.cmd')) {
  if (-not (Get-Command $program -ErrorAction SilentlyContinue)) { throw "Missing command: $program" }
}
Write-Host 'Checking GitHub account...'
$loginName = & gh api user --jq '.login'
if ($LASTEXITCODE -ne 0) { throw 'GitHub is unreachable or not logged in. Run gh auth login, then retry.' }
if ($loginName.Trim() -ne 'hblgzsx') { throw 'Please switch GitHub CLI to the hblgzsx account before publishing.' }
Invoke-Checked 'npm.cmd' @('test')
Invoke-Checked 'npm.cmd' @('run','build')

$hadLocalGit = Test-Path -LiteralPath (Join-Path $projectRoot '.git')
$remoteExists = $false
if ($hadLocalGit) {
  $gitRoot = & git rev-parse --show-toplevel
  if ($LASTEXITCODE -ne 0 -or [System.IO.Path]::GetFullPath($gitRoot.Trim()) -ne $projectRoot) { throw 'Unexpected Git root. No repository was modified.' }
  $branch = & git branch --show-current
  if ($branch.Trim() -ne 'main') { throw 'Expected the main branch. No branch will be renamed automatically.' }
  $originUrl = & git remote get-url origin 2>$null
  if ($LASTEXITCODE -eq 0) {
    if ($originUrl.Trim() -notmatch '^((https://github\.com/)|(git@github\.com:))hblgzsx/rizhi(\.git)?$') { throw 'Origin points to a different repository. Publishing stopped.' }
    $remoteExists = $true
  }
} else {
  # Refuse to connect a new local project to an existing remote repository.
  $existing = & gh repo view $repository --json name --jq '.name' 2>$null
  if ($LASTEXITCODE -eq 0) { throw 'hblgzsx/rizhi already exists. Inspect it before connecting this project.' }
  Invoke-Checked 'git' @('init','-b','main')
}

# Explicit allowlist: test downloads, personal backups, and browser data are never staged.
$publicSources = @(
  '.gitignore','package.json','index.html','app.js','core.js','markdown.js','exports.js','styles.css','favicon.svg','README.md',
  'data/news.json','docs/PRODUCT.md','docs/VALIDATION.md','.github/workflows/pages.yml',
  'scripts/serve.mjs','scripts/build.mjs','scripts/fetch_news.py','scripts/publish.ps1','scripts/check-ui.mjs',
  'tests/core.test.mjs','tests/markdown.test.mjs'
)
$previouslyStaged = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect existing staged files.' }
foreach ($stagedPath in $previouslyStaged) {
  if ($stagedPath -and $publicSources -notcontains $stagedPath) { throw "An unrelated file is already staged: $stagedPath. Publishing stopped without committing it." }
}
Invoke-Checked 'git' (@('add','--') + $publicSources)
& git diff --cached --quiet
if ($LASTEXITCODE -eq 1) { Invoke-Checked 'git' @('commit','-m','Build Rizhi personal learning and writing space') }
elseif ($LASTEXITCODE -ne 0) { throw 'Unable to inspect staged changes.' }

if (-not $remoteExists) {
  Invoke-Checked 'gh' @('repo','create',$repository,'--public','--description','日知：记录生活、理解世界，深耕人工智能与计算机。','--source','.','--remote','origin')
}
# HTTPS works on networks where outbound SSH is blocked. The helper reads the
# existing CLI login without writing a token into Git configuration or files.
Invoke-Checked 'git' @('remote','set-url','origin','https://github.com/hblgzsx/rizhi.git')
Invoke-Checked 'git' @('-c','credential.helper=','-c','credential.helper=!gh auth git-credential','push','-u','origin','main')
$siteUrl = & gh api "repos/$repository/pages" --jq '.html_url' 2>$null
if ($LASTEXITCODE -ne 0) {
  Invoke-Checked 'gh' @('api','--method','POST',"repos/$repository/pages",'-f','build_type=workflow')
} else {
  Invoke-Checked 'gh' @('api','--method','PUT',"repos/$repository/pages",'-f','build_type=workflow')
}
Invoke-Checked 'gh' @('workflow','run','pages.yml','--repo',$repository)
if (-not $SkipWatch) {
  Start-Sleep -Seconds 5
  $runId = & gh run list --repo $repository --workflow pages.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId'
  if ($LASTEXITCODE -ne 0 -or -not $runId) { throw 'Deployment was dispatched. Check the Actions page for its result.' }
  Invoke-Checked 'gh' @('run','watch',$runId.Trim(),'--repo',$repository,'--exit-status')
  $response = Invoke-WebRequest -Uri 'https://hblgzsx.github.io/rizhi/' -UseBasicParsing
  if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'app.js') { throw 'Deployment finished, but the website response needs inspection.' }
  Write-Host 'Published and verified: https://hblgzsx.github.io/rizhi/'
} else {
  Write-Host 'Deployment dispatched. Check https://github.com/hblgzsx/rizhi/actions before treating the site as published.'
}
