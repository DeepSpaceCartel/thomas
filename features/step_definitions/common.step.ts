import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import { DataTable, Given, Then } from '@cucumber/cucumber';
import { World } from '../support/world.js';
import { assertCondition, requiresValue } from '../support/assert_condition.js';
import { query } from '../support/query.js';

// Generic across every object type in this suite - implementation only
// ever reads World.lastError / World.lastCommandResult, never anything
// type-specific, so one registration serves Directory, HelmChart,
// HelmRepo, HelmRelease, and any future type alike.

// Generic PROPERTY|VALUE accumulator - same real "table is sugar over a
// plain-fields core" shape as the HTTP request accumulator
// (`pendingRequests`/`RequestRow`), just for a construction payload
// (2 columns, not 3) instead of a request row. Real payoff: a negative-
// path "attempt to define ... with an unknown/missing field" test needs
// an open-ended field set a fixed-arity oneline structurally can't
// express - this can, since it's still just accumulating arbitrary real
// key/value pairs, the same real shape a PROPERTY|VALUE table already
// has, one row at a time instead of all at once. Each real "construct
// from payload" step (one per type, in that type's own step file) reads
// the accumulated fields via getPendingPayload and calls the exact same
// real xFromFields function the table form already uses - not a second
// construction implementation.
//
// "field ... is ..." (not "has {word} ...") deliberately - matches
// progressive discovery's `{string} label {string} is {string}` shape,
// and confirmed for real that it must NOT reuse "has" here: the HTTP
// accumulator's `{string} has {word} {string} {string}` has a bare
// {word} in the same position, and {word} (`[^\s]+`) matches the
// literal text of *any* single-token second step here just as well -
// including "property" itself - so the two registrations were
// genuinely ambiguous for every real payload line, caught by a real
// dry-run, not assumed safe from the text alone.
Given('{string} field {string} is {string}', function (this: World, alias: string, key: string, value: string) {
  const fields = this.pendingPayloads.get(alias) ?? {};
  fields[key] = value;
  this.pendingPayloads.set(alias, fields);
});

export function getPendingPayload(world: World, alias: string): Record<string, string> {
  const fields = world.pendingPayloads.get(alias);
  if (!fields) {
    throw new Error(`No payload registered as "${alias}"`);
  }
  return fields;
}

Then('it should have failed with {string}', function (this: World, expectedMessage: string) {
  assert.ok(this.lastError, 'expected the previous step to fail, but it succeeded');
  assert.ok(
    this.lastError!.message.includes(expectedMessage),
    `expected error message to include "${expectedMessage}", got "${this.lastError!.message}"`,
  );
});

// For a failure that can genuinely land on more than one real message -
// e.g. a poll can observe a Pod in more than one real transient bad state
// on the way to its terminal one (ErrImagePull, then ImagePullBackOff) -
// passes if the actual message includes ANY one of the listed candidates.
Then('it should have failed with either:', function (this: World, table: DataTable) {
  assert.ok(this.lastError, 'expected the previous step to fail, but it succeeded');
  const candidates = table.hashes().map((row) => row.MESSAGE);
  const matched = candidates.some((candidate) => this.lastError!.message.includes(candidate));
  assert.ok(matched, `expected error message to include one of [${candidates.join(', ')}], got "${this.lastError!.message}"`);
});

// Two separate functions, not one shared function with an optional
// trailing param: cucumber-js inspects a step function's declared arity to
// detect legacy callback-style steps, and a 2nd declared parameter with no
// attached DataTable in the Gherkin gets treated as "wants a callback" -
// it injects a function there instead of leaving it undefined. Distinct
// arities per registration avoids that entirely.
function assertExitCodeOnly(this: World, expectedExitCode: number) {
  if (!this.lastCommandResult) {
    throw new Error('No command has been run yet');
  }
  assertCondition('EXIT_CODE', this.lastCommandResult.EXIT_CODE, 'equals', String(expectedExitCode), { ...this.lastCommandResult });
}

