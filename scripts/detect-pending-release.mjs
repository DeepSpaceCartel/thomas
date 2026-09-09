#!/usr/bin/env node
// Phase B: run on every push to main. Cross-checks CHANGELOG.md's
// topmost dated (non-Unreleased) section against package.json's
// version — they must match, since Phase A's script is the only thing
// that ever writes either of them together. Prints that version so the
// workflow can check whether it's already been tagged (a regular PR/
// bot-commit merge) or still needs tagging + a GitHub Release (the
// release-prep PR's merge).
//
//   node scripts/detect-pending-release.mjs [--changelog CHANGELOG.md] [--package package.json]

import { readFileSync } from 'node:fs';
import { listHeadings } from './lib/changelog.mjs';
import { readVersion } from './lib/package-json.mjs';
import { setOutput } from './lib/github-output.mjs';

function parseArgs(argv) {
  const args = { changelogPath: 'CHANGELOG.md', packagePath: 'package.json' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--changelog') {
      args.changelogPath = argv[++i];
    } else if (argv[i] === '--package') {
      args.packagePath = argv[++i];
    }
  }
  return args;
}

function main() {
  const { changelogPath, packagePath } = parseArgs(process.argv.slice(2));
  const text = readFileSync(changelogPath, 'utf8');
  const headings = listHeadings(text);
  const topmostDated = headings.find((h) => h.name !== 'Unreleased');

  if (!topmostDated) {
    throw new Error(`No dated "## [X.Y.Z] - date" section found in ${changelogPath}`);
  }

  const pkgVersion = readVersion(packagePath);
  if (topmostDated.name !== pkgVersion) {
    throw new Error(
      `${changelogPath}'s topmost dated section is [${topmostDated.name}], but ${packagePath}'s ` +
        `version is "${pkgVersion}" — these should always match (only the release-prep script ` +
        'writes both together). Not guessing which one is right.',
    );
  }

  setOutput('version', topmostDated.name);
}

main();
