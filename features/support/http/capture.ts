import fs from 'node:fs';
import yaml from 'js-yaml';
import { DataTable } from '@cucumber/cucumber';
import { World } from '../world.js';
import { query } from '../query.js';
import { assertCondition } from '../assert_condition.js';

export function captureValueFromResponse(world: World, jmespath: string, alias: string): void {
  if (!world.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  const parsed = JSON.parse(world.lastHttpResponse.body);
  const value = query(parsed, jmespath);
  if (value === undefined) {
    throw new Error(`No value found at "${jmespath}" in the last response body`);
  }
  world.capturedValues.set(alias, String(value));
}

// Same real job as captureValueFromResponse above, sourced from
// lastCommandResult instead of an HTTP response - a real k8s object
// field (e.g. a Service's real ClusterIP, needed wherever a hostname
// genuinely can't be used - kubelet's own image pulls can't resolve
// *.svc.cluster.local at all, confirmed live: that name only resolves
// from inside a pod's own network namespace, via CoreDNS, never from
// the node itself). Parses YAML like `the command result data has:`
// does, not JSON.parse like the HTTP sibling - `kubectl get -o json`
// output parses fine as YAML too, and this stays consistent with every
// other lastCommandResult reader in this suite.
export function captureValueFromCommandResult(world: World, jmespath: string, alias: string): void {
  if (!world.lastCommandResult) {
    throw new Error('No command has been run yet');
  }
  const parsed = yaml.load(world.lastCommandResult.STDOUT);
  const value = query(parsed, jmespath);
  if (value === undefined) {
    throw new Error(`No value found at "${jmespath}" in the last command result`);
  }
  world.capturedValues.set(alias, String(value));
}

export function captureHeaderFromResponse(world: World, headerName: string, alias: string): void {
  if (!world.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  const value = world.lastHttpResponse.headers[headerName.toLowerCase()];
  if (value === undefined) {
    throw new Error(`No response header named "${headerName}" was found`);
  }
  world.capturedValues.set(alias, value);
}

export function captureQueryParameterFromResponseHeader(world: World, headerName: string, parameter: string, alias: string): void {
  if (!world.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  const headerValue = world.lastHttpResponse.headers[headerName.toLowerCase()];
  if (headerValue === undefined) {
    throw new Error(`No response header named "${headerName}" was found`);
  }
  const value = new URL(headerValue).searchParams.get(parameter);
  if (value === null) {
    throw new Error(`No query parameter named "${parameter}" was found in response header "${headerName}"`);
  }
  world.capturedValues.set(alias, value);
}

// Scoped deliberately to capturedValues only - not merged with
// resolve_resource.ts's Directory/File/URL/OCIArtifact resolution. Mixing
// two different "what does <X> mean" systems under one syntax would be
// genuinely ambiguous (what if the same name existed in both?); a
// captured value and a Directory/File alias are different enough
// concepts that keeping them in separate, non-overlapping systems is
// clearer than unifying them.
export function substituteCapturedValues(world: World, text: string): string {
  return text.replace(/<[^<>]+>/g, (match) => {
    const value = world.capturedValues.get(match);
    if (value === undefined) {
      throw new Error(`No captured value known as "${match}"`);
    }
    return value;
  });
}

// A "soft" sibling of substituteCapturedValues above: a `<...>` token
// with no matching captured value is left exactly as it was, rather
// than throwing - most `<...>` values elsewhere (a construction table
// cell, a progressive-selector `namespace is "<...>"` value) mean a
// Directory/Service/HelmChart alias for resolveResource/discover.ts to
// resolve, not a captured value, and this runs *before* that resolution
// without knowing which kind a given value is. Only replaces the parts
// that really are a captured value (e.g. a dynamically-computed
// namespace name); everything else reaches its normal resolution path
// unchanged.
export function softSubstituteCapturedValue(world: World, text: string): string {
  return text.replace(/<[^<>]+>/g, (match) => world.capturedValues.get(match) ?? match);
}

// Table form of the above - every cell of a construction table
// (PROPERTY|VALUE / label selector), header row excluded.
export function substituteTableCapturedValues(world: World, table: DataTable): DataTable {
  const [header, ...rows] = table.raw();
  const substituted = rows.map((row) => row.map((cell) => softSubstituteCapturedValue(world, cell)));
  return new DataTable([header, ...substituted]);
}

// A real, two-level `${VAR1:-${VAR2:-DEFAULT}}` fallback - process.env
// only, never a shell. Not domain-specific (any project's own namespace/
// naming convention might need one real env var with one real fallback);
// captures the *result* as a named value like any other capture in this
// file, so it composes with substituteCapturedValues/softSubstituteCapturedValue
// and substituteTableCapturedValues above.
export function captureEnvironmentVariable(world: World, variable: string, fallbackVariable: string, defaultValue: string, alias: string): void {
  world.capturedValues.set(alias, process.env[variable] || process.env[fallbackVariable] || defaultValue);
}

// A simpler sibling of the above for the single-real-env-var case (e.g.
// cucumber-js's own CUCUMBER_WORKER_ID, set only under --parallel) - the
// two-level fallback above forces a caller with only one real candidate
// var to awkwardly repeat its name as its own fallback. Same real
// process.env-only semantics, one fewer level.
export function captureEnvironmentVariableWithDefault(world: World, variable: string, defaultValue: string, alias: string): void {
  world.capturedValues.set(alias, process.env[variable] || defaultValue);
}

// The third real source alongside captureValueFromCommandResult (a
// command's STDOUT) and captureEnvironmentVariable (process.env) - a
// real file on disk (e.g. an ssh-keygen-produced .pub file). Trimmed,
// like every other real "one line of text" capture in this suite
// (mirrors devcontainer-builder's own runCapture's stdout.trim()
// convention) - motivating case: embedding a real public key as a
// single-line Helm --set-string value. A raw --set-file of the same
// path instead reads the file's trailing newline into the value
// verbatim; harmless where Helm's own chart JSON/base64-encodes the
// result into a Secret (see gitCredentials.entries[].privateKey), but a
// real problem where a chart interpolates the value directly into a pod
// template's own YAML block scalar (confirmed live: `helm template`
// throws a real YAML parse error, the raw newline breaks the block
// scalar's indentation) - this avoids that entirely by never letting the
// trailing newline reach Helm at all.
export function captureFileContent(world: World, path: string, alias: string): void {
  world.capturedValues.set(alias, fs.readFileSync(path, 'utf8').trim());
}

// The raw, un-parsed sibling of captureValueFromCommandResult above -
// that one only fits structured output (`yaml.load`+JMESPath against a
// real `kubectl get -o json`); a command whose real output is already
// exactly the one plain line a scenario needs (e.g. `ssh-keyscan`'s real
// current host-key line - genuinely unpredictable ahead of time, a
// fresh `ssh-keygen -A` generates it at container startup) has nothing
// to query, just to capture and trim.
export function captureCommandStdout(world: World, alias: string): void {
  if (!world.lastCommandResult) {
    throw new Error('No command has been run yet');
  }
  world.capturedValues.set(alias, world.lastCommandResult.STDOUT.trim());
}

// The one place a captured value is *compared* rather than substituted
// into something else being built - deliberately its own narrow step
// (not folded into the response/command SOURCE|CONDITION|VALUE assertion
// tables, which compare against a literal on purpose: see
// assertResponseBodySource's doc comment in http.step.ts). A scenario
// whose expected value is itself dynamic (composed from a captured
// registry URL plus a real, content-derived sha - see "the value at ...
// from the command result/response is known as ..." above) needs
// somewhere to compare two such values without smuggling substitution
// into the general assertion tables every other domain already relies on
// staying literal. `expectedTemplate` goes through the same
// substituteCapturedValues every construction step already uses, so
// composing the expected side first (`Given the value "<X>/<Y>:sha-<Z>"
// is known as "<Expected>"`) and comparing here is the one, consistent
// pattern - not a second substitution rule to learn.
export function assertCapturedValue(world: World, alias: string, condition: string, expectedTemplate: string): void {
  const actual = world.capturedValues.get(alias);
  if (actual === undefined) {
    throw new Error(`No captured value known as "${alias}"`);
  }
  const expected = substituteCapturedValues(world, expectedTemplate);
  assertCondition(alias, actual, condition, expected, { [alias]: actual });
}