function assertExitCodeAndOutput(this: World, expectedExitCode: number, table: DataTable) {
  assertExitCodeOnly.call(this, expectedExitCode);
  for (const { SOURCE, CONDITION, VALUE } of table.hashes()) {
    assertCondition(SOURCE, this.lastCommandResult![SOURCE as 'STDOUT' | 'STDERR'], CONDITION, VALUE, { ...this.lastCommandResult });
  }
}

Then('the command exited with {int}', assertExitCodeOnly);
Then('the command exited with {int}:', assertExitCodeAndOutput);

// Plain-English alias for the single most common case - exit code 0,
// nothing else to check. Not a general rename: `the command exited with
// {int}` stays the form for a real nonzero-exit assertion, which "the
// command succeeds" can't express.
Then('the command succeeds', function (this: World) {
  assertExitCodeOnly.call(this, 0);
});

// Oneline sibling of the SOURCE|CONDITION|VALUE table above - covers the
// single-condition case; a scenario checking more than one condition
// still uses the table form (see poll.ts's real multi-condition
// semantics for why that's a structural limit, not just unconverted).
// {word}/{string} siblings: {word} for a genuinely single-token value,
// {string} (quoted) for one containing a space - same real
// assertCondition call either way, just how the value is typed in the
// Gherkin text.
function assertExitCodeAndCondition(this: World, expectedExitCode: number, source: string, condition: string, value: string) {
  assertExitCodeOnly.call(this, expectedExitCode);
  assertCondition(source, this.lastCommandResult![source as 'STDOUT' | 'STDERR'], condition, value, { ...this.lastCommandResult });
}

Then('the command exited with {int} {word} {condition} {word}', assertExitCodeAndCondition);
Then('the command exited with {int} {word} {condition} {string}', assertExitCodeAndCondition);

Then('the command result data has:', function (this: World, table: DataTable) {
  if (!this.lastCommandResult) {
    throw new Error('No command has been run yet');
  }
  const parsed = yaml.load(this.lastCommandResult.STDOUT);
  for (const { KEY, CONDITION, VALUE } of table.hashes()) {
    assertCondition(KEY, query(parsed, KEY), CONDITION, VALUE, { result: parsed });
  }
});

// Oneline sibling of the KEY|CONDITION|VALUE table above - same scoping as
// the exit-code oneline: single condition, not a fit for `undefined`/
// `exists` (blank VALUE) or multi-condition assertions. Exported so
// object-flavored siblings (e.g. kubernetes.step.ts's
// `Then {word} {string} has {string} {condition} {word}`) can reuse the
// exact same real check against `lastCommandResult` after their own
// alias/kind sanity check, rather than duplicating it.
export function assertResultCondition(world: World, key: string, condition: string, value: string): void {
  if (!world.lastCommandResult) {
    throw new Error('No command has been run yet');
  }
  const parsed = yaml.load(world.lastCommandResult.STDOUT);
  assertCondition(key, query(parsed, key), condition, value, { result: parsed });
}

function assertResultConditionStep(this: World, key: string, condition: string, value: string) {
  assertResultCondition(this, key, condition, value);
}

Then('the command result has {string} {condition} {word}', assertResultConditionStep);
Then('the command result has {string} {condition} {string}', assertResultConditionStep);

// Value-less form - `exists`/`undefined` are the only two real conditions
// that ignore their value (check() never reads `expected` for either),
// so this is the same real assertResultCondition call with an empty
// value, not new logic. Guarded: a bare `equals`/`is`/etc. with no value
// at all is a real, easy mistake (silently comparing against `""`
// instead of failing loudly), so every other condition is rejected here
// with a clear message instead.
Then('the command result has {string} {condition}', function (this: World, key: string, condition: string) {
  if (requiresValue(condition)) {
    throw new Error(`Condition "${condition}" requires a value - use "the command result has "${key}" ${condition} <value>" or a table`);
  }
  assertResultCondition(this, key, condition, '');
});
