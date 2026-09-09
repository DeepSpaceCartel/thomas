import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { Directory, directoryFromTable, purgeDirectory } from '../../support/resources/directory.js';
import { buildArgs, runCommand } from '../../support/run_command.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('Directory known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.directories.set(alias, directoryFromTable(dataTable));
});

// Oneline form - Directory has exactly one real field (`path`), so this
// covers every real construction; the table form above stays for the
// "Rejecting an unknown property"/"Rejecting a nonexistent path" negative
// tests, which need a table to express a wrong/extra field.
Given('Directory {string} at {string}', function (this: World, alias: string, path: string) {
  this.directories.set(alias, new Directory({ path }));
});

When('I attempt to define Directory known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.directories.set(alias, directoryFromTable(dataTable));
  });
});

// Payload-accumulator sibling of the table form above - built from
// several real `"<payload>" has property "<key>" "<value>"` lines
// instead of one table, same real `new Directory(fields)` construction
// either way.
When('I attempt to define Directory known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.directories.set(alias, new Directory(getPendingPayload(this, payloadAlias)));
  });
});

function getDirectory(world: World, alias: string): Directory {
  const dir = world.directories.get(alias);
  if (!dir) {
    throw new Error(`No Directory registered as "${alias}"`);
  }
  return dir;
}

When('I index Directory known as {string}', function (this: World, alias: string) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'index', dir.path]);
});
When('I index Directory known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'index', dir.path, ...buildArgs(table)]);
});
When('I index Directory {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'index', dir.path, ...flags]);
});

// `helm lint`/`helm package` only accept a local path - they operate on a
// Directory, never a HelmChart (which can also be a URL/OCI/reference).
When('I lint Directory known as {string}', function (this: World, alias: string) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['lint', dir.path]);
});
When('I lint Directory known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['lint', dir.path, ...buildArgs(table)]);
});
When('I lint Directory {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['lint', dir.path, ...flags]);
});

When('I package Directory known as {string}', function (this: World, alias: string) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['package', dir.path]);
});
When('I package Directory known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['package', dir.path, ...buildArgs(table)]);
});
When('I package Directory {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['package', dir.path, ...flags]);
});

// No "with:" table - purging is a pure filesystem operation, not a `helm`
// invocation, so there's no argv to build.
When('I purge Directory known as {string}', function (this: World, alias: string) {
  purgeDirectory(getDirectory(this, alias));
});

const DEPENDENCY_VERBS = ['build', 'list', 'update'] as const;

// A single step with a `{word}` parameter, not one registration per verb -
// see the comment on the equivalent `show` step in helm.step.ts for why:
// VS Code's Cucumber plugin can't resolve a step text that's only built at
// runtime inside a loop.
function runDependencyVerb(this: World, verb: string, alias: string, extraArgs: string[]): void {
  if (!(DEPENDENCY_VERBS as readonly string[]).includes(verb)) {
    throw new Error(`Unknown "dependency" verb "${verb}" (known verbs: ${DEPENDENCY_VERBS.join(', ')})`);
  }
  const dir = getDirectory(this, alias);
  this.lastCommandResult = runCommand('helm', ['dependency', verb, dir.path, ...extraArgs]);
}
When('I {word} dependencies for Directory known as {string}', function (this: World, verb: string, alias: string) {
  runDependencyVerb.call(this, verb, alias, []);
});
When('I {word} dependencies for Directory known as {string} with:', function (this: World, verb: string, alias: string, table: DataTable) {
  runDependencyVerb.call(this, verb, alias, buildArgs(table));
});
When('I {word} dependencies for Directory {string} with {flags}', function (this: World, verb: string, alias: string, flags: string[]) {
  runDependencyVerb.call(this, verb, alias, flags);
});
