// Publishes the Shadowing lessons to the "shadowing-feed" branch of the repo, where the app downloads
// the new ones from (see src/services/shadowingFeed.ts and src/services/talk/situationFeed.ts):
// index.json + lessons/<id>.json for Shadowing, situations.json for the Hội thoại tab.
// The branch holds only these data files, so it never touches the code of the other branches.
//
//   node scripts/publish-shadowing-feed.mjs          prepares the commit and shows what would be sent
//   node scripts/publish-shadowing-feed.mjs --push   sends it
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "src", "data", "shadowing");
const BRANCH = "shadowing-feed";
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const remote = git(root, "remote", "get-url", "origin");
const work = mkdtempSync(join(tmpdir(), "shadowing-feed-"));
try {
  git(work, "init", "-q");
  git(work, "symbolic-ref", "HEAD", `refs/heads/${BRANCH}`);
  git(work, "remote", "add", "origin", remote);
  // Start from what is already published so the commit only holds the difference
  let hasBranch = true;
  try {
    git(work, "fetch", "-q", "--depth", "1", "origin", BRANCH);
    git(work, "reset", "-q", "--soft", "FETCH_HEAD");
  } catch {
    hasBranch = false;
  }
  cpSync(join(dataDir, "index.json"), join(work, "index.json"));
  cpSync(join(dataDir, "lessons"), join(work, "lessons"), { recursive: true });
  // The conversations written in bulk (npm run gen:situations): situations.json, which the app reads for its daily new ones
  const talkDir = join(root, "src", "data", "situations", "generated");
  const talks = existsSync(talkDir)
    ? readdirSync(talkDir)
        .filter((f) => f.endsWith(".json"))
        .flatMap((f) => JSON.parse(readFileSync(join(talkDir, f), "utf8")))
    : [];
  writeFileSync(join(work, "situations.json"), JSON.stringify(talks));
  git(work, "add", "-A");
  const changed = git(work, "status", "--porcelain");
  if (!changed) {
    console.log("The feed is up to date, nothing to send.");
  } else {
    const lines = changed.split("\n");
    console.log(`${lines.length} file(s) ${hasBranch ? "new or changed" : "to publish (first time)"}.`);
    git(work, "-c", "user.name=shadowing-feed", "-c", "user.email=shadowing-feed@users.noreply.github.com", "commit", "-q", "-m", `Shadowing feed: ${lines.length} file(s)`);
    if (process.argv.includes("--push")) {
      git(work, "push", "-q", "origin", `${BRANCH}:${BRANCH}`);
      console.log(`Sent to origin/${BRANCH}.`);
    } else {
      console.log("Not sent. Run again with --push to publish.");
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
