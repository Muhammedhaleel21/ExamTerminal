# ExamTerminal - One-line file downloader for Windows PowerShell
# Usage: irm https://YOURDOMAIN.com/get.ps1 | iex

[CmdletBinding()]
param(
    [Parameter(ValueFromPipeline = $true)]
    [string]$Url = ""
)

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {}

$DefaultBaseUrl = "https://YOURDOMAIN.com"
$BaseUrl = $Url
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = $env:BASE_URL
}
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = $DefaultBaseUrl
}

if ($BaseUrl -eq "__BASE_URL__" -or $BaseUrl -eq "https://YOURDOMAIN.com") {
    if ([Environment]::UserInteractive) {
        $BaseUrl = Read-Host "Enter repository URL (e.g. https://yourdomain.com)"
    } else {
        Write-Error "BASE_URL is not configured. Please set `$env:BASE_URL or run build with deployment URL."
        exit 1
    }
}

$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  ExamTerminal File Downloader (Windows)   " -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Repository : $BaseUrl"
Write-Host "Destination: $($PWD.Path)\MyFiles"
Write-Host ""

$targetDir = Join-Path $PWD.Path "MyFiles"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# Embedded pre-compiled file list
$filesToDownload = @(
    [PSCustomObject]@{ urlPath = 'Data%20Mining/Module%201.txt'; relativePath = 'Data Mining/Module 1.txt' },
    [PSCustomObject]@{ urlPath = 'Data%20Mining/Questions.txt'; relativePath = 'Data Mining/Questions.txt' },
    [PSCustomObject]@{ urlPath = 'Machine%20learning/Module%201.txt'; relativePath = 'Machine learning/Module 1.txt' },
    [PSCustomObject]@{ urlPath = 'Machine%20learning/Module%202.txt'; relativePath = 'Machine learning/Module 2.txt' },
    [PSCustomObject]@{ urlPath = 'Machine%20learning/Module%203.txt'; relativePath = 'Machine learning/Module 3.txt' },
    [PSCustomObject]@{ urlPath = 'Python/Advanced.txt'; relativePath = 'Python/Advanced.txt' },
    [PSCustomObject]@{ urlPath = 'Python/Basics.txt'; relativePath = 'Python/Basics.txt' }
)

# Optional: Try to fetch latest manifest from the server if online
$manifestUrl = "$BaseUrl/downloads/manifest.json"
try {
    $wcManifest = New-Object System.Net.WebClient
    $manifestJson = $wcManifest.DownloadString($manifestUrl)
    $parsedManifest = $manifestJson | ConvertFrom-Json
    if ($parsedManifest.files -and $parsedManifest.files.Count -gt 0) {
        $filesToDownload = @()
        foreach ($f in $parsedManifest.files) {
            $filesToDownload += [PSCustomObject]@{
                urlPath      = $f.urlPath
                relativePath = $f.relativePath
            }
        }
    }
    $wcManifest.Dispose()
} catch {
    # If remote manifest fetch fails, the precompiled embedded list is used seamlessly
}

if ($filesToDownload.Count -eq 0) {
    Write-Warning "No files found to download."
    exit 0
}

$total = $filesToDownload.Count
$downloaded = 0
$skipped = 0
$failed = 0
$index = 0

$webClient = New-Object System.Net.WebClient

foreach ($item in $filesToDownload) {
    $index++
    $rel = $item.relativePath
    $urlPath = $item.urlPath
    $pct = [math]::Round(($index / $total) * 100)

    $normalizedRel = $rel -replace '/', [System.IO.Path]::DirectorySeparatorChar
    $destination = Join-Path $targetDir $normalizedRel
    $parent = Split-Path $destination -Parent

    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Write-Host "[$index/$total] ($pct%) $rel" -ForegroundColor White -NoNewline

    # Avoid overwriting existing files without warning
    if (Test-Path $destination) {
        $shouldOverwrite = $false
        if ($env:FORCE -eq "1" -or $env:OVERWRITE -eq "1") {
            $shouldOverwrite = $true
        } elseif ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
            Write-Host ""
            $ans = Read-Host "  File '$rel' already exists. Overwrite? [y/N]"
            if ($ans -match '^[Yy]$') {
                $shouldOverwrite = $true
            }
        }

        if (-not $shouldOverwrite) {
            Write-Host " -> [SKIPPED: File exists]" -ForegroundColor Yellow
            $skipped++
            continue
        }
    }

    $downloadUrl = "$BaseUrl/downloads/$urlPath"
    try {
        $webClient.DownloadFile($downloadUrl, $destination)
        Write-Host " -> [OK]" -ForegroundColor Green
        $downloaded++
    } catch {
        Write-Host " -> [FAILED: $($_.Exception.Message)]" -ForegroundColor Red
        $failed++
    }
}

$webClient.Dispose()

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Download Complete!" -ForegroundColor Green
Write-Host "  Downloaded: $downloaded"
Write-Host "  Skipped:    $skipped"
Write-Host "  Failed:     $failed"
Write-Host "  Total:      $total"
Write-Host "Files saved in: $targetDir"
Write-Host "===========================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
