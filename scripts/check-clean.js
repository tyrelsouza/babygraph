// Runs before `npm run build`: refuse to build unless the working tree matches a commit exactly,
// so the commit shown on the landing page is what's actually deployed.
// (The e2e tests and screenshot script call `vite build` directly and aren't affected.)
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = (message) => { console.error(`\nRefusing to build: ${message}\n`); process.exit(1); };

try {
  git("rev-parse", "--verify", "HEAD");
} catch {
  fail("no commits yet. Commit first, so the build can show which commit it came from.");
}
const status = git("status", "--porcelain");
if (status) {
  fail(`the working tree has staged, modified or untracked files:\n\n${status}\n\nCommit or stash them first, so the build matches a commit.`);
}
console.log(`Building from ${git("rev-parse", "--short", "HEAD")} (clean working tree)`);
