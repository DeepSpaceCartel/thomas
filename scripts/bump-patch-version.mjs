#!/usr/bin/env node
// Every same-repo PR bot: bumps package.json's PATCH version by 1
// relative to main, if it isn't already bumped. Run on the PR branch.
//
//   node scripts/bump-patch-version.mjs --main-version <X.Y.Z> [--write] [--path package.json]
//
// Exits 0 with `bumped=false` if the branch is already correctly ahead
// of main by exactly one patch. Exits 1 on any state this script isn't
// confident how to resolve (hand-edited version, major/minor drift) —
// never guesses.

import { parse, format, compare, bumpPatch } from './lib/semver.mjs';
import { readVersion, writeVersion } from './lib/package-json.mjs';
import { setOutput } from './lib/github-output.mjs';

function parseArgs(argv) {
  const args = { write: false, path: 'package.json', mainVersion: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--main-version') {
      args.mainVersion = argv[++i];
    } else if (argv[i] === '--write') {
      args.write = true;
    } else if (argv[i] === '--path') {
      args.path = argv[++i];
    }
  }
  if (!args.mainVersion) {
    throw new Error('--main-version <X.Y.Z> is required');
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mainVersion = args.mainVersion;
  const branchVersion = readVersion(args.path);
  const expected = bumpPatch(mainVersion);

  if (compare(branchVersion, expected) === 0) {
    setOutput('bumped', 'false');
    setOutput('version', branchVersion);
    return;
  }

  if (compare(branchVersion, mainVersion) <= 0) {
    if (args.write) {
      writeVersion(args.path, expected);
    }
    setOutput('bumped', 'true');
    setOutput('version', expected);
    return;
  }

  throw new Error(
    `Unexpected version state: branch is at ${branchVersion}, main is at ${mainVersion} ` +
      `(expected the branch to be either equal to main+1 patch, i.e. ${expected}, or at/behind main). ` +
      'Not guessing — check for a hand-edited version.',
  );
}

main();
