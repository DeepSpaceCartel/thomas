import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { DockerBuildxBuilder, dockerBuildxBuilderFromFields, dockerBuildxBuilderFromTable } from '../../support/docker/docker_buildx_builder.js';
import { buildArgs, runCommand } from '../../support/run_command.js';
import { resolveResource } from '../../support/resources/resolve_resource.js';
import { isResourceReference } from '../../support/resources/resource_reference.js';
import { softSubstituteCapturedValue, substituteTableCapturedValues } from '../../support/http/capture.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('Docker Buildx Builder known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  // Pure definition only - no `docker buildx create` here. Mirrors
  // HelmRepo's Given exactly: define first, act later via an explicit
  // When step. Soft substitution first - `endpoint` legitimately needs
  // to embed a captured value (e.g. a dynamic namespace baked into an
  // in-cluster BuildKit hostname), the same real need `namespace` has
  // on HelmRelease/any k8s kind.
  this.dockerBuildxBuilders.set(alias, dockerBuildxBuilderFromTable(substituteTableCapturedValues(this, dataTable), (a) => resolveResource(this, a)));
});

// Oneline form - `name`/`endpoint` are always both used together; the
// table form stays for the negative-path tests in
// features/docker/docker-buildx-builder-validation-{short,full}.feature.
Given('Docker Buildx Builder {string} named {string} at {string}', function (this: World, alias: string, name: string, endpoint: string) {
  this.dockerBuildxBuilders.set(alias, dockerBuildxBuilderFromFields({ name, endpoint: softSubstituteCapturedValue(this, endpoint) }, (a) => resolveResource(this, a)));
});

When('I attempt to define Docker Buildx Builder known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.dockerBuildxBuilders.set(alias, dockerBuildxBuilderFromTable(dataTable, (a) => resolveResource(this, a)));
  });
});

When('I attempt to define Docker Buildx Builder known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.dockerBuildxBuilders.set(alias, dockerBuildxBuilderFromFields(getPendingPayload(this, payloadAlias), (a) => resolveResource(this, a)));
  });
});

function getBuilder(world: World, alias: string): DockerBuildxBuilder {
  const builder = world.dockerBuildxBuilders.get(alias);
  if (!builder) {
    throw new Error(`No DockerBuildxBuilder registered as "${alias}"`);
  }
  return builder;
}

When('I create Docker Buildx Builder known as {string}', function (this: World, alias: string) {
  const builder = getBuilder(this, alias);
  this.lastCommandResult = runCommand('docker', ['buildx', 'create', '--name', builder.name, '--driver', 'remote', builder.endpoint]);
});
When('I create Docker Buildx Builder known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const builder = getBuilder(this, alias);
  this.lastCommandResult = runCommand('docker', ['buildx', 'create', '--name', builder.name, '--driver', 'remote', builder.endpoint, ...buildArgs(substituteTableCapturedValues(this, table))]);
});
When('I create Docker Buildx Builder {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const builder = getBuilder(this, alias);
  this.lastCommandResult = runCommand('docker', ['buildx', 'create', '--name', builder.name, '--driver', 'remote', builder.endpoint, ...flags]);
});

// The cleanup half, mirroring Helm's install/uninstall pair - every
// scenario that creates a builder removes it, reachable from the
// `.feature` file itself (Thomas's usual per-scenario cleanup discipline).
When('I remove Docker Buildx Builder known as {string}', function (this: World, alias: string) {
  const builder = getBuilder(this, alias);
  this.lastCommandResult = runCommand('docker', ['buildx', 'rm', builder.name]);
});
When('I remove Docker Buildx Builder known as {string} with:', function (this: World, alias: string, table: DataTable) {
  const builder = getBuilder(this, alias);
  this.lastCommandResult = runCommand('docker', ['buildx', 'rm', builder.name, ...buildArgs(table)]);
});
When('I remove Docker Buildx Builder {string} with {flags}', function (this: World, alias: string, flags: string[]) {
  const builder = getBuilder(this, alias);
  this.lastCommandResult = runCommand('docker', ['buildx', 'rm', builder.name, ...flags]);
});

// A build context written as "<Alias>" resolves through the same generic
// Resource map (Directory/File/URL/OCI Artifact) every other domain's
// alias fields already use - not a new mechanism, and not narrowed to
// Directory specifically, since a real build context is just a path.
function resolveBuildContext(world: World, raw: string): string {
  if (isResourceReference(raw)) {
    const value = resolveResource(world, raw);
    if (value === undefined) {
      throw new Error(`No Resource registered as "${raw}"`);
    }
    return value;
  }
  return raw;
}

// `--registry-credentials <FileAlias>` is a documented, named exception
// (same category as HelmRelease.chart/RestEndpoint.service already
// documented in AGENTS.md): it is never passed through to `docker` argv
// literally. It's intercepted here, resolved to a real docker-config-JSON
// File, and turned into a scoped DOCKER_CONFIG directory instead - a real
// env-var difference no CLI flag can express (see run_command.ts's `env`
// option). The ambient buildx/ state is copied first so the already-created
// builder stays visible under the scoped config too.
const REGISTRY_CREDENTIALS_OPTION = '--registry-credentials';

function extractRegistryCredentials(world: World, table: DataTable): { rows: DataTable; env?: NodeJS.ProcessEnv } {
  const hashes = table.hashes();
  const credentialRow = hashes.find((r) => r.OPTION === REGISTRY_CREDENTIALS_OPTION);
  if (!credentialRow) {
    return { rows: table };
  }
  const file = world.files.get(credentialRow.VALUE);
  if (!file) {
    throw new Error(`No File registered as "${credentialRow.VALUE}"`);
  }
  const baseDockerConfig = process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker');
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thomas-docker-config-'));
  const buildxSrc = path.join(baseDockerConfig, 'buildx');
  if (fs.existsSync(buildxSrc)) {
    fs.cpSync(buildxSrc, path.join(scratchDir, 'buildx'), { recursive: true });
  }
  fs.copyFileSync(file.path, path.join(scratchDir, 'config.json'));

  const remaining = hashes.filter((r) => r.OPTION !== REGISTRY_CREDENTIALS_OPTION);
  return { rows: new DataTable([['OPTION', 'VALUE'], ...remaining.map((r) => [r.OPTION, r.VALUE])]), env: { ...process.env, DOCKER_CONFIG: scratchDir } };
}

When(
  'I build and push {string} from {string} using Docker Buildx Builder known as {string} with:',
  function (this: World, imageRef: string, contextRaw: string, builderAlias: string, table: DataTable) {
    const builder = getBuilder(this, builderAlias);
    const context = resolveBuildContext(this, softSubstituteCapturedValue(this, contextRaw));
    const { rows, env } = extractRegistryCredentials(this, substituteTableCapturedValues(this, table));
    this.lastCommandResult = runCommand(
      'docker',
      ['buildx', 'build', '--builder', builder.name, '-t', softSubstituteCapturedValue(this, imageRef), '--push', ...buildArgs(rows), context],
      { env },
    );
  },
);
When('I build and push {string} from {string} using Docker Buildx Builder known as {string} with {flags}', function (this: World, imageRef: string, contextRaw: string, builderAlias: string, flags: string[]) {
  const builder = getBuilder(this, builderAlias);
  const context = resolveBuildContext(this, softSubstituteCapturedValue(this, contextRaw));
  this.lastCommandResult = runCommand('docker', ['buildx', 'build', '--builder', builder.name, '-t', softSubstituteCapturedValue(this, imageRef), '--push', ...flags, context]);
});
