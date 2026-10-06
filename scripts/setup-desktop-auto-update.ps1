[CmdletBinding()]
param(
    [string]$RepositoryUrl = 'https://github.com/Hjh-12138/DSH-Pixel-Toons.git',
    [string]$Branch = 'main',
    [string]$DshCommand = 'D:\DSH\resources\runtime\cli\bin\dsh.cmd',
    [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
    [string]$StateDirectory = '',
    [ValidateRange(5, 1440)][int]$IntervalMinutes = 5,
    [string]$TaskName = 'DSH-Toons-AutoUpdate'
)

$ErrorActionPreference = 'Stop'
if (-not $StateDirectory) { $StateDirectory = Join-Path $PSScriptRoot '..\work\desktop-updater' }
$updater = Join-Path $PSScriptRoot 'auto-update-desktop.ps1'
$stateRoot = [IO.Path]::GetFullPath($StateDirectory)
$manifestPath = Join-Path $DshHome 'profiles\desktop\node_modules\dsh-toons\package.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Install dsh-toons in the desktop profile before enabling automatic updates.' }
if (-not (Test-Path -LiteralPath $DshCommand -PathType Leaf)) { throw "DSH command not found: $DshCommand" }
$installed = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($installed.version -notmatch '^\d+\.\d+\.\d+$') { throw 'Automatic updates require an installed stable x.y.z plugin version.' }
$configPath = Join-Path $stateRoot 'config.json'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$config = [ordered]@{
    RepositoryUrl = $RepositoryUrl
    Branch = $Branch
    StateDirectory = $stateRoot
    GitCommand = (Get-Command git.exe -ErrorAction Stop).Source
    NpmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
    DshCommand = [IO.Path]::GetFullPath($DshCommand)
    DshHome = [IO.Path]::GetFullPath($DshHome)
    DesktopProcessName = 'DeepSeek Harness'
    MinimumVersion = $installed.version
}
$config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

$powershellPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -ConfigPath "{1}"' -f $updater, $configPath
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $taskArguments -WorkingDirectory $stateRoot
$repeatTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -Hidden
$task = New-ScheduledTask -Action $action -Trigger @($repeatTrigger, $logonTrigger) -Principal $principal -Settings $settings -Description 'Build and update the DeepSeek Toons desktop plugin from GitHub main; keep newer local versions and wait for Desktop to exit before installation.'
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
Write-Host "Enabled $TaskName for $userId, every $IntervalMinutes minutes while logged in."
Write-Host "Configuration: $configPath"
Write-Host "Log: $(Join-Path $stateRoot 'update.log')"
