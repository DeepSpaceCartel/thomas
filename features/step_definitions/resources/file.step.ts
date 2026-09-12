import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { ChartFile, chartFileFromTable, createFile } from '../../support/resources/file.js';
import { softSubstituteCapturedValue, substituteCapturedValues } from '../../support/http/capture.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('File known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.files.set(alias, chartFileFromTable(dataTable));
});

// Oneline form - File has exactly one real field (`path`); the table form
// stays for the negative-path tests in features/resources/file-{short,full}.feature.
Given('File {string} at {string}', function (this: World, alias: string, path: string) {
  this.files.set(alias, new ChartFile({ path }));
});

When('I attempt to define File known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.files.set(alias, chartFileFromTable(dataTable));
  });
});

When('I attempt to define File known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.files.set(alias, new ChartFile(getPendingPayload(this, payloadAlias)));
  });
});

// Real mutation (mkdir -p + write), so `When` - the counterpart to
// Directory's "I create Directory known as ... at ...". Content is a
// docstring so multi-line real content (a settings file, a trust-store
// config) doesn't need escaping into a table cell. Runs through the
// strict substituteCapturedValues (not the soft table variant - written
// file content has no resolveResource-alias cells to leave alone) so a
// generated config can embed a captured value, e.g. a dynamic namespace
// in a buildkitd.toml trust rule.
When('I create File known as {string} at {string} with:', function (this: World, alias: string, path: string, content: string) {
  this.files.set(alias, createFile(softSubstituteCapturedValue(this, path), substituteCapturedValues(this, content)));
});
