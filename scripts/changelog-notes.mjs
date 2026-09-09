#!/usr/bin/env node
// Prints one version's CHANGELOG.md section body to stdout — used as
// the release-prep PR body and as `gh release create --notes-file`
// input.
//
//   node scripts/changelog-notes.mjs <version> [--path CHANGELOG.md]

import { readFileSync } from 'node:fs';
import { findSection } from './lib/changelog.mjs';

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const [version] = positional;
  const pathIdx = argv.indexOf('--path');
  const path = pathIdx !== -1 ? argv[pathIdx + 1] : 'CHANGELOG.md';
  if (!version) {
    throw new Error('Usage: changelog-notes.mjs <version> [--path CHANGELOG.md]');
  }
  return { version, path };
}

function main() {
  const { version, path } = parseArgs(process.argv.slice(2));
  const text = readFileSync(path, 'utf8');
  const section = findSection(text, version);
  if (!section) {
    throw new Error(`No "## [${version}]" section found in ${path}`);
  }
  if (section.body === '') {
    throw new Error(`"## [${version}]" section in ${path} is empty`);
  }
  process.stdout.write(`${section.body}\n`);
}

main();
