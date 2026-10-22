# Downloads the small English Vosk model (about 40 MB, Apache 2.0) into the Android project's assets, where
# AsrBridge.kt expects it. The folder is git-ignored; run this once on a fresh checkout before building the APK.
#
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-vosk-model.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $root "src-tauri\gen\android\app\src\main\assets\vosk-model-en"
if (Test-Path (Join-Path $dest "am")) { Write-Host "Model already there: $dest"; return }

$url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
$tmp = Join-Path $env:TEMP "vosk-model-download"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp "model.zip"
Write-Host "Downloading $url ..."
Invoke-WebRequest -Uri $url -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $tmp -Force
New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Move-Item (Join-Path $tmp "vosk-model-small-en-us-0.15") $dest
Remove-Item $tmp -Recurse -Force
Write-Host "Done: $dest"
