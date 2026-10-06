[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ConfigPath,
    [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$stateRoot = [IO.Path]::GetFullPath($config.StateDirectory)
$repoPath = Join-Path $stateRoot 'repo'
$statePath = Join-Path $stateRoot 'state.json'
$logPath = Join-Path $stateRoot 'update.log'
$installedManifestPath = Join-Path $config.DshHome 'profiles\desktop\node_modules\dsh-toons\package.json'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

function Write-UpdateLog([string]$Message) {
    $line = '{0} {1}' -f [DateTimeOffset]::Now.ToString('o'), $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Invoke-UpdateCommand {
    param([string]$Executable, [string[]]$CommandArguments, [switch]$Capture)
    $previousPreference = $ErrorActionPreference
    try {
        # Windows PowerShell wraps native stderr in ErrorRecords, even on success.
        $ErrorActionPreference = 'Continue'
        $output = @(& $Executable @CommandArguments 2>&1)
        $commandExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    foreach ($line in $output) { Add-Content -LiteralPath $logPath -Value $line.ToString() -Encoding UTF8 }
    if ($commandExitCode -ne 0) {
        throw ('{0} failed with exit code {1}; see update.log.' -f [IO.Path]::GetFileName($Executable), $commandExitCode)
    }
    if ($Capture) { return ($output | ForEach-Object { $_.ToString() }) -join "`n" }
}

function Get-StableVersion([string]$Value) {
    if ($Value -notmatch '^\d+\.\d+\.\d+$') { throw "Unsupported release version: $Value. Expected a stable x.y.z version." }
    return [version]$Value
}

function Read-InstalledManifest {
    if (-not (Test-Path -LiteralPath $installedManifestPath -PathType Leaf)) {
        throw 'dsh-toons is no longer installed in the desktop profile. Stopping instead of reinstalling a removed plugin.'
    }
    return Get-Content -LiteralPath $installedManifestPath -Raw | ConvertFrom-Json
}

function Test-DesktopRunning {
    return @(Get-Process -Name $config.DesktopProcessName -ErrorAction SilentlyContinue).Count -gt 0
}

function Save-UpdateState {
    $state.lastCheckedAt = [DateTimeOffset]::Now.ToString('o')
    $temporaryPath = Join-Path $stateRoot 'state.json.tmp'
    $state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
    Move-Item -LiteralPath $temporaryPath -Destination $statePath -Force
}

$state = [ordered]@{
    schemaVersion = 1
    status = 'checking'
    lastCheckedAt = $null
    remoteCommit = $null
    remoteVersion = $null
    installedCommit = $null
    installedVersion = $null
    installedPackage = $null
    installedAt = $null
    pending = $null
    error = $null
}
$lock = $null
$locationPushed = $false
$oldDshHome = [Environment]::GetEnvironmentVariable('DSH_HOME', 'Process')
$oldGitPrompt = [Environment]::GetEnvironmentVariable('GIT_TERMINAL_PROMPT', 'Process')
$oldPath = [Environment]::GetEnvironmentVariable('PATH', 'Process')
$oldElectronNode = [Environment]::GetEnvironmentVariable('ELECTRON_RUN_AS_NODE', 'Process')
try {
    try {
        $lock = [IO.File]::Open((Join-Path $stateRoot 'update.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    } catch [IO.IOException] {
        Write-Host 'Another update is already running.'
        exit 0
    }
    if (Test-Path -LiteralPath $statePath) {
        $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        foreach ($key in @($state.Keys)) {
            if ($saved.PSObject.Properties.Name -contains $key) { $state[$key] = $saved.$key }
        }
    }
    if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 2MB) {
        Move-Item -LiteralPath $logPath -Destination (Join-Path $stateRoot 'update.previous.log') -Force
    }
    $state.error = $null
    $env:DSH_HOME = $config.DshHome
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:PATH = (Split-Path $config.NpmCommand -Parent) + ';' + (Split-Path $config.GitCommand -Parent) + ';' + $oldPath
    foreach ($toolPath in @($config.GitCommand, $config.NpmCommand, $config.DshCommand)) {
        if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) { throw "Required command is missing: $toolPath" }
    }
    $installed = Read-InstalledManifest
    $state.installedVersion = $installed.version
    $installedVersion = Get-StableVersion $installed.version
    $minimumVersion = Get-StableVersion $config.MinimumVersion

    if (-not (Test-Path -LiteralPath $repoPath)) {
        Write-UpdateLog "Cloning $($config.RepositoryUrl), branch $($config.Branch)."
        Invoke-UpdateCommand $config.GitCommand @('clone', '--single-branch', '--branch', $config.Branch, '--', $config.RepositoryUrl, $repoPath)
    }
    if (-not (Test-Path -LiteralPath (Join-Path $repoPath '.git'))) { throw 'The updater repository is not a Git checkout.' }
    $origin = Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'remote', 'get-url', 'origin') -Capture
    if ($origin.Trim() -cne $config.RepositoryUrl) { throw 'The updater repository origin differs from the configured repository.' }
    $branch = Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'symbolic-ref', '--quiet', '--short', 'HEAD') -Capture
    if ($branch.Trim() -cne $config.Branch) { throw 'The updater repository is on a different branch.' }
    $changes = Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'status', '--porcelain') -Capture
    if ($changes.Trim()) { throw 'The updater repository has local changes. No files were reset or discarded.' }

    Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'fetch', '--no-tags', 'origin', $config.Branch)
    $remoteRef = 'refs/remotes/origin/' + $config.Branch
    $ahead = Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'rev-list', '--count', ($remoteRef + '..HEAD')) -Capture
    if ([int]$ahead.Trim() -gt 0) { throw 'The updater repository has local commits. Automatic merging is disabled.' }
    Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'merge', '--ff-only', $remoteRef)
    $commit = (Invoke-UpdateCommand $config.GitCommand @('-C', $repoPath, 'rev-parse', 'HEAD') -Capture).Trim()
    if ($commit -notmatch '^[0-9a-f]{40,64}$') { throw 'Git returned an invalid commit ID.' }
    $candidate = Get-Content -LiteralPath (Join-Path $repoPath 'package.json') -Raw | ConvertFrom-Json
    if ($candidate.name -cne 'dsh-toons') { throw 'The remote package is not dsh-toons.' }
    $candidateVersion = Get-StableVersion $candidate.version
    $state.remoteCommit = $commit
    $state.remoteVersion = $candidate.version
    if ($candidateVersion -lt $installedVersion -or $candidateVersion -lt $minimumVersion) {
        $state.status = 'skipped-older-version'
        $state.pending = $null
        Save-UpdateState
        Write-UpdateLog "Keeping installed $($installed.version); GitHub has older version $($candidate.version)."
        exit 0
    }
    if ($state.installedCommit -eq $commit -and $installed.version -eq $candidate.version) {
        # Reinstall if a user has manually switched back to another package of the same version.
        $profileManifest = Get-Content -LiteralPath (Join-Path $config.DshHome 'profiles\desktop\package.json') -Raw | ConvertFrom-Json
        $expectedSpec = 'file:' + $state.installedPackage.Replace('\', '/')
        if ($profileManifest.dependencies.'dsh-toons' -eq $expectedSpec) {
            $state.status = 'up-to-date'
            $state.pending = $null
            Save-UpdateState
            Write-UpdateLog "Already installed $($candidate.version) at $($commit.Substring(0, 12))."
            exit 0
        }
    }

    $packageDirectory = Join-Path (Join-Path $stateRoot 'packages') $commit
    $packagePath = Join-Path $packageDirectory ('dsh-toons-' + $candidate.version + '.tgz')
    $reusePending = $null -ne $state.pending -and $state.pending.commit -eq $commit -and (Test-Path -LiteralPath $packagePath -PathType Leaf)
    if ($reusePending) {
        if ((Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash -cne $state.pending.sha256) {
            throw 'The prepared package changed on disk. Installation was stopped.'
        }
    } else {
        Write-UpdateLog "Validating and packaging $($candidate.version) at $($commit.Substring(0, 12))."
        New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null
        Push-Location -LiteralPath $repoPath
        $locationPushed = $true
        Invoke-UpdateCommand $config.NpmCommand @('ci', '--include=dev', '--no-audit', '--no-fund')
        Invoke-UpdateCommand $config.NpmCommand @('run', 'typecheck')
        Invoke-UpdateCommand $config.NpmCommand @('test')
        # npm pack invokes this repository's prepack build before writing the tarball.
        Invoke-UpdateCommand $config.NpmCommand @('pack', '--pack-destination', $packageDirectory)
        Pop-Location
        $locationPushed = $false
        if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw 'npm pack did not produce the expected plugin package.' }
        $state.pending = [ordered]@{
            commit = $commit
            version = $candidate.version
            package = $packagePath
            sha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
            preparedAt = [DateTimeOffset]::Now.ToString('o')
        }
    }
    $state.status = 'ready-to-install'
    Save-UpdateState
    if ($PrepareOnly) {
        Write-UpdateLog 'Package prepared; installation was not requested for this run.'
        exit 0
    }
    if (Test-DesktopRunning) {
        $state.status = 'waiting-for-desktop-exit'
        Save-UpdateState
        Write-UpdateLog 'Update prepared. It will install on a later check after DeepSeek Harness fully exits.'
        exit 0
    }

    # Recheck the installed version immediately before touching the desktop profile.
    $installed = Read-InstalledManifest
    if ($candidateVersion -lt (Get-StableVersion $installed.version)) {
        $state.status = 'skipped-older-version'
        $state.pending = $null
        Save-UpdateState
        Write-UpdateLog 'A newer plugin was installed while this update was being prepared. Keeping it.'
        exit 0
    }
    $backupDirectory = Join-Path (Join-Path $stateRoot 'backups') ([DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff'))
    Write-UpdateLog "Installing $($candidate.version) in the desktop profile."
    if ([IO.Path]::GetExtension($config.DshCommand) -eq '.cmd') {
        $installationRoot = [IO.Path]::GetFullPath((Join-Path (Split-Path $config.DshCommand -Parent) '..\..\..\..'))
        $desktopExecutable = Join-Path $installationRoot 'DeepSeek Harness.exe'
        if (-not (Test-Path -LiteralPath $desktopExecutable -PathType Leaf)) {
            throw 'Automatic installation requires the desktop installation-owned resources/runtime/cli/bin/dsh.cmd launcher.'
        }
        $installer = Join-Path $PSScriptRoot 'install-desktop-package.cmd'
        $installResultPath = Join-Path $stateRoot 'install-result.json'
        $env:ELECTRON_RUN_AS_NODE = '1'
        Invoke-UpdateCommand $installer @($installationRoot, (Join-Path $config.DshHome 'profiles\desktop'), $packagePath, $candidate.version, $backupDirectory, $installResultPath)
        $installResult = Get-Content -LiteralPath $installResultPath -Raw | ConvertFrom-Json
        if ($installResult.status -ne 'installed') {
            $state.status = $installResult.status
            $state.pending = $null
            Save-UpdateState
            Write-UpdateLog ('Installation skipped under the desktop profile lock: ' + $installResult.status)
            exit 0
        }
    } else {
        # Script launchers allow isolated installer doubles in integration tests.
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        foreach ($fileName in @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'cordis.yml')) {
            $sourcePath = Join-Path (Join-Path $config.DshHome 'profiles\desktop') $fileName
            if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
                Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $backupDirectory $fileName)
            }
        }
        Invoke-UpdateCommand $config.DshCommand @('plugin', '--profile', 'desktop', 'add', $packagePath)
    }
    $verified = Read-InstalledManifest
    if ($verified.name -cne 'dsh-toons' -or $verified.version -cne $candidate.version) {
        throw 'The desktop profile did not report the expected installed plugin version.'
    }
    $profileManifest = Get-Content -LiteralPath (Join-Path $config.DshHome 'profiles\desktop\package.json') -Raw | ConvertFrom-Json
    if ($profileManifest.dependencies.'dsh-toons' -ne ('file:' + $packagePath.Replace('\', '/'))) {
        throw 'The desktop profile did not select the prepared package.'
    }
    $state.installedCommit = $commit
    $state.installedVersion = $candidate.version
    $state.installedPackage = $packagePath
    $state.installedAt = [DateTimeOffset]::Now.ToString('o')
    $state.pending = $null
    $state.status = 'installed'
    Save-UpdateState
    Write-UpdateLog "Installed $($candidate.version). It takes effect the next time DeepSeek Harness opens."
} catch {
    $state.status = 'failed'
    $state.error = $_.Exception.Message
    Save-UpdateState
    Write-UpdateLog ('Update failed: ' + $_.Exception.Message)
    exit 1
} finally {
    if ($locationPushed) { Pop-Location }
    [Environment]::SetEnvironmentVariable('DSH_HOME', $oldDshHome, 'Process')
    [Environment]::SetEnvironmentVariable('GIT_TERMINAL_PROMPT', $oldGitPrompt, 'Process')
    [Environment]::SetEnvironmentVariable('PATH', $oldPath, 'Process')
    [Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $oldElectronNode, 'Process')
    if ($null -ne $lock) { $lock.Dispose() }
}
