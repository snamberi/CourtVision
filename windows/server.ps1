# CourtVision - local launcher for Windows.
# Serves the app in the "app" folder on http://localhost and opens it in your browser.
# Uses only what ships with Windows (PowerShell 5.1 + .NET). No installs, no admin rights.

$ErrorActionPreference = 'Stop'

$PreferredPort = 47820
$PortsToTry    = 10
$Root          = Join-Path $PSScriptRoot 'app'

function Show-Fatal($message) {
    Write-Host ''
    Write-Host "  $message" -ForegroundColor Red
    Write-Host ''
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) {
    Show-Fatal "Could not find the 'app' folder next to this script. Extract the WHOLE zip first (right-click, Extract All), then run Start CourtVision.bat from the extracted folder."
}
$Sep = [System.IO.Path]::DirectorySeparatorChar
$RootFull = [System.IO.Path]::GetFullPath($Root)
if (-not $RootFull.EndsWith([string]$Sep)) { $RootFull = $RootFull + $Sep }

$MimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.map'  = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.txt'  = 'text/plain; charset=utf-8'
    '.wasm' = 'application/wasm'
}

function Open-App($url) {
    # A dedicated app-style window when Edge or Chrome is available, otherwise the default browser.
    foreach ($browser in @('msedge', 'chrome')) {
        try {
            Start-Process -FilePath $browser -ArgumentList "--app=$url" -ErrorAction Stop
            return
        } catch { }
    }
    try { Start-Process $url } catch { Write-Host "  Open this address in your browser: $url" }
}

function New-Listener($port) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$port/")
    try { $l.Start(); return $l } catch { return $null }
}

# Your saved leagues live in the browser, and browsers keep them per address (including the port number).
# So we always try the same port first. If it is taken, check whether it is already CourtVision running.
$listener = New-Listener $PreferredPort
$port = $PreferredPort

if ($null -eq $listener) {
    $alreadyRunning = $false
    try {
        $probe = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$PreferredPort/" -TimeoutSec 3
        if ($probe.Content -match 'CourtVision') { $alreadyRunning = $true }
    } catch { }

    if ($alreadyRunning) {
        Write-Host ''
        Write-Host '  CourtVision is already running - opening it.' -ForegroundColor Green
        Open-App "http://localhost:$PreferredPort/"
        Start-Sleep -Seconds 2
        exit 0
    }

    for ($i = 1; $i -lt $PortsToTry; $i++) {
        $port = $PreferredPort + $i
        $listener = New-Listener $port
        if ($null -ne $listener) { break }
    }
    if ($null -eq $listener) { Show-Fatal "Could not start the local server: ports $PreferredPort-$($PreferredPort + $PortsToTry - 1) are all in use." }

    Write-Host ''
    Write-Host "  Note: port $PreferredPort is busy, so CourtVision is using port $port instead." -ForegroundColor Yellow
    Write-Host '  Leagues saved on a different port will not appear here. Close whatever is using the port, or use Export/Import inside the app.' -ForegroundColor Yellow
}

$url = "http://localhost:$port/"

Write-Host ''
Write-Host '  ================================================' -ForegroundColor DarkYellow
Write-Host '   COURTVISION is running' -ForegroundColor Yellow
Write-Host "   $url" -ForegroundColor White
Write-Host '   Close this window to stop it.' -ForegroundColor Gray
Write-Host '  ================================================' -ForegroundColor DarkYellow
Write-Host ''

Open-App $url

try {
    while ($listener.IsListening) {
        $pending = $listener.GetContextAsync()
        # Wake up regularly so Ctrl+C / closing the window is always responsive.
        while (-not $pending.Wait(250)) { }
        $context  = $pending.GetAwaiter().GetResult()
        $request  = $context.Request
        $response = $context.Response

        try {
            $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($urlPath -eq '/') { $urlPath = '/index.html' }

            $relative = $urlPath.TrimStart('/').Replace('/', [string]$Sep)
            $full = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))

            if (-not $full.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
            }
            elseif (-not [System.IO.File]::Exists($full)) {
                $response.StatusCode = 404
            }
            else {
                $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
                $type = $MimeTypes[$ext]
                if ($null -eq $type) { $type = 'application/octet-stream' }

                $bytes = [System.IO.File]::ReadAllBytes($full)
                $response.StatusCode = 200
                $response.ContentType = $type
                $response.ContentLength64 = $bytes.Length
                if ($ext -eq '.html') { $response.Headers.Add('Cache-Control', 'no-cache') }
                if ($request.HttpMethod -ne 'HEAD') {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            }
        }
        catch {
            # A single failed request (e.g. the browser cancelled it) must never take the server down.
            try { $response.StatusCode = 500 } catch { }
        }
        finally {
            try { $response.Close() } catch { }
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
