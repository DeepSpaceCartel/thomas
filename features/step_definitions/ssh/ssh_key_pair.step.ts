import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { SshKeyPair, sshKeyPairFromFields, sshKeyPairFromTable } from '../../support/ssh/ssh_key_pair.js';
import { buildArgs, runCommand } from '../../support/run_command.js';
import { resolveResource } from '../../support/resources/resolve_resource.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';
import { softSubstituteCapturedValue, substituteTableCapturedValues } from '../../support/http/capture.js';

Given('SSH Key Pair known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.sshKeyPairs.set(alias, sshKeyPairFromTable(dataTable, (a) => resolveResource(this, a)));
});

// Oneline form - SshKeyPair has exactly one real field (`directory`).
Given('SSH Key Pair {string} in {string}', function (this: World, alias: string, directory: string) {
  this.sshKeyPairs.set(alias, sshKeyPairFromFields({ directory }, (a) => resolveResource(this, a)));
});

When('I attempt to define SSH Key Pair known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.sshKeyPairs.set(alias, sshKeyPairFromTable(dataTable, (a) => resolveResource(this, a)));
  });
});

When('I attempt to define SSH Key Pair known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.sshKeyPairs.set(alias, sshKeyPairFromFields(getPendingPayload(this, payloadAlias), (a) => resolveResource(this, a)));
  });
});

function getDirectoryPath(world: World, alias: string): string {
  const dir = world.directories.get(alias);
  if (!dir) {
    throw new Error(`No Directory registered as "${alias}"`);
  }
  return dir.path;
}

// Real, force-overwrite-then-generate keypair creation - two sequential
// real commands (never a shell `&&`), matching the
// disposable-k8s-test-fixtures skill's documented idiom for regenerating
// key material fresh every run rather than trusting stale files. `-f` is
// required in the argv (fully table/flags-driven, no implied filename) -
// it's what tells this step which real files to remove first, and
// (together with `directoryPath`) what SshKeyPair gets constructed from
// once generation succeeds - one real implementation, two entry points
// (table/flags), same shape as buildArgs/tokenizeFlags themselves.
function generateKeyPair(this: World, alias: string, directoryPath: string, args: string[]): void {
  const keyPathArg = args[args.indexOf('-f') + 1];
  if (args.indexOf('-f') === -1 || !keyPathArg) {
    throw new Error('SSH Key Pair generation requires a "-f" option naming the real key file to write');
  }
  runCommand('rm', ['-f', keyPathArg, `${keyPathArg}.pub`]);
  this.lastCommandResult = runCommand('ssh-keygen', args);
  if (this.lastCommandResult.EXIT_CODE === '0') {
    this.sshKeyPairs.set(alias, new SshKeyPair({ directory: directoryPath }));
  }
}

When('I generate SSH Key Pair known as {string} in Directory known as {string} with:', function (this: World, alias: string, dirAlias: string, table: DataTable) {
  generateKeyPair.call(this, alias, getDirectoryPath(this, dirAlias), buildArgs(substituteTableCapturedValues(this, table)));
});
When('I generate SSH Key Pair {string} in Directory known as {string} with {flags}', function (this: World, alias: string, dirAlias: string, flags: string[]) {
  generateKeyPair.call(this, alias, getDirectoryPath(this, dirAlias), flags);
});

// Stateless - no alias registered, a real `ssh-keyscan` result to assert
// on directly (e.g. the real non-comment host-key line via the existing
// raw-text condition vocabulary). `host` goes through the same soft
// substitution a `--set`/table VALUE cell gets elsewhere - a real scan
// target is very often a namespace-dependent Service DNS name (a
// captured `<Namespace>`/`<GitHost>`-style value), not a fixed literal.
When('I scan the SSH host key for {string} with:', function (this: World, host: string, table: DataTable) {
  this.lastCommandResult = runCommand('ssh-keyscan', [...buildArgs(substituteTableCapturedValues(this, table)), softSubstituteCapturedValue(this, host)]);
});
When('I scan the SSH host key for {string} with {flags}', function (this: World, host: string, flags: string[]) {
  this.lastCommandResult = runCommand('ssh-keyscan', [...flags, softSubstituteCapturedValue(this, host)]);
});
When('I scan the SSH host key for {string}', function (this: World, host: string) {
  this.lastCommandResult = runCommand('ssh-keyscan', [softSubstituteCapturedValue(this, host)]);
});
