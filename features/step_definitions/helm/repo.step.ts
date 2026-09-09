import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { helmRepoFromFields, helmRepoFromTable, HelmRepo } from '../../support/helm/helm_repo.js';
import { buildArgs, runCommand } from '../../support/run_command.js';
import { resolveResource } from '../../support/resources/resolve_resource.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('Helm Repo known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  // Pure definition only - no `helm repo add` here. Mirrors HelmChart's
  // Given exactly: define first, act later via an explicit When step.
  this.repos.set(alias, helmRepoFromTable(dataTable, (a) => resolveResource(this, a)));
});

// Oneline form - `name`/`url` are always both used together (see
// helm-repo.feature); the table form stays for the negative-path tests in
// features/helm/helm-repo-validation-{short,full}.feature.
Given('Helm Repo {string} named {string} at {string}', function (this: World, alias: string, name: string, url: string) {
  this.repos.set(alias, helmRepoFromFields({ name, url }, (a) => resolveResource(this, a)));
});

When('I attempt to define Helm Repo known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.repos.set(alias, helmRepoFromTable(dataTable, (a) => resolveResource(this, a)));
  });
});

When('I attempt to define Helm Repo known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.repos.set(alias, helmRepoFromFields(getPendingPayload(this, payloadAlias), (a) => resolveResource(this, a)));
  });
});

function getRepo(world: World, alias: string): HelmRepo {
  const repo = world.repos.get(alias);
  if (!repo) {
    throw new Error(`No HelmRepo registered as "${alias}"`);
  }
  return repo;
}

When('I add Helm Repo known as {string}', function (this: World, alias: string) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'add', repo.name, repo.url]);
});
When('I add Helm Repo known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'add', repo.name, repo.url, ...buildArgs(table)]);
});
When('I add Helm Repo {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'add', repo.name, repo.url, ...flags]);
});

When('I remove Helm Repo known as {string}', function (this: World, alias: string) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'remove', repo.name]);
});
When('I remove Helm Repo known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'remove', repo.name, ...buildArgs(table)]);
});
When('I remove Helm Repo {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'remove', repo.name, ...flags]);
});

When('I update Helm Repo known as {string}', function (this: World, alias: string) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'update', repo.name]);
});
When('I update Helm Repo known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'update', repo.name, ...buildArgs(table)]);
});
When('I update Helm Repo {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const repo = getRepo(this, alias);
  this.lastCommandResult = runCommand('helm', ['repo', 'update', repo.name, ...flags]);
});

When('I list Helm Repo', function (this: World) {
  this.lastCommandResult = runCommand('helm', ['repo', 'list']);
});
When('I list Helm Repo with:', function (this: World, table: DataTable) {
  this.lastCommandResult = runCommand('helm', ['repo', 'list', ...buildArgs(table)]);
});
When('I list Helm Repo with {flags}', function (this: World, flags: string[]) {
  this.lastCommandResult = runCommand('helm', ['repo', 'list', ...flags]);
});
