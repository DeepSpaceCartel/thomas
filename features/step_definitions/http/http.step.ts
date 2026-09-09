import fs from 'node:fs';
import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { RestEndpoint, restEndpointFromFields, restEndpointFromTable } from '../../support/http/rest_endpoint.js';
import { RequestRow, sendHttpRequest } from '../../support/http/http_request.js';
import { captureHeaderFromResponse, captureQueryParameterFromResponseHeader, captureValueFromResponse } from '../../support/http/capture.js';
import { attempt } from '../../support/attempt.js';
import { assertCondition } from '../../support/assert_condition.js';
import { fetchCertPem } from '../../support/k8s/secret.js';
import { getRegisteredObject } from '../k8s/kubernetes.step.js';
import { Service } from '../../support/k8s/service.js';
import { getPendingPayload } from '../common.step.js';

// Goes through the same lazy pending-selector resolution as every real
// k8s get/assert step (getRegisteredObject) - not a second lookup path.
// A Service registered via progressive discovery (Given Service "<X>" /
// And "<X>" namespace is ... / And "<X>" label ... is ...) has no real
// object in world.services yet until something resolves it; a raw map
// lookup here would silently miss it, which is exactly the real bug a
// live test run caught (deterministic "No Service registered as ..."
// for every HTTP/HTTPS Endpoint built on top of a progressively-
// discovered Service). Swallows the "not found" throw into `undefined`
// so restEndpointFromFields keeps owning its own real error message.
function resolveService(world: World, alias: string): Service | undefined {
  try {
    return getRegisteredObject(world, 'service', alias);
  } catch {
    return undefined;
  }
}

// https only - resolves a registered Secret alias to the real decoded
// cert bytes to trust (see rest_endpoint.ts's caCert).
function resolveTrustedCert(world: World, alias: string): Buffer | undefined {
  const secret = world.secrets.get(alias);
  return secret ? fetchCertPem(secret) : undefined;
}

// Construction steps are scheme-specific - scheme is a real, structural
// choice made once, at construction time (see rest_endpoint.ts).
Given('HTTP Endpoint known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.restEndpoints.set(alias, restEndpointFromTable(dataTable, 'http', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
});

Given('HTTPS Endpoint known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.restEndpoints.set(alias, restEndpointFromTable(dataTable, 'https', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
});

// Oneline forms - `service`/`port` are always both used together (see
// every rest/*.feature file). The table forms stay available for
// "I attempt to define ..." negative tests.
Given('HTTP Endpoint {string} on {string} port {string}', function (this: World, alias: string, service: string, port: string) {
  this.restEndpoints.set(alias, restEndpointFromFields({ service, port }, 'http', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
});

Given('HTTPS Endpoint {string} on {string} port {string} trusting {string}', function (this: World, alias: string, service: string, port: string, trust: string) {
  this.restEndpoints.set(alias, restEndpointFromFields({ service, port, trust }, 'https', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
});

When('I attempt to define HTTP Endpoint known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.restEndpoints.set(alias, restEndpointFromTable(dataTable, 'http', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
  });
});

When('I attempt to define HTTPS Endpoint known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.restEndpoints.set(alias, restEndpointFromTable(dataTable, 'https', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
  });
});

When('I attempt to define HTTP Endpoint known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.restEndpoints.set(alias, restEndpointFromFields(getPendingPayload(this, payloadAlias), 'http', (a) => resolveService(this, a), (a) => resolveTrustedCert(this, a)));
  });
});

function getRestEndpoint(world: World, alias: string): RestEndpoint {
  const endpoint = world.restEndpoints.get(alias);
  if (!endpoint) {
    throw new Error(`No RestEndpoint registered as "${alias}"`);
  }
  return endpoint;
}

// A value the server generated (e.g. a created note's real id) can only
// be known after a response comes back - no bare Given at scenario start
// can supply it. No table - a bare Given, same shape as the sibling
// service/features/ suite's already-proven "the command output is known
// as ..." idiom.
Given('the value at {string} from the last response is known as {string}', function (this: World, jmespath: string, alias: string) {
  captureValueFromResponse(this, jmespath, alias);
});

