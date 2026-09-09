import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { ChartUrl, chartUrlFromTable } from '../../support/resources/url.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('URL known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.urls.set(alias, chartUrlFromTable(dataTable));
});

// Oneline form - URL has exactly one real field (`value`); the table form
// stays for the negative-path tests in features/resources/url-{short,full}.feature.
Given('URL {string} at {string}', function (this: World, alias: string, value: string) {
  this.urls.set(alias, new ChartUrl({ value }));
});

When('I attempt to define URL known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.urls.set(alias, chartUrlFromTable(dataTable));
  });
});

When('I attempt to define URL known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.urls.set(alias, new ChartUrl(getPendingPayload(this, payloadAlias)));
  });
});
