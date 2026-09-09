import yaml from 'js-yaml';
import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { HelmChart, helmChartFromFields, helmChartFromTable } from '../../support/helm/helm_chart.js';
import { readChartYaml } from '../../support/helm/chart_source.js';
import { chartRefToArgs } from '../../support/helm/chart_ref_args.js';
import { assertCondition, requiresValue } from '../../support/assert_condition.js';
import { query } from '../../support/query.js';
import { buildArgs, runCommand } from '../../support/run_command.js';
import { resolveResource } from '../../support/resources/resolve_resource.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('Helm Chart known as {string}:', function (this: World, name: string, dataTable: DataTable) {
  this.charts.set(name, helmChartFromTable(dataTable, (alias) => resolveResource(this, alias)));
});

// Oneline forms - one registration per real field combination actually
// used (chart alone; chart+version; chart+repo+version - see
// helm-chart.feature). The table form stays for "Rejecting an unknown
// property"/every other combination not seen in real use.
Given('Helm Chart {string} in {string}', function (this: World, name: string, chart: string) {
  this.charts.set(name, helmChartFromFields({ chart }, (alias) => resolveResource(this, alias)));
});
Given('Helm Chart {string} in {string} version {string}', function (this: World, name: string, chart: string, version: string) {
  this.charts.set(name, helmChartFromFields({ chart, version }, (alias) => resolveResource(this, alias)));
});
Given('Helm Chart {string} in {string} repo {string} version {string}', function (this: World, name: string, chart: string, repo: string, version: string) {
  this.charts.set(name, helmChartFromFields({ chart, repo, version }, (alias) => resolveResource(this, alias)));
});

When('I attempt to define Helm Chart known as {string}:', function (this: World, name: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.charts.set(name, helmChartFromTable(dataTable, (alias) => resolveResource(this, alias)));
  });
});

When('I attempt to define Helm Chart known as {string} using {string}', function (this: World, name: string, payloadAlias: string) {
  return attempt(this, () => {
    this.charts.set(name, helmChartFromFields(getPendingPayload(this, payloadAlias), (alias) => resolveResource(this, alias)));
  });
});

// Shared by the table form and its oneline siblings below - one real
// chart lookup + Chart.yaml read + parse, not duplicated per form.
function assertChartCondition(world: World, name: string, key: string, condition: string, value: string): void {
  const chart = world.charts.get(name);
  if (!chart) {
    throw new Error(`No HelmChart registered as "${name}"`);
  }
  const parsed = yaml.load(readChartYaml(chart.chart)) as Record<string, unknown>;
  assertCondition(key, query(parsed, key), condition, value, parsed);
}

Given('Helm Chart known as {string} has:', function (this: World, name: string, dataTable: DataTable) {
  for (const { KEY, CONDITION, VALUE } of dataTable.hashes()) {
    assertChartCondition(this, name, KEY, CONDITION, VALUE);
  }
});

function assertChartConditionStep(this: World, name: string, key: string, condition: string, value: string) {
  assertChartCondition(this, name, key, condition, value);
}

Given('Helm Chart {string} has {string} {condition} {word}', assertChartConditionStep);
Given('Helm Chart {string} has {string} {condition} {string}', assertChartConditionStep);

Given('Helm Chart {string} has {string} {condition}', function (this: World, name: string, key: string, condition: string) {
  if (requiresValue(condition)) {
    throw new Error(`Condition "${condition}" requires a value - use "Given Helm Chart "${name}" has "${key}" ${condition} <value>" or a table`);
  }
  assertChartCondition(this, name, key, condition, '');
});

function getChart(world: World, alias: string): HelmChart {
  const chart = world.charts.get(alias);
  if (!chart) {
    throw new Error(`No HelmChart registered as "${alias}"`);
  }
  return chart;
}

// `helm template [NAME] [CHART]` - NAME (if the table supplies one via a
// blank-OPTION positional row) must come *before* the chart args, not
// after - real usage, confirmed by actually running it (a table-supplied
// "test-nginx" ended up parsed as CHART, chart's own path as a stray extra
// arg, until this was reordered).
When('I template Helm Chart known as {string}', function (this: World, alias: string) {
  const chart = getChart(this, alias);
  this.lastCommandResult = runCommand('helm', ['template', ...chartRefToArgs(chart.chart)]);
});
When('I template Helm Chart known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const chart = getChart(this, alias);
  this.lastCommandResult = runCommand('helm', ['template', ...buildArgs(table), ...chartRefToArgs(chart.chart)]);
});
When('I template Helm Chart {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const chart = getChart(this, alias);
  this.lastCommandResult = runCommand('helm', ['template', ...flags, ...chartRefToArgs(chart.chart)]);
});

const SHOW_SUBCOMMANDS = ['chart', 'values', 'readme', 'crds', 'all'] as const;

// A single step with a `{word}` parameter (rather than one registration per
// subcommand) so the step text stays a literal string - VS Code's Cucumber
// plugin resolves glue steps by statically scanning source text, so a
// dynamically-interpolated pattern (`` `I show ${sub} ...` `` inside a loop)
// is invisible to it even though cucumber-js itself matches it fine at
// runtime.
function runShowSubcommand(this: World, sub: string, alias: string, extraArgs: string[]): void {
  if (!(SHOW_SUBCOMMANDS as readonly string[]).includes(sub)) {
    throw new Error(`Unknown "show" subcommand "${sub}" (known subcommands: ${SHOW_SUBCOMMANDS.join(', ')})`);
  }
  const chart = getChart(this, alias);
  this.lastCommandResult = runCommand('helm', ['show', sub, ...extraArgs, ...chartRefToArgs(chart.chart)]);
}
When('I show {word} for Helm Chart known as {string}', function (this: World, sub: string, alias: string) {
  runShowSubcommand.call(this, sub, alias, []);
});
When('I show {word} for Helm Chart known as {string} with:', function (this: World, sub: string, alias: string, table: DataTable) {
  runShowSubcommand.call(this, sub, alias, buildArgs(table));
});
When('I show {word} for Helm Chart {string} with {flags}', function (this: World, sub: string, alias: string, flags: string[]) {
  runShowSubcommand.call(this, sub, alias, flags);
});
