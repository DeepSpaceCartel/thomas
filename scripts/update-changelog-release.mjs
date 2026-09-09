#!/usr/bin/env node
// Phase A: moves CHANGELOG.md's [Unreleased] body into a new, dated
// version section, inserts a fresh empty [Unreleased] above it, and
// rewrites the two link-reference lines that change. Fails loudly
// (before any branch/PR is created) if [Unreleased] is empty — the
// guard against an accidental content-free release.
//
//   node scripts/update-changelog-release.mjs <version> <date> <repoUrl> [--path CHANGELOG.md]

import { readFileSync, writeFileSync } from 'node:fs';
import { findSection } from './lib/changelog.mjs';

const UNRELEASED_LINK_RE = /^\[Unreleased\]:\s*(\S+)\/compare\/v([\d.]+)\.\.\.HEAD\s*$/m;

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const [version, date, repoUrl] = positional;
  const pathIdx = argv.indexOf('--path');
  const path = pathIdx !== -1 ? argv[pathIdx + 1] : 'CHANGELOG.md';
  if (!version || !date || !repoUrl) {
    throw new Error('Usage: update-changelog-release.mjs <version> <date> <repoUrl> [--path CHANGELOG.md]');
  }
  return { version, date, repoUrl, path };
}

function main() {
  const { version, date, repoUrl, path } = parseArgs(process.argv.slice(2));
  const text = readFileSync(path, 'utf8');

  const unreleased = findSection(text, 'Unreleased');
  if (!unreleased) {
    throw new Error(`No "## [Unreleased]" section found in ${path}`);
  }
  if (unreleased.body === '') {
    throw new Error('[Unreleased] is empty — nothing to release. Add real changelog entries before running a release.');
  }

  const { lines, startIdx, endIdx, body } = unreleased;
  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx);
  const replacement = ['## [Unreleased]', '', `## [${version}] - ${date}`, '', body, ''];
  const rebuilt = [...before, ...replacement, ...after].join('\n');

  const linkMatch = UNRELEASED_LINK_RE.exec(rebuilt);
  if (!linkMatch) {
    throw new Error(`Could not find a "[Unreleased]: .../compare/vX.Y.Z...HEAD" link line in ${path}`);
  }
  const prevVersion = linkMatch[2];
  const newLinkLine = `[Unreleased]: ${repoUrl}/compare/v${version}...HEAD`;
  const insertedLine = `[${version}]: ${repoUrl}/compare/v${prevVersion}...v${version}`;
  const final = rebuilt.replace(UNRELEASED_LINK_RE, `${newLinkLine}\n${insertedLine}`);

  writeFileSync(path, final);
  console.log(`Moved [Unreleased] into [${version}] - ${date}; previous version was ${prevVersion}.`);
}

main();
