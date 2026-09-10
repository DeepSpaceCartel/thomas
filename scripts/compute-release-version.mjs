#!/usr/bin/env node
// Phase A: computes the version this release will ship as — a MINOR
// bump with PATCH reset relative to package.json's current version
// (the accumulated patch count is a "PRs since last release" counter,
// it never ships literally). With --write, also rewrites package.json
// to that version — since the released version and "the next
// in-progress version" are the same number by construction (see
// docs/project/releasing.md), this one write covers both.
//
//   node scripts/compute-release-version.mjs [--write] [--path package.json]

import { bumpMinorResetPatch } from './lib/semver.mjs';
import { readVersion, writeVersion } from './lib/package-json.mjs';
import { setOutput } from './lib/github-output.mjs';
import { syncLockfile } from './lib/npm.mjs';

function parseArgs(argv) {
  const args = { write: false, path: 'package.json' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--write') {
      args.write = true;
    } else if (argv[i] === '--path') {
      args.path = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const current = readVersion(args.path);
  const release = bumpMinorResetPatch(current);

  if (args.write) {
    writeVersion(args.path, release);
    syncLockfile(args.path);
  }

  setOutput('version', release);
}

main();
