# Android APK on Windows without Developer Mode.
#
# `tauri android build` links the Rust library into the Gradle project with a symlink, which Windows
# refuses without Developer Mode / admin rights. This script lets Tauri compile (the link step then
# fails), copies the libraries itself, and runs Gradle directly.
#
#   scripts\build-android-win.ps1            debug APK, arm64 only (fast, for trying a change)
#   scripts\build-android-win.ps1 -Release   signed release APK for arm64 + armv7 (any phone)
#
# The release build is signed with the keystore named in src-tauri\gen\android\keystore.properties
# (git-ignored). Keep that keystore: an app can only be updated by an APK signed with the same key.
#
# Needs: JDK 17+, Android SDK + NDK, and `rustup target add aarch64-linux-android armv7-linux-androideabi`.
param(
  [switch]$Release,
  [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\MyEnglish-android")
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not $env:JAVA_HOME) {
  $jdk = Get-ChildItem "C:\Program Files\Java" -Directory -Filter "jdk-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if (-not $env:NDK_HOME) {
  $ndk = Get-ChildItem (Join-Path $env:ANDROID_HOME "ndk") -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $ndk) { throw "No Android NDK found under $env:ANDROID_HOME\ndk" }
  $env:NDK_HOME = $ndk.FullName
}
$env:ANDROID_NDK_HOME = $env:NDK_HOME

$android = Join-Path $root "src-tauri\gen\android"
if ($Release -and -not (Test-Path (Join-Path $android "keystore.properties"))) {
  throw "No keystore.properties in ${android}. Create the signing key first (see the header of this script)."
}

# rust target, Tauri target name, ABI folder in the APK
$targets = if ($Release) {
  @(@{ Triple = "aarch64-linux-android"; Name = "aarch64"; Abi = "arm64-v8a" },
    @{ Triple = "armv7-linux-androideabi"; Name = "armv7"; Abi = "armeabi-v7a" })
} else {
  @(@{ Triple = "aarch64-linux-android"; Name = "aarch64"; Abi = "arm64-v8a" })
}
$buildProfile = if ($Release) { "release" } else { "debug" }

Push-Location $root
try {
  Write-Host "==> Compiling the frontend and the Rust library ($buildProfile)..."
  # One target per run: Tauri stops at the first failed symlink, before it compiles the next target.
  # The failure at the symlink step is expected on Windows without Developer Mode: the library is already built.
  foreach ($t in $targets) {
    $tauriArgs = @("tauri", "android", "build", "--apk", "--target", $t.Name)
    if (-not $Release) { $tauriArgs += "--debug" }
    cmd /c "npx $($tauriArgs -join ' ') 2>&1"
  }
} finally { Pop-Location }

$jniRoot = Join-Path $android "app\src\main\jniLibs"
Remove-Item $jniRoot -Recurse -Force -ErrorAction SilentlyContinue
$strip = Get-ChildItem (Join-Path $env:NDK_HOME "toolchains\llvm\prebuilt\*\bin\llvm-strip.exe") | Select-Object -First 1
foreach ($t in $targets) {
  $lib = Join-Path $root "src-tauri\target\$($t.Triple)\$buildProfile\libtauri_app_lib.so"
  if (-not (Test-Path $lib)) { throw "The Rust library for $($t.Triple) was not built: see the errors above." }
  $dir = Join-Path $jniRoot $t.Abi
  New-Item -ItemType Directory -Force $dir | Out-Null
  $dst = Join-Path $dir "libtauri_app_lib.so"
  Copy-Item $lib $dst -Force
  # Debug symbols make a debug library ~230 MB; stripped it is ~45 MB
  if ($strip -and -not $Release) { & $strip.FullName --strip-debug $dst }
}

$variant = if ($Release) { "UniversalRelease" } else { "Arm64Debug" }
$apkDir = Join-Path $android "app\build\outputs\apk"
# Gradle repackages into the old APK in place, which leaves dead space inside it: start clean
Remove-Item $apkDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "==> Packaging the APK with Gradle ($variant)..."
Push-Location $android
try {
  & .\gradlew.bat ":app:assemble$variant" -x "rustBuild$variant" --console=plain
  if ($LASTEXITCODE -ne 0) { throw "Gradle failed" }
} finally { Pop-Location }

$apk = Get-ChildItem $apkDir -Recurse -Filter "*.apk" | Select-Object -First 1
if (-not $apk) { throw "Gradle did not produce an APK" }
if ($Release -and $apk.Name -match "unsigned") { throw "The release APK is unsigned: check keystore.properties" }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$name = if ($Release) { "MyEnglish.apk" } else { "MyEnglish-debug.apk" }
$out = Join-Path (Resolve-Path $OutDir) $name
Copy-Item $apk.FullName $out -Force
Write-Host "==> Done: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)"
