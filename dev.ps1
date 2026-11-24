param([ValidateRange(1, 65535)][int]$FrontendPort = 3000)

$ErrorActionPreference = 'Stop'

function Read-DevEnvironment($path) {
    $values = @{}
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) { return $values }

    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $path) {
        $lineNumber++
        if ($line -match '^\s*(#.*)?$') { continue }
        if ($line -notmatch '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            throw "Invalid variable in ${path} at line $lineNumber."
        }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.StartsWith('"') -or $value.StartsWith("'")) {
            if ($value -notmatch '^(["''])(.*?)\1(?:\s+#.*)?$') {
                throw "Invalid quoted value in ${path} at line $lineNumber."
            }
            $value = $Matches[2]
        } else {
            $value = $value -replace '\s+#.*$', ''
        }
        $values[$name] = $value
    }

    return $values
}

function Start-DevProcess($file, $directory, $arguments, $variables) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $file
    $info.WorkingDirectory = $directory
    $info.Arguments = $arguments
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    foreach ($name in $variables.Keys) {
        $info.EnvironmentVariables[$name] = $variables[$name]
    }
    return [Diagnostics.Process]::Start($info)
}

$apps = 'api-gateway', 'identity-api', 'ledger-api', 'budgets-api', 'analytics-api', 'notifications-api'
$settings = @{}
if ($FrontendPort -eq 3443) { throw 'FrontendPort is reserved for the HTTPS proxy.' }
$ports = @(3443, $FrontendPort)
for ($i = 0; $i -lt $apps.Count; $i++) {
    $app = $apps[$i]
    $variables = Read-DevEnvironment (Join-Path $PSScriptRoot "apps/$app/.env")
    if (!$variables.ContainsKey('HTTP_ADDR')) {
        $variables['HTTP_ADDR'] = "127.0.0.1:$($i + 8080)"
    }
    if ($variables['HTTP_ADDR'] -notmatch '^(?:127\.0\.0\.1|localhost)?:(\d{1,5})$') {
        throw "$app HTTP_ADDR must be a local address and port."
    }
    $port = [int]$Matches[1]
    if ($port -lt 1 -or $port -gt 65535 -or $port -in $ports) {
        throw "$app HTTP_ADDR uses an invalid or duplicate port ($port)."
    }

    $ports += $port
    $variables['HTTP_ADDR'] = "127.0.0.1:$port"
    $settings[$app] = $variables
}

$gateway = $settings['api-gateway']
for ($i = 1; $i -lt $apps.Count; $i++) {
    $app = $apps[$i]
    $name = $app.Replace('-api', '').ToUpperInvariant() + '_URL'
    if (!$gateway.ContainsKey($name)) {
        $gateway[$name] = "http://$($settings[$app]['HTTP_ADDR'])"
    }
}

$local = Join-Path $PSScriptRoot '.local'
$null = New-Item -ItemType Directory -Path $local -Force
$air = Get-Command air -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($air) {
    $airPath = $air.Source
} else {
    $bin = Join-Path $local 'bin'
    $airPath = Join-Path $bin 'air.exe'
    if (!(Test-Path -LiteralPath $airPath -PathType Leaf)) {
        $previousGoBin = $env:GOBIN
        try {
            $env:GOBIN = $bin
            go install github.com/air-verse/air@v1.61.7
            if ($LASTEXITCODE) { throw 'Air installation failed.' }
        } finally {
            $env:GOBIN = $previousGoBin
        }
    }
}

$proxyPath = Join-Path $local 'devproxy.exe'
go -C (Join-Path $PSScriptRoot 'apps/api-gateway') build -o $proxyPath ./cmd/devproxy
if ($LASTEXITCODE) { throw 'HTTPS proxy build failed.' }

$processes = [ordered]@{}
try {
    $proxyArgs = "-gateway http://$($gateway['HTTP_ADDR']) -frontend http://127.0.0.1:$FrontendPort"
    $processes['devproxy'] = Start-DevProcess $proxyPath $PSScriptRoot $proxyArgs @{}
    $airConfig = Join-Path $PSScriptRoot '.air.toml'
    foreach ($app in $apps) {
        $dir = Join-Path $PSScriptRoot "apps/$app"
        $processes[$app] = Start-DevProcess $airPath $dir "-c `"$airConfig`"" $settings[$app]
    }

    Write-Host 'HTTPS: https://localhost:3443. Press Ctrl+C to stop.'
    while ($true) {
        foreach ($name in $processes.Keys) {
            if ($processes[$name].HasExited) {
                throw "$name stopped (exit $($processes[$name].ExitCode))."
            }
        }
        Start-Sleep -Milliseconds 500
    }
} finally {
    foreach ($process in $processes.Values) {
        if (!$process.HasExited) {
            taskkill.exe /F /T /PID $process.Id | Out-Null
        }
        $process.Dispose()
    }
}
