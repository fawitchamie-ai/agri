$ErrorActionPreference = "Stop"

$desktopRoot = $PSScriptRoot
$tauriRoot = Join-Path $desktopRoot "src-tauri"
$cargoPath = Join-Path $tauriRoot "Cargo.toml"
$binaryPath = Join-Path $tauriRoot "target\release\agriprevision-desktop.exe"
$iconPath = Join-Path $tauriRoot "icons\256x256.png"
$outputRoot = Join-Path $tauriRoot "target\release\bundle\msix"
$stageRoot = Join-Path $outputRoot "package"
$verifyRoot = Join-Path $outputRoot "verify"

if (-not (Test-Path $binaryPath)) {
    throw "Binaire Windows introuvable : $binaryPath"
}
if (-not (Test-Path $iconPath)) {
    throw "Icône source introuvable : $iconPath"
}

$cargo = Get-Content -Path $cargoPath -Raw
$versionMatch = [regex]::Match($cargo, '(?m)^version\s*=\s*"(\d+\.\d+\.\d+)"')
if (-not $versionMatch.Success) {
    throw "Impossible de lire la version majeure.mineure.correctif dans Cargo.toml."
}
$packageVersion = $versionMatch.Groups[1].Value + ".0"

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
Remove-Item -LiteralPath $stageRoot, $verifyRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $stageRoot "Assets") | Out-Null

Copy-Item -LiteralPath $binaryPath -Destination (Join-Path $stageRoot "AgriPrevision.exe")

Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Image]::FromFile($iconPath)
try {
    foreach ($size in @(50, 150, 44)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
            }
            finally {
                $graphics.Dispose()
            }
            $logoName = switch ($size) {
                50 { "StoreLogo.png" }
                150 { "Square150x150Logo.png" }
                44 { "Square44x44Logo.png" }
            }
            $bitmap.Save((Join-Path $stageRoot "Assets\$logoName"), [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $bitmap.Dispose()
        }
    }
}
finally {
    $sourceImage.Dispose()
}

$manifest = @'
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap uap10 rescap">
  <Identity Name="TCHAMIE.AgriPrev"
            Publisher="CN=0A18DBA0-F7CD-4C66-886F-21E5428E8A8F"
            Version="__VERSION__"
            ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>AgriPrev</DisplayName>
    <PublisherDisplayName>TCHAMIE</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop"
                        MinVersion="10.0.19041.0"
                        MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="fr-FR" />
  </Resources>
  <Applications>
    <Application Id="AgriPrev"
                 Executable="AgriPrevision.exe"
                 uap10:RuntimeBehavior="packagedClassicApp"
                 uap10:TrustLevel="mediumIL">
      <uap:VisualElements DisplayName="AgriPrev"
                          Description="Application de bureau AgriPrévision pour le suivi des parcelles."
                          BackgroundColor="#FFFFFF"
                          Square150x150Logo="Assets\Square150x150Logo.png"
                          Square44x44Logo="Assets\Square44x44Logo.png" />
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
'@ -replace "__VERSION__", $packageVersion

$manifestPath = Join-Path $stageRoot "AppxManifest.xml"
[System.IO.File]::WriteAllText($manifestPath, $manifest, (New-Object System.Text.UTF8Encoding($false)))

$programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
$sdkRoot = Join-Path $programFilesX86 "Windows Kits\10\bin"
$makeAppx = Get-ChildItem -Path $sdkRoot -Directory |
    Sort-Object Name -Descending |
    ForEach-Object {
        $candidate = Join-Path $_.FullName "x64\MakeAppx.exe"
        if (Test-Path $candidate) { Get-Item $candidate }
    } |
    Select-Object -First 1
if (-not $makeAppx) {
    throw "MakeAppx.exe est introuvable dans le Windows SDK."
}

$packagePath = Join-Path $outputRoot "AgriPrev_$($packageVersion)_x64.msix"
& $makeAppx.FullName pack /d $stageRoot /p $packagePath /o
if ($LASTEXITCODE -ne 0) {
    throw "MakeAppx a échoué lors de la création du paquet (code $LASTEXITCODE)."
}

& $makeAppx.FullName unpack /p $packagePath /d $verifyRoot
if ($LASTEXITCODE -ne 0) {
    throw "MakeAppx n'a pas pu relire le paquet créé (code $LASTEXITCODE)."
}
$verifiedManifest = [xml](Get-Content -Path (Join-Path $verifyRoot "AppxManifest.xml") -Raw)
if ($verifiedManifest.Package.Identity.Name -ne "TCHAMIE.AgriPrev" -or
    $verifiedManifest.Package.Identity.Publisher -ne "CN=0A18DBA0-F7CD-4C66-886F-21E5428E8A8F" -or
    $verifiedManifest.Package.Identity.ProcessorArchitecture -ne "x64") {
    throw "L’identité lue dans le MSIX ne correspond pas aux valeurs du Partner Center."
}

Write-Host "MSIX créé et relu : $packagePath"
Write-Host "Version : $packageVersion"
Write-Host "Signature : absente, à soumettre au Microsoft Store qui signera le paquet après certification."
