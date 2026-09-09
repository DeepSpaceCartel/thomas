import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { ChartFile, chartFileFromTable } from '../../support/resources/file.js';
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
