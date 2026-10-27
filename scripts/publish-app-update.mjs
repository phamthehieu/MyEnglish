// Publishes the "a new version is out" notice that the Android app reads (src/services/appUpdate.ts): a small
// app-update.json on the "app-update" branch of the repo, with the version of src-tauri/tauri.conf.json, where its APK is
// downloaded, and what is new. The branch holds only this file, so it never touches the code of the other branches.
//
// To release a version, in this order:
//   1. raise the version (package.json and src-tauri/tauri.conf.json), then build:
//        powershell -ExecutionPolicy Bypass -File scripts\build-android-win.ps1 -Release
//   2. put MyEnglish-v<version>.apk on a GitHub release named v<version> (the file keeps that name), for example:
//        gh release create v0.3.6 D:\nghich\MyEnglish-android\MyEnglish-v0.3.6.apk --title v0.3.6 --notes "..."
//   3. publish the notice (only after the APK can be downloaded, or learners get an error):
//        node scripts/publish-app-update.mjs --notes "What is new" [--push]
//      without --push it only shows what would be sent
//
// The APK must be signed with the same key as the one installed, and have a higher version, or Android refuses to
// install it over the old app.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRANCH = "app-update";
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const args = process.argv.slice(2);
const notesAt = args.indexOf("--notes");
const notes = notesAt >= 0 ? (args[notesAt + 1] ?? "") : "";

const tauriVersion = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8")).version;
const pkgVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
if (tauriVersion !== pkgVersion) {
  console.error(`The versions differ: package.json ${pkgVersion}, tauri.conf.json ${tauriVersion}. Make them the same first.`);
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(tauriVersion)) {
  console.error(`The version "${tauriVersion}" must look like 0.3.6.`);
  process.exit(1);
}

const remote = git(root, "remote", "get-url", "origin");
const repo = /github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/.exec(remote)?.[1];
if (!repo) {
  console.error(`Cannot read the GitHub repository from the remote "${remote}".`);
  process.exit(1);
}

const manifest = {
  version: tauriVersion,
  apkUrl: `https://github.com/${repo}/releases/download/v${tauriVersion}/MyEnglish-v${tauriVersion}.apk`,
  notes,
};
console.log(JSON.stringify(manifest, null, 2));
const localApk = join(root, "..", "MyEnglish-android", `MyEnglish-v${tauriVersion}.apk`);
if (!existsSync(localApk)) console.warn(`Warning: ${localApk} does not exist (build the release first).`);
if (!notes) console.warn('Warning: no --notes, learners will see no description of what is new.');

const work = mkdtempSync(join(tmpdir(), "app-update-"));
try {
  git(work, "init", "-q");
  git(work, "symbolic-ref", "HEAD", `refs/heads/${BRANCH}`);
  git(work, "remote", "add", "origin", remote);
  // Start from what is already published so the commit only holds the difference
  try {
    git(work, "fetch", "-q", "--depth", "1", "origin", BRANCH);
    git(work, "reset", "-q", "--soft", "FETCH_HEAD");
  } catch {
    /* first time: the branch does not exist yet */
  }
  writeFileSync(join(work, "app-update.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  git(work, "add", "-A");
  if (!git(work, "status", "--porcelain")) {
    console.log("The notice is up to date, nothing to send.");
  } else {
    git(work, "-c", "user.name=app-update", "-c", "user.email=app-update@users.noreply.github.com", "commit", "-q", "-m", `App update ${tauriVersion}`);
    if (args.includes("--push")) {
      git(work, "push", "-q", "origin", `${BRANCH}:${BRANCH}`);
      console.log(`Sent to origin/${BRANCH}. Learners on an older version will see the notice.`);
    } else {
      console.log("Not sent. Run again with --push to publish (the APK must be on the release first).");
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
