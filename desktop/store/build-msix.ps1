param(
  [Parameter(Mandatory = $true)][string]$PackageName,
  [Parameter(Mandatory = $true)][string]$Publisher,
  [Parameter(Mandatory = $true)][string]$PublisherDisplayName,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'output')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Use the exact Package/Identity values assigned by Partner Center for a Store submission.
if ($PackageName -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$') {
  throw 'PackageName must be the Package/Identity Name copied from Partner Center.'
}
if ($Publisher -notmatch '^CN=.+') {
  throw 'Publisher must be the complete Package/Identity Publisher value from Partner Center.'
}
if ([string]::IsNullOrWhiteSpace($PublisherDisplayName)) {
  throw 'PublisherDisplayName is required.'
}

$desktopRoot = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $desktopRoot 'src-tauri/target/release/agriprevision-desktop.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Desktop executable missing: $exe. Run npx tauri build --no-bundle first."
}

$sdkRoot = 'C:\Program Files (x86)\Windows Kits\10\bin'
$makeAppx = Get-ChildItem -LiteralPath $sdkRoot -Filter makeappx.exe -Recurse -File |
  Where-Object { $_.FullName -match '\\x64\\makeappx\.exe$' } |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $makeAppx) { throw 'Windows SDK MakeAppx.exe was not found.' }

$package = Get-Content -Raw (Join-Path $desktopRoot 'package.json') | ConvertFrom-Json
if ($package.version -notmatch '^(\d+)\.(\d+)\.(\d+)$') { throw 'Desktop version must have three numeric parts.' }
$version = "$($Matches[1]).$($Matches[2]).$($Matches[3]).0"

$stage = if ($env:RUNNER_TEMP) { Join-Path $env:RUNNER_TEMP 'agriprevision-msix-stage' } else { Join-Path $OutputDirectory 'stage' }
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $stage 'Assets') -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Copy-Item -LiteralPath $exe -Destination (Join-Path $stage 'agriprevision-desktop.exe')
Copy-Item -Path (Join-Path $PSScriptRoot 'assets/*.png') -Destination (Join-Path $stage 'Assets')

$xmlName = [System.Security.SecurityElement]::Escape($PackageName)
$xmlPublisher = [System.Security.SecurityElement]::Escape($Publisher)
$xmlDisplayName = [System.Security.SecurityElement]::Escape($PublisherDisplayName)
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap uap10 rescap">
  <Identity Name="$xmlName" Publisher="$xmlPublisher" Version="$version" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>AgriPrévision</DisplayName>
    <PublisherDisplayName>$xmlDisplayName</PublisherDisplayName>
    <Description>Suivi des parcelles et aides à la décision agricole</Description>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Resources><Resource Language="fr-FR" /></Resources>
  <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" /></Dependencies>
  <Applications>
    <Application Id="AgriPrevision" Executable="agriprevision-desktop.exe"
                 uap10:RuntimeBehavior="packagedClassicApp" uap10:TrustLevel="mediumIL">
      <uap:VisualElements DisplayName="AgriPrévision" Description="Suivi des parcelles"
                          BackgroundColor="transparent" Square150x150Logo="Assets\Logo150.png"
                          Square44x44Logo="Assets\Logo44.png" />
    </Application>
  </Applications>
  <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
"@
[xml]$parsed = $manifest
if ($parsed.Package.Identity.Name -ne $PackageName -or $parsed.Package.Identity.Publisher -ne $Publisher) {
  throw 'Package identity was not written correctly.'
}
$manifestPath = Join-Path $stage 'AppxManifest.xml'
[System.IO.File]::WriteAllText($manifestPath, $manifest, [System.Text.UTF8Encoding]::new($false))
$output = Join-Path $OutputDirectory "AgriPrevision_$($version)_x64_StoreSubmission.msix"
& $makeAppx pack /d $stage /p $output /o
if ($LASTEXITCODE -ne 0) { throw "MakeAppx pack failed ($LASTEXITCODE)." }

$unpacked = if ($env:RUNNER_TEMP) { Join-Path $env:RUNNER_TEMP 'agriprevision-msix-check' } else { Join-Path $OutputDirectory 'check' }
if (Test-Path -LiteralPath $unpacked) { Remove-Item -LiteralPath $unpacked -Recurse -Force }
& $makeAppx unpack /p $output /d $unpacked /o
if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $unpacked 'agriprevision-desktop.exe'))) {
  throw 'MSIX could not be unpacked or its executable is missing.'
}
Write-Output "Store submission candidate: $output"
Write-Output 'Unsigned MSIX. Submit through Partner Center; do not distribute this file directly.'
