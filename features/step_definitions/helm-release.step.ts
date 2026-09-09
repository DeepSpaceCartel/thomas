import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../support/world.js';
import { HelmRelease, helmReleaseFromTable } from '../support/helm/helm_release.js';
import { chartRefToArgs } from '../support/helm/chart_ref_args.js';
import { buildArgs, runCommand } from '../support/run_command.js';
import { attempt } from '../support/attempt.js';

function resolveChart(world: World, alias: string) {
  return world.charts.get(alias);
}

Given('HelmRelease known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.helmReleases.set(alias, helmReleaseFromTable(dataTable, (a) => resolveChart(this, a)));
});

When('I attempt to define HelmRelease known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.helmReleases.set(alias, helmReleaseFromTable(dataTable, (a) => resolveChart(this, a)));
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
// see the comment on the equivalent `show` step in helm.step.ts for why:
// VS Code's Cucumber plugin can't resolve a step text that's only built at
// runtime inside a loop.
function runHelmReleaseVerb(this: World, verb: string, alias: string, extraArgs: string[]): void {
  if (!(HELM_RELEASE_VERBS as readonly string[]).includes(verb)) {
    throw new Error(`Unknown HelmRelease verb "${verb}" (known verbs: ${HELM_RELEASE_VERBS.join(', ')})`);
  }
  const release = getHelmRelease(this, alias);
  const chartArgs = HELM_RELEASE_VERBS_WITH_CHART.has(verb) ? chartRefToArgs(release.chart.chart) : [];
  this.lastCommandResult = runCommand('helm', [verb, release.name, ...chartArgs, '-n', release.namespace, ...extraArgs]);
}
When('I {word} HelmRelease known as {string}', function (this: World, verb: string, alias: string) {
  runHelmReleaseVerb.call(this, verb, alias, []);
});
When('I {word} HelmRelease known as {string} with:', function (this: World, verb: string, alias: string, table: DataTable) {
  runHelmReleaseVerb.call(this, verb, alias, buildArgs(table));
});

const GET_SUBCOMMANDS = ['all', 'hooks', 'manifest', 'metadata', 'notes', 'values'] as const;
function runHelmReleaseGet(this: World, sub: string, alias: string, extraArgs: string[]): void {
  if (!(GET_SUBCOMMANDS as readonly string[]).includes(sub)) {
    throw new Error(`Unknown "get" subcommand "${sub}" (known subcommands: ${GET_SUBCOMMANDS.join(', ')})`);
  }
  const release = getHelmRelease(this, alias);
  this.lastCommandResult = runCommand('helm', ['get', sub, release.name, '-n', release.namespace, ...extraArgs]);
}
When('I get {word} for HelmRelease known as {string}', function (this: World, sub: string, alias: string) {
  runHelmReleaseGet.call(this, sub, alias, []);
});
When('I get {word} for HelmRelease known as {string} with:', function (this: World, sub: string, alias: string, table: DataTable) {
  runHelmReleaseGet.call(this, sub, alias, buildArgs(table));
});

When('I list HelmRelease', function (this: World) {
  this.lastCommandResult = runCommand('helm', ['list']);
});
When('I list HelmRelease with:', function (this: World, table: DataTable) {
  this.lastCommandResult = runCommand('helm', ['list', ...buildArgs(table)]);
});
