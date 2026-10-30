// Releases the Android app in one go: version, signed APK, checks, GitHub release, the in-app update notice.
//
//   npm run release -- --notes-file notes.txt [--bump patch|minor|major] [--publish]
//
// Without --publish it stops after the checks (nothing leaves this computer). With it, in this order:
//   1. pushes main (the release's tag points at it),
//   2. puts MyEnglish-v<version>.apk on a GitHub release v<version>,
//   3. waits until that APK can be downloaded,
//   4. publishes the notice (scripts/publish-app-update.mjs --push): apps on an older version offer the update.
//
// --bump raises the version in package.json, tauri.conf.json, Cargo.toml and Cargo.lock and commits it; without it the
// current version is released (it must not be released already). The notes are what learners read in the app: put them
// in a UTF-8 file (--notes-file), because Windows PowerShell mangles Vietnamese passed on the command line.
//
// Needs the GitHub CLI, logged in once: winget install GitHub.cli, then gh auth login.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "..", "MyEnglish-android");
// The certificate every release is signed with (SHA-256): an APK signed with another key cannot update the app
const RELEASE_CERT = "e2ff54d576a0ce2eaf59a5f28e74b1b14920f22d156a1e9aa9c24cf9bdb340e8";

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const publish = args.includes("--publish");

function run(cmd, cmdArgs, options = {}) {
  return execFileSync(cmd, cmdArgs, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}
function step(text) {
  console.log(`\n==> ${text}`);
}
function fail(text) {
  console.error(`\nDừng lại: ${text}`);
  process.exit(1);
}

// ---- What is released, and is it ready ----
const notesFile = opt("--notes-file");
const notes = notesFile ? readFileSync(notesFile, "utf8").trim() : (opt("--notes") ?? "").trim();
if (!notes) fail("thiếu ghi chú phát hành (--notes-file notes.txt): người dùng sẽ đọc nó trong app.");

if (run("git", ["branch", "--show-current"]) !== "main") fail("phải phát hành từ nhánh main.");
if (run("git", ["status", "--porcelain"])) fail("còn thay đổi chưa commit (git status).");
if (publish) {
  try {
    run("gh", ["auth", "status"]);
  } catch {
    fail("chưa có GitHub CLI hoặc chưa đăng nhập: winget install GitHub.cli, rồi gh auth login.");
  }
}

const bump = opt("--bump");
const current = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
let version = current;
if (bump) {
  const [major, minor, patch] = current.split(".").map(Number);
  version =
    bump === "major" ? `${major + 1}.0.0` : bump === "minor" ? `${major}.${minor + 1}.0` : bump === "patch" ? `${major}.${minor}.${patch + 1}` : "";
  if (!version) fail(`--bump phải là patch, minor hoặc major (không phải "${bump}").`);
}
const tag = `v${version}`;
if (publish) {
  let exists = true;
  try {
    run("gh", ["release", "view", tag]);
  } catch {
    exists = false;
  }
  if (exists) fail(`bản ${tag} đã có trên GitHub. Dùng --bump để lên phiên bản mới.`);
}

if (bump) {
  step(`Nâng phiên bản ${current} → ${version}`);
  const edit = (file, from, to) => {
    const path = join(root, file);
    const text = readFileSync(path, "utf8");
    if (!text.includes(from)) fail(`không tìm thấy "${from}" trong ${file}.`);
    writeFileSync(path, text.replace(from, to));
  };
  edit("package.json", `"version": "${current}"`, `"version": "${version}"`);
  edit("src-tauri/tauri.conf.json", `"version": "${current}"`, `"version": "${version}"`);
  edit("src-tauri/Cargo.toml", `version = "${current}"`, `version = "${version}"`);
  edit("src-tauri/Cargo.lock", `name = "tauri-app"\nversion = "${current}"`, `name = "tauri-app"\nversion = "${version}"`);
  run("git", ["commit", "-q", "-am", `chore: version ${version}`]);
}

// ---- Build and check the APK ----
step(`Build bản phát hành ${version} (vài phút)`);
execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(root, "scripts", "build-android-win.ps1"), "-Release"], {
  cwd: root,
  stdio: "inherit",
});
const apk = join(outDir, `MyEnglish-v${version}.apk`);
if (!existsSync(apk)) fail(`không thấy ${apk} sau khi build.`);

step("Kiểm tra APK");
const sdk = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const buildTools = join(sdk, "build-tools", readdirSync(join(sdk, "build-tools")).sort().reverse()[0]);
const badging = run(join(buildTools, "aapt2.exe"), ["dump", "badging", apk]);
if (!badging.includes(`versionName='${version}'`)) fail(`APK không mang phiên bản ${version}.`);
const certs = run("cmd", ["/c", join(buildTools, "apksigner.bat"), "verify", "--print-certs", apk]);
if (!certs.includes(RELEASE_CERT)) fail("APK không được ký bằng khóa phát hành: người dùng sẽ không cập nhật được.");
const files = run("tar", ["-tf", apk]);
if (!files.includes("assets/vosk-model-en/am/")) fail("APK thiếu mô hình nhận dạng giọng nói.");
for (const abi of ["arm64-v8a", "armeabi-v7a"]) if (!files.includes(`lib/${abi}/libtauri_app_lib.so`)) fail(`APK thiếu bản cho ${abi}.`);
console.log(`OK: ${apk}\n    phiên bản ${version}, đúng khóa ký, có mô hình giọng nói, arm64 + armv7`);

if (!publish) {
  console.log(`\nChưa gửi gì lên GitHub. Chạy lại với --publish để phát hành ${tag}.`);
  process.exit(0);
}

// ---- Publish ----
step("Đẩy main lên GitHub");
run("git", ["push", "-q", "origin", "main"]);

step(`Tạo GitHub release ${tag} kèm APK`);
const notesPath = join(outDir, `release-notes-${version}.txt`);
writeFileSync(notesPath, notes);
run("gh", ["release", "create", tag, apk, "--title", tag, "--notes-file", notesPath, "--target", "main"]);

step("Chờ tải được APK");
const repo = /github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/.exec(run("git", ["remote", "get-url", "origin"]))?.[1];
const url = `https://github.com/${repo}/releases/download/${tag}/MyEnglish-v${version}.apk`;
let reachable = false;
for (let i = 0; i < 20 && !reachable; i++) {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" }).catch(() => null);
  reachable = !!res?.ok;
  if (!reachable) await new Promise((r) => setTimeout(r, 3000));
}
if (!reachable) fail(`chưa tải được ${url}. Thông báo cập nhật chưa gửi: kiểm tra release rồi chạy node scripts/publish-app-update.mjs --notes-file ... --push`);

step("Gửi thông báo cập nhật cho app");
execFileSync("node", [join(root, "scripts", "publish-app-update.mjs"), "--notes", notes, "--apk", apk, "--push"], { cwd: root, stdio: "inherit" });

console.log(`\nXong: ${tag} đã phát hành. App bản cũ sẽ báo có bản mới.`);
