// Publishes the web app on GitHub Pages: https://<owner>.github.io/<repo>/
//
//   node scripts/publish-web.mjs            build into dist-web and check it, send nothing
//   node scripts/publish-web.mjs --push     ... then put it on the gh-pages branch (one commit, replaced each time)
//                                           and turn GitHub Pages on the first time
//
// The build carries the VITE_ values of .env.local (the Supabase address and anon key, the VAPID public key): all
// public by design. It is checked for anything that must not be public before it leaves (a service_role key, a
// private key); the check stops the publish rather than guess.
//
// Needs the GitHub CLI, logged in (gh auth login).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-web");
const BRANCH = "gh-pages";
const push = process.argv.includes("--push");
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = (text) => {
  console.error(`\nDừng lại: ${text}`);
  process.exit(1);
};

const remote = git(root, "remote", "get-url", "origin");
const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(remote);
if (!match) fail(`không đọc được repo GitHub từ "${remote}".`);
const [, owner, repo] = match;
const base = `/${repo}/`;
const site = `https://${owner.toLowerCase()}.github.io${base}`;

// ---- Build ----
console.log(`==> Build bản web cho ${site}`);
rmSync(out, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", out, "--emptyOutDir"], {
  cwd: root,
  stdio: ["ignore", "ignore", "inherit"],
  env: { ...process.env, WEB_BASE: base },
});

// ---- Check ----
console.log("==> Kiểm tra bản build");
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(out);
for (const must of ["index.html", "manifest.webmanifest", "sw.js", "push-sw.js"]) {
  if (!files.some((f) => f.endsWith(join(out, must)))) fail(`bản build thiếu ${must}.`);
}
if (!files.some((f) => /sql-wasm-.*\.wasm$/.test(f))) fail("bản build thiếu SQLite (WebAssembly).");
if (!readFileSync(join(out, "index.html"), "utf8").includes(`${base}assets/`)) fail(`index.html không trỏ vào ${base}assets/.`);

// Nothing secret: JWTs found in the code must be anon ones, no private key blocks, no known secret prefixes
const decode = (part) => {
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
};
for (const f of files.filter((p) => /\.(js|html|json|webmanifest)$/.test(p))) {
  const text = readFileSync(f, "utf8");
  for (const [, payload] of text.matchAll(/eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g)) {
    const claims = decode(payload);
    if (claims && claims.role && claims.role !== "anon") fail(`${f} chứa một khóa Supabase vai trò "${claims.role}". Kiểm tra .env.local.`);
  }
  if (/sb_secret_[\w-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|service_role/i.test(text.replace(/service_role["'` ]*(key)?["'`]? *(must|never|not)/gi, ""))) {
    fail(`${f} có thứ trông như khóa bí mật (service_role / private key). Kiểm tra .env.local.`);
  }
}
writeFileSync(join(out, ".nojekyll"), "");
const size = files.reduce((s, f) => s + statSync(f).size, 0);
console.log(`OK: ${files.length} file, ${(size / 1024 / 1024).toFixed(1)} MB, không có khóa bí mật`);

if (!push) {
  console.log(`\nChưa gửi gì. Chạy lại với --push để đăng lên ${site}`);
  process.exit(0);
}

// ---- Publish: one fresh commit on gh-pages (the site's history is not worth 30 MB per version) ----
console.log(`==> Đăng lên nhánh ${BRANCH}`);
const work = mkdtempSync(join(tmpdir(), "publish-web-"));
try {
  execFileSync(process.execPath, ["-e", `require("fs").cpSync(${JSON.stringify(out)}, ${JSON.stringify(work)}, { recursive: true })`]);
  git(work, "init", "-q");
  git(work, "symbolic-ref", "HEAD", `refs/heads/${BRANCH}`);
  git(work, "add", "-A");
  git(work, "-c", "user.name=publish-web", "-c", "user.email=publish-web@users.noreply.github.com", "commit", "-q", "-m", "Web app");
  git(work, "push", "-q", "--force", remote, `${BRANCH}:${BRANCH}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

// Pages on, from that branch (only the first time; later the push alone updates the site)
const gh = (...a) => execFileSync("gh", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let enabled = true;
try {
  gh("api", `repos/${owner}/${repo}/pages`);
} catch {
  enabled = false;
}
if (!enabled) {
  console.log("==> Bật GitHub Pages cho repo");
  gh("api", "-X", "POST", `repos/${owner}/${repo}/pages`, "-f", `source[branch]=${BRANCH}`, "-f", "source[path]=/");
}
console.log(`\nXong. Vài phút nữa bản web có ở ${site}`);