Given('the value of response header {string} from the last response is known as {string}', function (this: World, headerName: string, alias: string) {
  captureHeaderFromResponse(this, headerName, alias);
});

Given('the query parameter {string} from response header {string} is known as {string}', function (this: World, parameter: string, headerName: string, alias: string) {
  captureQueryParameterFromResponseHeader(this, headerName, parameter, alias);
});

// No-table variant for the common case of a request with no headers/
// query/body - "with:" + an empty TYPE|KEY|VALUE table is pure noise for
// a bare GET.
When('I send a {httpMethod} request to Endpoint known as {string} path {string}', function (this: World, method: string, alias: string, path: string) {
  return sendHttpRequest(this, getRestEndpoint(this, alias), method, path);
});

When(
  'I send a {httpMethod} request to Endpoint known as {string} path {string} with:',
  function (this: World, method: string, alias: string, path: string, table: DataTable) {
    return sendHttpRequest(this, getRestEndpoint(this, alias), method, path, table.hashes() as RequestRow[]);
  },
);

// Single-row shorthand for the three TYPEs that genuinely occur alone in
// real usage (every BASIC_AUTH row, several single-HEADER/single-QUERY
// requests) - the general TYPE|KEY|VALUE table stays the only form for
// everything else (most real bodies are 2+ fields, so a per-TYPE
// shorthand for FIELD/BODY/FORM wouldn't have a real caller today).
When(
  'I send a {httpMethod} request to Endpoint known as {string} path {string} with header {string} {string}',
  function (this: World, method: string, alias: string, path: string, key: string, value: string) {
    return sendHttpRequest(this, getRestEndpoint(this, alias), method, path, [{ TYPE: 'HEADER', KEY: key, VALUE: value }]);
  },
);

When(
  'I send a {httpMethod} request to Endpoint known as {string} path {string} with query {string} {string}',
  function (this: World, method: string, alias: string, path: string, key: string, value: string) {
    return sendHttpRequest(this, getRestEndpoint(this, alias), method, path, [{ TYPE: 'QUERY', KEY: key, VALUE: value }]);
  },
);

When(
  'I send a {httpMethod} request to Endpoint known as {string} path {string} with basic auth {string} {string}',
  function (this: World, method: string, alias: string, path: string, username: string, password: string) {
    return sendHttpRequest(this, getRestEndpoint(this, alias), method, path, [{ TYPE: 'BASIC_AUTH', KEY: username, VALUE: password }]);
  },
);

// Accumulation mechanism for a multi-row request table, same real shape
// as progressive discovery's PendingSelector: build up several real
// TYPE|KEY|VALUE rows across several Given/And lines instead of one
// table, then fire the exact same sendHttpRequest with them - no second
// request-building implementation. One generic registration, not one
// per TYPE, since it mirrors a table row's three cells exactly and
// already covers every real TYPE (HEADER/QUERY/FIELD/BODY/FORM/FILE/
// BASIC_AUTH) - sendHttpRequest's own TYPE validation still runs
// unchanged, so an unknown TYPE here fails the same real way it would
// from a table. A BODY row's blank KEY table cell becomes an
// empty-string {string} argument here, not a special case.
Given('{string} has {word} {string} {string}', function (this: World, alias: string, type: string, key: string, value: string) {
  const rows = this.pendingRequests.get(alias) ?? [];
  rows.push({ TYPE: type, KEY: key, VALUE: value });
  this.pendingRequests.set(alias, rows);
});

function getPendingRequest(world: World, alias: string): RequestRow[] {
  const rows = world.pendingRequests.get(alias);
  if (!rows) {
    throw new Error(`No pending request registered as "${alias}"`);
  }
  return rows;
}

