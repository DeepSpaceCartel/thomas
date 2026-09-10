import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { HelmRelease, helmReleaseFromFields, helmReleaseFromTable } from '../../support/helm/helm_release.js';
import { chartRefToArgs } from '../../support/helm/chart_ref_args.js';
import { buildArgs, outputFormatToArgs, runCommand } from '../../support/run_command.js';
import { attempt } from '../../support/attempt.js';
import { assertResultCondition, getPendingPayload } from '../common.step.js';

function resolveChart(world: World, alias: string) {
  return world.charts.get(alias);
}

Given('Helm Release known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.helmReleases.set(alias, helmReleaseFromTable(dataTable, (a) => resolveChart(this, a)));
});

// Oneline form - `chart`/`name`/`namespace` are always all three used
// together (see release.feature and every rest/*.feature); the table form
// stays for the negative-path tests in
// features/helm/helm-release-validation-{short,full}.feature.
Given('Helm Release {string} of {string} named {string} in {string}', function (this: World, alias: string, chart: string, name: string, namespace: string) {
  this.helmReleases.set(alias, helmReleaseFromFields({ chart, name, namespace }, (a) => resolveChart(this, a)));
});

When('I attempt to define Helm Release known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.helmReleases.set(alias, helmReleaseFromTable(dataTable, (a) => resolveChart(this, a)));
  });
});

When('I attempt to define Helm Release known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.helmReleases.set(alias, helmReleaseFromFields(getPendingPayload(this, payloadAlias), (a) => resolveChart(this, a)));
  });
});

function getHelmRelease(world: World, alias: string): HelmRelease {
  const release = world.helmReleases.get(alias);
  if (!release) {
    throw new Error(`No HelmRelease registered as "${alias}"`);
  }
  return release;
}

// Only install/upgrade take a chart ref - uninstall/rollback/status/
// history/test only ever take RELEASE_NAME + -n NAMESPACE (verified
// against real `helm <verb> --help` usage lines for each).
const HELM_RELEASE_VERBS = ['install', 'upgrade', 'uninstall', 'rollback', 'status', 'history', 'test'] as const;
const HELM_RELEASE_VERBS_WITH_CHART = new Set(['install', 'upgrade']);

// A single step with a `{word}` parameter, not one registration per verb -
// see the comment on the equivalent `show` step in chart.step.ts for why:
// VS Code's Cucumber plugin can't resolve a step text that's only built at
// runtime inside a loop.
function runHelmReleaseVerb(this: World, verb: string, alias: string, extraArgs: string[]): void {
  if (!(HELM_RELEASE_VERBS as readonly string[]).includes(verb)) {
    throw new Error(`Unknown Helm Release verb "${verb}" (known verbs: ${HELM_RELEASE_VERBS.join(', ')})`);
  }
  const release = getHelmRelease(this, alias);
  const chartArgs = HELM_RELEASE_VERBS_WITH_CHART.has(verb) ? chartRefToArgs(release.chart.chart) : [];
  this.lastCommandResult = runCommand('helm', [verb, release.name, ...chartArgs, '-n', release.namespace, ...extraArgs]);
}
When('I {word} Helm Release known as {string}', function (this: World, verb: string, alias: string) {
  runHelmReleaseVerb.call(this, verb, alias, []);
});
When('I {word} Helm Release known as {string} with:', function (this: World, verb: string, alias: string, table: DataTable) {
  runHelmReleaseVerb.call(this, verb, alias, buildArgs(table));
});
When('I {word} Helm Release {string} with {flags}', function (this: World, verb: string, alias: string, flags: string[]) {
  runHelmReleaseVerb.call(this, verb, alias, flags);
});
// "of", not "for" - deliberately different literal text from the
// get-subcommand sibling below ("I get {word} for Helm Release ...")
// so Cucumber never confuses the two, even though they read similar:
// this one dispatches a real verb (status/history/...), that one runs
// real `helm get <sub>`.
When('I get {word} of Helm Release {string} as {outputFormat}', function (this: World, verb: string, alias: string, format: string) {
  runHelmReleaseVerb.call(this, verb, alias, outputFormatToArgs(format));
});

const GET_SUBCOMMANDS = ['all', 'hooks', 'manifest', 'metadata', 'notes', 'values'] as const;
function runHelmReleaseGet(this: World, sub: string, alias: string, extraArgs: string[]): void {
  if (!(GET_SUBCOMMANDS as readonly string[]).includes(sub)) {
    throw new Error(`Unknown "get" subcommand "${sub}" (known subcommands: ${GET_SUBCOMMANDS.join(', ')})`);
  }
  const release = getHelmRelease(this, alias);
  this.lastCommandResult = runCommand('helm', ['get', sub, release.name, '-n', release.namespace, ...extraArgs]);
}
When('I get {word} for Helm Release known as {string}', function (this: World, sub: string, alias: string) {
  runHelmReleaseGet.call(this, sub, alias, []);
});
When('I get {word} for Helm Release known as {string} with:', function (this: World, sub: string, alias: string, table: DataTable) {
  runHelmReleaseGet.call(this, sub, alias, buildArgs(table));
});
When('I get {word} for Helm Release {string} with {flags}', function (this: World, sub: string, alias: string, flags: string[]) {
  runHelmReleaseGet.call(this, sub, alias, flags);
});
When('I get {word} for Helm Release {string} as {outputFormat}', function (this: World, sub: string, alias: string, format: string) {
  runHelmReleaseGet.call(this, sub, alias, outputFormatToArgs(format));
});

When('I list Helm Release', function (this: World) {
  this.lastCommandResult = runCommand('helm', ['list']);
});
When('I list Helm Release with:', function (this: World, table: DataTable) {
  this.lastCommandResult = runCommand('helm', ['list', ...buildArgs(table)]);
});
When('I list Helm Release with {flags}', function (this: World, flags: string[]) {
  this.lastCommandResult = runCommand('helm', ['list', ...flags]);
});

// Narrow, fixed-key shorthand for the one real idiom almost every
// scenario in this suite does right after install: check `info.status`
// against a prior `helm status --output yaml`. Still only ever reads
// `lastCommandResult` (via the shared assertResultCondition, same as
// `the command result has ...`) - the real sanity win is
// `getHelmRelease` below, which throws if the alias isn't a real
// registered Release before comparing anything, catching a copy-paste
// alias mismatch that a bare "the command result has ..." wouldn't.
Then('Helm Release {string} is {string}', function (this: World, alias: string, status: string) {
  getHelmRelease(this, alias);
  assertResultCondition(this, 'info.status', 'equals', status);
});
