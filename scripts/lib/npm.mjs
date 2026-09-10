import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Regenerates just package-lock.json's version fields to match
// package.json's real current version, via npm itself rather than a
// hand-rolled JSON patch (npm's own lockfile format has real internal
// structure - e.g. `.packages[""].version` - not worth reimplementing).
// Scoped to whatever directory package.json actually lives in via
// --prefix, so a script run with a non-default --path (e.g. in tests,
// against a scratch file) never touches this repo's real lockfile.
export function syncLockfile(packageJsonPath) {
  const dir = path.dirname(packageJsonPath);
  execFileSync('npm', ['install', '--package-lock-only', '--prefix', dir], { stdio: 'inherit' });
}
