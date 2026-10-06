# Integration checks use real local Git repositories and isolated fake npm/DSH commands.
# No real desktop profile or scheduled task is changed.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path $projectRoot ('work\updater-tests-' + [Guid]::NewGuid().ToString('N'))
$remotePath = Join-Path $fixtureRoot 'remote'
$stateRoot = Join-Path $fixtureRoot 'state'
$dshHome = Join-Path $fixtureRoot 'dsh'
$profileRoot = Join-Path $dshHome 'profiles\desktop'
$installedPath = Join-Path $profileRoot 'node_modules\dsh-toons\package.json'
$callsPath = Join-Path $fixtureRoot 'calls.txt'
$configPath = Join-Path $fixtureRoot 'config.json'
$gitCommand = (Get-Command git.exe -ErrorAction Stop).Source
$powershellCommand = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$updater = Join-Path $projectRoot 'scripts\auto-update-desktop.ps1'
New-Item -ItemType Directory -Path $remotePath, (Split-Path $installedPath -Parent) -Force | Out-Null

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}
function Invoke-FixtureGit([string[]]$GitArguments) {
    & $gitCommand -C $remotePath @GitArguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Fixture Git command failed.' }
}
function Commit-Version([string]$Version, [string]$Message, [string]$Name = 'dsh-toons') {
    @{ name = $Name; version = $Version; scripts = @{ prepack = 'npm run build' } } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $remotePath 'package.json') -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $remotePath 'fixture.txt') -Value $Message
    Invoke-FixtureGit @('add', 'package.json', 'fixture.txt')
    Invoke-FixtureGit @('commit', '-m', $Message)
}
function Run-Updater([int]$ExpectedExitCode = 0, [switch]$PrepareOnly) {
    $updaterArguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $updater, '-ConfigPath', $configPath)
    if ($PrepareOnly) { $updaterArguments += '-PrepareOnly' }
    & $powershellCommand @updaterArguments
    Assert-True ($LASTEXITCODE -eq $ExpectedExitCode) "Updater exits with $ExpectedExitCode"
}
function Read-State { return Get-Content -LiteralPath (Join-Path $stateRoot 'state.json') -Raw | ConvertFrom-Json }
function Read-Calls { if (Test-Path -LiteralPath $callsPath) { return @(Get-Content -LiteralPath $callsPath) }; return @() }
function Read-Installed { return Get-Content -LiteralPath $installedPath -Raw | ConvertFrom-Json }
function Save-FixtureConfig { $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8 }
function Invoke-CheckoutGit([string[]]$GitArguments) {
    & $gitCommand -C (Join-Path $stateRoot 'repo') @GitArguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Updater checkout fixture Git command failed.' }
}

