param(
    [string] $NodePath,
    [string] $ScriptPath
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$ownedProcess = $null
$launcherExitCode = 1
try {
    if (-not $NodePath) {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($nodeCommand) { $NodePath = $nodeCommand.Source }
        elseif (Test-Path -LiteralPath "$env:ProgramFiles\nodejs\node.exe") {
            $NodePath = "$env:ProgramFiles\nodejs\node.exe"
        }
        elseif (Test-Path -LiteralPath "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe") {
            $NodePath = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
            $env:ELECTRON_RUN_AS_NODE = '1'
        }
        else { throw 'Install Node.js 24 LTS (including npm), then reopen the terminal. See README.md.' }
    }
    if (-not $ScriptPath) { $ScriptPath = Join-Path $projectRoot 'server.cjs' }
    Add-Type -Path (Join-Path $PSScriptRoot 'ForegroundProcess.cs')
    Write-Host 'Starting Relay in this terminal. Close this terminal or press Ctrl+C to stop the app.'
    $ownedProcess = New-Object RelayForegroundProcess($NodePath, $ScriptPath, $projectRoot)
    # Short waits allow PowerShell to process Ctrl+C and execute finally.
    while (-not $ownedProcess.Child.WaitForExit(200)) { }
    $launcherExitCode = $ownedProcess.Child.ExitCode
}
catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    if ($ownedProcess) { $ownedProcess.Dispose() }
}
exit $launcherExitCode
