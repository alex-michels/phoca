<#
  schedule-sweep.ps1 — put the weekly fee sweep on a timer (Windows).

  Registers a Scheduled Task that runs `npm run collect-fees` in this repo
  every Sunday at 12:00 (catches up if the machine was off). Run this
  DELIBERATELY yourself — the repo never registers system tasks on its own:

    powershell -ExecutionPolicy Bypass -File scripts\schedule-sweep.ps1           # register
    powershell -ExecutionPolicy Bypass -File scripts\schedule-sweep.ps1 -Remove   # unregister

  Output of each run is appended to sweep-task.log in the repo root
  (git-ignored via *.log). The sweep itself appends its entry to
  docs/TRANSPARENCY-LOG.md — COMMITTING that entry stays a human step, via
  PR (CLAUDE.md rule 9): review what moved, then commit. On Linux/Mac use
  cron instead: `0 12 * * 0  cd /path/to/phoca && npm run collect-fees`.
#>
param([switch]$Remove)

$TaskName = "PHOCA weekly fee sweep"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'."
  exit 0
}

$npm = (Get-Command npm.cmd).Source
$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c `"`"$npm`" run collect-fees >> sweep-task.log 2>&1`"" `
  -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 12:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Description ("Sweeps withheld PHOCA fees (devnet), splits the pot, " +
  "appends docs/TRANSPARENCY-LOG.md. Registered by scripts/schedule-sweep.ps1.") | Out-Null

Write-Host "Registered '$TaskName' - Sundays 12:00, repo: $RepoRoot"
Write-Host "Runs: npm run collect-fees (output appended to sweep-task.log)"
Write-Host "Reminder: committing the transparency-log entry stays a PR (rule 9)."