When('I send {string} as {httpMethod} to Endpoint known as {string} path {string}', function (this: World, requestAlias: string, method: string, endpointAlias: string, path: string) {
  return sendHttpRequest(this, getRestEndpoint(this, endpointAlias), method, path, getPendingRequest(this, requestAlias));
});

When('I attempt to send a {httpMethod} request to Endpoint known as {string} path {string}', function (this: World, method: string, alias: string, path: string) {
  const endpoint = getRestEndpoint(this, alias);
  return attempt(this, () => sendHttpRequest(this, endpoint, method, path));
});

When(
  'I attempt to send a {httpMethod} request to Endpoint known as {string} path {string} with:',
  function (this: World, method: string, alias: string, path: string, table: DataTable) {
    const endpoint = getRestEndpoint(this, alias);
    return attempt(this, () => sendHttpRequest(this, endpoint, method, path, table.hashes() as RequestRow[]));
  },
);

// Two separate functions, not one shared function with an optional
// trailing param - same cucumber-js legacy-callback-detection footgun
// documented in common.step.ts's assertExitCodeOnly/assertExitCodeAndOutput.
function assertResponseStatusOnly(this: World, expected: number) {
  if (!this.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  assertCondition('status', this.lastHttpResponse.status, 'equals', String(expected), { ...this.lastHttpResponse });
}

// Shared by the table form and its oneline sibling below - one place
// that knows SOURCE is only ever BODY today, not two.
function assertResponseBodySource(world: World, source: string, condition: string, value: string): void {
  if (source !== 'BODY') {
    throw new Error(`Unknown response SOURCE "${source}" (known sources: BODY)`);
  }
  assertCondition(source, world.lastHttpResponse!.body, condition, value, { ...world.lastHttpResponse });
}

function assertResponseStatusAndOutput(this: World, expected: number, table: DataTable) {
  assertResponseStatusOnly.call(this, expected);
  for (const { SOURCE, CONDITION, VALUE } of table.hashes()) {
    assertResponseBodySource(this, SOURCE, CONDITION, VALUE);
  }
}

Then('the response status is {int}', assertResponseStatusOnly);
Then('the response status is {int}:', assertResponseStatusAndOutput);

function assertResponseStatusAndCondition(this: World, expected: number, source: string, condition: string, value: string) {
  assertResponseStatusOnly.call(this, expected);
  assertResponseBodySource(this, source, condition, value);
}

Then('the response status is {int} {word} {condition} {word}', assertResponseStatusAndCondition);
Then('the response status is {int} {word} {condition} {string}', assertResponseStatusAndCondition);

Then('the response headers has:', function (this: World, table: DataTable) {
  if (!this.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  // fetch()'s Headers normalizes names to lowercase - KEY rows must be
  // written lowercase to match.
  for (const { KEY, CONDITION, VALUE } of table.hashes()) {
    assertCondition(KEY, this.lastHttpResponse.headers[KEY], CONDITION, VALUE, { ...this.lastHttpResponse.headers });
  }
});

function assertResponseHeaderCondition(this: World, key: string, condition: string, value: string) {
  if (!this.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  assertCondition(key, this.lastHttpResponse.headers[key], condition, value, { ...this.lastHttpResponse.headers });
}

Then('the response header {string} {condition} {word}', assertResponseHeaderCondition);
Then('the response header {string} {condition} {string}', assertResponseHeaderCondition);

// Proves a download is byte-identical to a real fixture, not just that
// some text loosely matches - res.text() alone can't prove this for
// arbitrary binary content.
Then('the response body equals the real bytes of {string}', function (this: World, filePath: string) {
  if (!this.lastHttpResponse) {
    throw new Error('No HTTP request has been sent yet');
  }
  const expected = fs.readFileSync(filePath);
  if (!expected.equals(this.lastHttpResponse.bodyBytes)) {
    throw new Error(`Response body (${this.lastHttpResponse.bodyBytes.length} bytes) does not match real file "${filePath}" (${expected.length} bytes)`);
  }
});