$mockNpmPath = Join-Path $fixtureRoot 'npm.ps1'
@'
$ErrorActionPreference = 'Stop'
Add-Content -LiteralPath $env:TOONS_FIXTURE_CALLS -Value ('npm ' + ($args -join ' '))
if ($env:TOONS_FIXTURE_FAIL -eq 'typecheck' -and ($args -join ' ') -eq 'run typecheck') { exit 9 }
if ($args[0] -eq 'pack') {
    $manifest = Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json
    $directory = $args[2]
    $package = Join-Path $directory ('dsh-toons-' + $manifest.version + '.tgz')
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $package -Encoding UTF8
    $installedPath = Join-Path $env:DSH_HOME 'profiles\desktop\node_modules\dsh-toons\package.json'
    if ($env:TOONS_FIXTURE_PACK_MODE -eq 'upgrade') {
        @{ name = 'dsh-toons'; version = '1.0.0' } | ConvertTo-Json | Set-Content -LiteralPath $installedPath -Encoding UTF8
    } elseif ($env:TOONS_FIXTURE_PACK_MODE -eq 'uninstall') {
        Remove-Item -LiteralPath $installedPath
    }
}
exit 0
'@ | Set-Content -LiteralPath $mockNpmPath -Encoding UTF8
$mockDshPath = Join-Path $fixtureRoot 'dsh.ps1'
@'
$ErrorActionPreference = 'Stop'
Add-Content -LiteralPath $env:TOONS_FIXTURE_CALLS -Value ('dsh ' + ($args -join ' '))
if ($env:TOONS_FIXTURE_INSTALL_MODE -eq 'fail') { exit 7 }
$package = $args[4]
$manifest = Get-Content -LiteralPath $package -Raw | ConvertFrom-Json
if ($env:TOONS_FIXTURE_INSTALL_MODE -eq 'wrong-version') { $manifest.version = '0.1.1' }
$profileRoot = Join-Path $env:DSH_HOME 'profiles\desktop'
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $profileRoot 'node_modules\dsh-toons\package.json') -Encoding UTF8
if ($env:TOONS_FIXTURE_INSTALL_MODE -eq 'wrong-package') { $package = Join-Path $profileRoot 'other.tgz' }
@{ dependencies = @{ 'dsh-toons' = 'file:' + $package.Replace('\', '/') } } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $profileRoot 'package.json') -Encoding UTF8
exit 0
'@ | Set-Content -LiteralPath $mockDshPath -Encoding UTF8

# This child process shadows every ScheduledTasks command used by setup. The
# real scheduler is never invoked, and the mocks cannot leak into the caller.
$setupHarnessPath = Join-Path $fixtureRoot 'setup-harness.ps1'
@'
param([string]$SetupPath, [string]$DshHome, [string]$StateDirectory, [string]$DshCommand, [string]$RepositoryUrl, [string]$ResultPath)
$ErrorActionPreference = 'Stop'
function New-ScheduledTaskAction {
    param([string]$Execute, [string]$Argument, [string]$WorkingDirectory)
    return [pscustomobject]@{ Execute = $Execute; Argument = $Argument; WorkingDirectory = $WorkingDirectory }
}
function New-ScheduledTaskTrigger {
    param([switch]$Once, [datetime]$At, [timespan]$RepetitionInterval, [switch]$AtLogOn, [string]$User)
    return [pscustomobject]@{ Once = [bool]$Once; AtLogOn = [bool]$AtLogOn; RepetitionMinutes = $RepetitionInterval.TotalMinutes; User = $User }
}
function New-ScheduledTaskPrincipal {
    param([string]$UserId, [string]$LogonType, [string]$RunLevel)
    return [pscustomobject]@{ UserId = $UserId; LogonType = $LogonType; RunLevel = $RunLevel }
}
function New-ScheduledTaskSettingsSet {
    param([switch]$StartWhenAvailable, [switch]$AllowStartIfOnBatteries, [switch]$DontStopIfGoingOnBatteries, [string]$MultipleInstances, [timespan]$ExecutionTimeLimit, [switch]$Hidden)
    return [pscustomobject]@{ StartWhenAvailable = [bool]$StartWhenAvailable; AllowStartIfOnBatteries = [bool]$AllowStartIfOnBatteries; DontStopIfGoingOnBatteries = [bool]$DontStopIfGoingOnBatteries; MultipleInstances = $MultipleInstances; ExecutionMinutes = $ExecutionTimeLimit.TotalMinutes; Hidden = [bool]$Hidden }
}
function New-ScheduledTask {
    param($Action, $Trigger, $Principal, $Settings, [string]$Description)
    return [pscustomobject]@{ Action = $Action; Trigger = $Trigger; Principal = $Principal; Settings = $Settings; Description = $Description }
}
function Register-ScheduledTask {
    param([string]$TaskName, $InputObject, [switch]$Force)
    [pscustomobject]@{ Name = $TaskName; Task = $InputObject; Force = [bool]$Force } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
}
& $SetupPath -RepositoryUrl $RepositoryUrl -Branch main -DshCommand $DshCommand -DshHome $DshHome -StateDirectory $StateDirectory -IntervalMinutes 15 -TaskName 'Toons-Isolated-Fixture'
'@ | Set-Content -LiteralPath $setupHarnessPath -Encoding UTF8

$mockGitPath = Join-Path $fixtureRoot 'git.ps1'
@'
if ($env:TOONS_FIXTURE_GIT_FAIL -eq 'fetch' -and $args -contains 'fetch') {
    Write-Output 'Simulated offline fetch failure.'
    exit 128
}
& $env:TOONS_FIXTURE_GIT @args
exit $LASTEXITCODE
'@ | Set-Content -LiteralPath $mockGitPath -Encoding UTF8

Invoke-FixtureGit @('init', '-b', 'main')
Invoke-FixtureGit @('config', 'user.name', 'Updater integration test')
Invoke-FixtureGit @('config', 'user.email', 'updater-test@example.invalid')
Commit-Version '0.1.15' 'initial older release'
@{ name = 'dsh-toons'; version = '0.1.16' } | ConvertTo-Json | Set-Content -LiteralPath $installedPath -Encoding UTF8
@{ dependencies = @{ 'dsh-toons' = 'file:original.tgz' } } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $profileRoot 'package.json') -Encoding UTF8
$config = [ordered]@{
    RepositoryUrl = $remotePath
    Branch = 'main'
    StateDirectory = $stateRoot
    GitCommand = $gitCommand
    NpmCommand = $mockNpmPath
    DshCommand = $mockDshPath
    DshHome = $dshHome
    DesktopProcessName = 'DshToonsFixtureNotRunning'
    MinimumVersion = '0.1.16'
}
$oldCalls = [Environment]::GetEnvironmentVariable('TOONS_FIXTURE_CALLS', 'Process')
$oldFail = [Environment]::GetEnvironmentVariable('TOONS_FIXTURE_FAIL', 'Process')
$extraEnvironment = @{}
foreach ($name in @('TOONS_FIXTURE_PACK_MODE', 'TOONS_FIXTURE_INSTALL_MODE', 'TOONS_FIXTURE_GIT', 'TOONS_FIXTURE_GIT_FAIL')) {
    $extraEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, '', 'Process')
}
try {
    $env:TOONS_FIXTURE_CALLS = $callsPath
    $env:TOONS_FIXTURE_FAIL = ''
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    Run-Updater
    Assert-True ((Read-State).status -eq 'skipped-older-version') 'Older remote version is not installed'
    Assert-True (@(Read-Calls).Count -eq 0) 'Downgrade check performs no build or install'

    Commit-Version '0.1.17' 'new release'
    $config.DesktopProcessName = 'powershell'
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    Run-Updater
    Assert-True ((Read-State).status -eq 'waiting-for-desktop-exit') 'Running Desktop defers installation'
    Assert-True (@(Read-Calls).Count -eq 4) 'Dependency install, typecheck, tests and pack run before staging'
    Assert-True ((Get-Content -LiteralPath $installedPath -Raw | ConvertFrom-Json).version -eq '0.1.16') 'Running Desktop retains the installed plugin'

    $config.DesktopProcessName = 'DshToonsFixtureNotRunning'
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    Run-Updater
    $firstPackage = (Read-State).installedPackage
    Assert-True ((Read-State).status -eq 'installed') 'Staged package installs after Desktop exits'
    Assert-True (@(Read-Calls).Count -eq 5) 'Prepared package is reused without rebuilding'
    Assert-True ((Get-Content -LiteralPath $installedPath -Raw | ConvertFrom-Json).version -eq '0.1.17') 'Installed version is verified'
    Assert-True (@(Get-ChildItem -LiteralPath (Join-Path $stateRoot 'backups') -Directory).Count -eq 1) 'Profile is backed up before installation'

    Run-Updater
    Assert-True ((Read-State).status -eq 'up-to-date') 'Unchanged commit is recognized'
    Assert-True (@(Read-Calls).Count -eq 5) 'Unchanged commit does not reinstall'

    Commit-Version '0.1.17' 'same-version source fix'
    Run-Updater
    Assert-True ((Read-State).installedPackage -ne $firstPackage) 'Same-version new commit uses a fresh package path'
    Assert-True (@(Read-Calls).Count -eq 10) 'Same-version source changes rebuild and install'

    Commit-Version '0.1.18' 'release with failing typecheck'
    $env:TOONS_FIXTURE_FAIL = 'typecheck'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).status -eq 'failed') 'Failed validation is recorded'
    Assert-True ((Get-Content -LiteralPath $installedPath -Raw | ConvertFrom-Json).version -eq '0.1.17') 'Failed validation preserves the installed version'
    Assert-True (@(Read-Calls).Count -eq 12) 'Failure stops before packing and installation'

    $env:TOONS_FIXTURE_FAIL = ''
    Run-Updater -PrepareOnly
    Assert-True ((Read-State).status -eq 'ready-to-install') 'PrepareOnly validates and packs without installing'
    $preparedPackageBytes = [IO.File]::ReadAllBytes((Read-State).pending.package)
    Add-Content -LiteralPath (Read-State).pending.package -Value 'modified after staging'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'changed on disk') 'Tampered staged package is rejected'
    Assert-True ((Get-Content -LiteralPath $installedPath -Raw | ConvertFrom-Json).version -eq '0.1.17') 'Tampered package does not replace the working plugin'

    Set-Content -LiteralPath (Join-Path $stateRoot 'repo\uncommitted.txt') -Value 'do not discard'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'local changes') 'Dirty updater checkout is refused'
    Assert-True (Test-Path -LiteralPath (Join-Path $stateRoot 'repo\uncommitted.txt')) 'Local modifications are preserved'

    # Restore only files created by this fixture, then establish a healthy
    # installed baseline for the independent failure/recovery scenarios.
    Remove-Item -LiteralPath (Join-Path $stateRoot 'repo\uncommitted.txt')
    [IO.File]::WriteAllBytes((Read-State).pending.package, $preparedPackageBytes)
    Run-Updater
    Assert-True ((Read-Installed).version -eq '0.1.18') 'A restored staged package can still install'

    $setupStateRoot = Join-Path $fixtureRoot 'scheduled setup with spaces'
    $setupResultPath = Join-Path $fixtureRoot 'setup-result.json'
    $setupPath = Join-Path $projectRoot 'scripts\setup-desktop-auto-update.ps1'
    & $powershellCommand -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $setupHarnessPath $setupPath $dshHome $setupStateRoot $mockDshPath $remotePath $setupResultPath
    Assert-True ($LASTEXITCODE -eq 0) 'Setup runs entirely against mocked scheduler commands'
    $setupConfig = Get-Content -LiteralPath (Join-Path $setupStateRoot 'config.json') -Raw | ConvertFrom-Json
    $registration = Get-Content -LiteralPath $setupResultPath -Raw | ConvertFrom-Json
    Assert-True ($setupConfig.RepositoryUrl -eq $remotePath -and $setupConfig.Branch -eq 'main' -and $setupConfig.MinimumVersion -eq '0.1.18') 'Setup persists the requested repository and installed version floor'
    Assert-True ($setupConfig.DshHome -eq $dshHome -and $setupConfig.DshCommand -eq $mockDshPath -and $setupConfig.StateDirectory -eq $setupStateRoot) 'Setup persists isolated absolute profile, command and state paths'
    Assert-True ($registration.Name -eq 'Toons-Isolated-Fixture' -and $registration.Force) 'Setup registers the requested task name'
    Assert-True ($registration.Task.Action.Execute -eq $powershellCommand -and $registration.Task.Action.WorkingDirectory -eq $setupStateRoot) 'Scheduled action uses Windows PowerShell and its state directory'
    Assert-True ($registration.Task.Action.Argument.Contains('-File "' + $updater + '"') -and $registration.Task.Action.Argument.Contains('-ConfigPath "' + (Join-Path $setupStateRoot 'config.json') + '"')) 'Scheduled action quotes the updater and configuration paths'
    Assert-True (@($registration.Task.Trigger).Count -eq 2 -and $registration.Task.Trigger[0].Once -and $registration.Task.Trigger[0].RepetitionMinutes -eq 15 -and $registration.Task.Trigger[1].AtLogOn) 'Setup requests recurring and logon triggers'
    $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    Assert-True ($registration.Task.Principal.UserId -eq $userId -and $registration.Task.Principal.LogonType -eq 'Interactive' -and $registration.Task.Principal.RunLevel -eq 'Limited' -and $registration.Task.Trigger[1].User -eq $userId) 'Setup uses the current user without elevation or stored credentials'
    Assert-True ($registration.Task.Settings.MultipleInstances -eq 'IgnoreNew' -and $registration.Task.Settings.Hidden -and $registration.Task.Settings.ExecutionMinutes -eq 30 -and $registration.Task.Settings.StartWhenAvailable -and $registration.Task.Settings.AllowStartIfOnBatteries -and $registration.Task.Settings.DontStopIfGoingOnBatteries) 'Setup requests background execution and prevents overlapping task instances'

    $stateHashBeforeLock = (Get-FileHash -LiteralPath (Join-Path $stateRoot 'state.json')).Hash
    $callsBeforeLock = @(Read-Calls).Count
    $heldLock = [IO.File]::Open((Join-Path $stateRoot 'update.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    try {
        Run-Updater
        Assert-True (@(Read-Calls).Count -eq $callsBeforeLock) 'Overlapping invocation runs no packaging or installation commands'
        Assert-True ((Get-FileHash -LiteralPath (Join-Path $stateRoot 'state.json')).Hash -eq $stateHashBeforeLock) 'Overlapping invocation leaves the active update state unchanged'
    } finally { $heldLock.Dispose() }
    Run-Updater
    Assert-True ((Read-State).status -eq 'up-to-date') 'Update checks resume when the lock is released'

    $baselineManifestBytes = [IO.File]::ReadAllBytes($installedPath)
    Commit-Version '0.1.19' 'manual upgrade during package preparation'
    $callsBeforeUpgrade = @(Read-Calls).Count
    $env:TOONS_FIXTURE_PACK_MODE = 'upgrade'
    Run-Updater
    Assert-True ((Read-State).status -eq 'skipped-older-version' -and (Read-Installed).version -eq '1.0.0') 'A manual newer install during packaging is retained'
    Assert-True (@(Read-Calls).Count -eq $callsBeforeUpgrade + 4 -and $null -eq (Read-State).pending) 'Late downgrade protection stops before installation and clears pending state'
    $env:TOONS_FIXTURE_PACK_MODE = ''
    [IO.File]::WriteAllBytes($installedPath, $baselineManifestBytes)

    Commit-Version '0.1.20' 'manual uninstall during package preparation'
    $callsBeforeUninstall = @(Read-Calls).Count
    $env:TOONS_FIXTURE_PACK_MODE = 'uninstall'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'no longer installed' -and -not (Test-Path -LiteralPath $installedPath)) 'Uninstalling during packaging never restores the removed plugin'
    Assert-True (@(Read-Calls).Count -eq $callsBeforeUninstall + 4) 'Late uninstall stops before the installer is invoked'
    $env:TOONS_FIXTURE_PACK_MODE = ''
    Run-Updater -ExpectedExitCode 1
    Assert-True (@(Read-Calls).Count -eq $callsBeforeUninstall + 4) 'Subsequent checks do no build or installation while the plugin is absent'
    [IO.File]::WriteAllBytes($installedPath, $baselineManifestBytes)

    Commit-Version '0.1.21' 'installer failure and recovery'
    $previousInstalledCommit = (Read-State).installedCommit
    $callsBeforeInstallerFailure = @(Read-Calls).Count
    $env:TOONS_FIXTURE_INSTALL_MODE = 'fail'
    Run-Updater -ExpectedExitCode 1
    $failedPackage = (Read-State).pending.package
    Assert-True ((Read-State).status -eq 'failed' -and (Read-State).error -match 'exit code 7' -and (Read-State).installedCommit -eq $previousInstalledCommit) 'Installer failure is recorded without marking the new commit installed'
    Assert-True ((Read-Installed).version -eq '0.1.18' -and (Test-Path -LiteralPath $failedPackage)) 'Installer failure retains the previous plugin and prepared package'
    $env:TOONS_FIXTURE_INSTALL_MODE = ''
    Run-Updater
    Assert-True ((Read-State).status -eq 'installed' -and (Read-State).installedPackage -eq $failedPackage -and (Read-Installed).version -eq '0.1.21') 'Installer recovery reuses the verified pending package'
    Assert-True (@(Read-Calls).Count -eq $callsBeforeInstallerFailure + 6) 'Installer retry adds one install call without rebuilding'

    foreach ($failure in @('wrong-version', 'wrong-package')) {
        $version = if ($failure -eq 'wrong-version') { '0.1.22' } else { '0.1.23' }
        Commit-Version $version ('verify installer ' + $failure)
        $previousInstalledCommit = (Read-State).installedCommit
        $callsBeforeMismatch = @(Read-Calls).Count
        $env:TOONS_FIXTURE_INSTALL_MODE = $failure
        Run-Updater -ExpectedExitCode 1
        $mismatchState = Read-State
        $expectedError = if ($failure -eq 'wrong-version') { 'expected installed plugin version' } else { 'did not select the prepared package' }
        Assert-True ($mismatchState.status -eq 'failed' -and $mismatchState.error -match $expectedError -and $mismatchState.installedCommit -eq $previousInstalledCommit -and $null -ne $mismatchState.pending) "Verification rejects $failure without recording success"
        $env:TOONS_FIXTURE_INSTALL_MODE = ''
        Run-Updater
        Assert-True ((Read-State).status -eq 'installed' -and (Read-Installed).version -eq $version -and (Read-State).installedPackage -eq $mismatchState.pending.package) "Verification failure $failure can recover using the pending package"
        Assert-True (@(Read-Calls).Count -eq $callsBeforeMismatch + 6) "Verification retry $failure does not rebuild"
    }

    $callsBeforeGuards = @(Read-Calls).Count
    Invoke-CheckoutGit @('switch', '-c', 'fixture-wrong-branch')
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'different branch') 'An unexpected checkout branch is refused'
    Invoke-CheckoutGit @('switch', 'main')
    Invoke-CheckoutGit @('remote', 'set-url', 'origin', ($remotePath + '-different'))
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'origin differs') 'An unexpected repository origin is refused'
    Invoke-CheckoutGit @('remote', 'set-url', 'origin', $remotePath)
    $checkoutBeforeLocalCommit = (& $gitCommand -C (Join-Path $stateRoot 'repo') rev-parse HEAD).Trim()
    Invoke-CheckoutGit @('-c', 'user.name=Updater integration test', '-c', 'user.email=updater-test@example.invalid', 'commit', '--allow-empty', '-m', 'isolated local fixture commit')
    $localCommit = (& $gitCommand -C (Join-Path $stateRoot 'repo') rev-parse HEAD).Trim()
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'local commits' -and (& $gitCommand -C (Join-Path $stateRoot 'repo') rev-parse HEAD).Trim() -eq $localCommit) 'Local checkout commits are refused and preserved'
    # This fixture commit has an identical tree, so restoring only its branch
    # reference leaves every working file untouched.
    Invoke-CheckoutGit @('update-ref', 'refs/heads/main', $checkoutBeforeLocalCommit, $localCommit)
    Assert-True (@(Read-Calls).Count -eq $callsBeforeGuards) 'Checkout integrity guards invoke no package or install commands'

    $config.NpmCommand = Join-Path $fixtureRoot 'missing-npm.ps1'
    Save-FixtureConfig
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'Required command is missing') 'A missing command fails before attempting an update'
    $config.NpmCommand = $mockNpmPath
    $config.GitCommand = $mockGitPath
    Save-FixtureConfig
    $env:TOONS_FIXTURE_GIT = $gitCommand
    $env:TOONS_FIXTURE_GIT_FAIL = 'fetch'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'exit code 128' -and (Read-Installed).version -eq '0.1.23') 'An offline fetch failure retains the installed plugin'
    Assert-True (@(Read-Calls).Count -eq $callsBeforeGuards) 'Missing commands and offline fetch invoke no build or installation'
    $env:TOONS_FIXTURE_GIT_FAIL = ''
    Run-Updater
    Assert-True ((Read-State).status -eq 'up-to-date') 'A later successful fetch clears the recorded offline error'
    $config.GitCommand = $gitCommand
    Save-FixtureConfig

    Commit-Version '0.1.24' 'invalid package identity' 'another-plugin'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'not dsh-toons') 'A remote package with a different name is rejected'
    Commit-Version '0.1.24-beta.1' 'unsupported prerelease version'
    Run-Updater -ExpectedExitCode 1
    Assert-True ((Read-State).error -match 'Unsupported release version') 'An unsupported remote prerelease is rejected'
    Assert-True (@(Read-Calls).Count -eq $callsBeforeGuards -and (Read-Installed).version -eq '0.1.23') 'Invalid remote manifests do not build or replace the installed plugin'
    Commit-Version '0.1.24' 'valid release after rejected manifests'
    Run-Updater
    Assert-True ((Read-State).status -eq 'installed' -and (Read-Installed).version -eq '0.1.24') 'A valid later release installs after earlier failures'
    Write-Host "All integration checks passed. Fixtures: $fixtureRoot"
} finally {
    [Environment]::SetEnvironmentVariable('TOONS_FIXTURE_CALLS', $oldCalls, 'Process')
    [Environment]::SetEnvironmentVariable('TOONS_FIXTURE_FAIL', $oldFail, 'Process')
    foreach ($name in $extraEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $extraEnvironment[$name], 'Process') }
}
