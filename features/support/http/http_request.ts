import fs from 'node:fs';
import path from 'node:path';
import { Agent } from 'undici';
import { World } from '../world.js';
import { RestEndpoint } from './rest_endpoint.js';
import { substituteCapturedValues } from './capture.js';

// The plain-fields core a TYPE|KEY|VALUE table's `table.hashes()` already
// produces - same "table form is sugar over a plain-fields core" split as
// restEndpointFromFields/restEndpointFromTable and discoverByFields/
// discoverByLabels elsewhere in this project. Lets a oneline single-row
// shorthand (`with header "<K>" "<V>"` etc. in http.step.ts) build one of
// these directly, with zero duplicated request-building logic.
export interface RequestRow extends Record<string, string> {
  TYPE: string;
  KEY: string;
  VALUE: string;
}

// Node's global fetch() is undici-based internally and honors a real
// `dispatcher` option for per-request custom-CA trust - but TS's DOM lib
// RequestInit type doesn't declare it, so this one local type is the
// only accommodation needed; the rest of this file's fetch() usage is
// unmodified real WHATWG fetch.
type FetchInitWithDispatcher = RequestInit & { dispatcher?: Agent };

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  bodyBytes: Buffer;
}

// A fresh Service's ClusterIP/Endpoints/DNS record is real, but not
// necessarily *immediately* routable cluster-wide the instant `--atomic`
// reports success - confirmed live: a real request fired right after a
// real `helm upgrade --atomic` occasionally hit a genuine connection-
// establishment failure (never an HTTP-level error) that a manual retry
// moments later did not. Real Kubernetes eventual consistency, the same
// class of race `secret.ts`'s bounded retry already covers for cert-
// manager. Scoped to real connection-establishment error codes only -
// never a TLS/certificate verification failure (a genuinely wrong
// certificate must keep failing every time, not get retried into a false
// pass), and never any HTTP-level status code (not an exception here at
// all).
const CONNECTION_RETRY_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);

async function fetchWithConnectionRetry(url: URL, init: FetchInitWithDispatcher, attempts = 5, delayMs = 500): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      const code = error instanceof TypeError ? (error.cause as { code?: string } | undefined)?.code : undefined;
      if (attempt >= attempts || !code || !CONNECTION_RETRY_CODES.has(code)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// TYPE|KEY|VALUE rows -> a real fetch(). HEADER/QUERY are self-explanatory;
// FIELD is one field of a JSON body, assembled into an object here rather
// than accepted as a single raw-JSON cell - kept field-by-field like every
// other table in this project (PROPERTY|VALUE, OPTION|VALUE always being
// one real value per row, never a blob crammed into one cell). BODY is an
// escape hatch (VALUE = a literal JSON string) for a body too nested for
// flat FIELD rows to express. FORM/FILE build a real multipart body -
// FORM is a plain text field, FILE's VALUE is a path to a real fixture
// file, read from disk and uploaded under its own basename. BASIC_AUTH is
// curl `-u`'s equivalent - KEY/VALUE are the real username/password,
// base64-encoded here into a real `Authorization: Basic ...` header,
// so a scenario never has to hand-encode (and hardcode) that string
// itself. BODY/FIELD rows/FORM+FILE rows are three mutually exclusive
// ways to build one request body - a table combining more than one of
// them is rejected; BASIC_AUTH is independent of all three (it only ever
// sets a header, same as HEADER).
//
// `rows` defaults to empty - a request with no headers/query/body needs
// none at all (see the no-`with:` step variant in http.step.ts).
export async function sendHttpRequest(world: World, endpoint: RestEndpoint, method: string, rawPath: string, rows: RequestRow[] = []): Promise<void> {
  const requestPath = substituteCapturedValues(world, rawPath);
  const url = new URL(requestPath, endpoint.baseUrl);
  const headers: Record<string, string> = {};
  const fields: Record<string, string> = {};
  const formParts: { type: 'FORM' | 'FILE'; key: string; value: string }[] = [];
  let rawBody: string | undefined;

  for (const { TYPE, KEY, VALUE } of rows) {
    const value = substituteCapturedValues(world, VALUE);
    if (TYPE === 'HEADER') {
      headers[KEY] = value;
    } else if (TYPE === 'QUERY') {
      url.searchParams.append(KEY, value);
    } else if (TYPE === 'FIELD') {
      fields[KEY] = value;
    } else if (TYPE === 'BODY') {
      rawBody = value;
    } else if (TYPE === 'FORM' || TYPE === 'FILE') {
      formParts.push({ type: TYPE, key: KEY, value });
    } else if (TYPE === 'BASIC_AUTH') {
      headers['Authorization'] = `Basic ${Buffer.from(`${KEY}:${value}`).toString('base64')}`;
    } else {
      throw new Error(`Unknown request TYPE "${TYPE}" (known types: HEADER, QUERY, FIELD, BODY, FORM, FILE, BASIC_AUTH)`);
    }
  }

  const hasFields = Object.keys(fields).length > 0;
  const hasMultipart = formParts.length > 0;
  if ([rawBody !== undefined, hasFields, hasMultipart].filter(Boolean).length > 1) {
    throw new Error('Request table cannot mix BODY, FIELD, and FORM/FILE rows - use exactly one way to build the body');
  }

  let body: string | FormData | undefined;
  if (hasMultipart) {
    const formData = new FormData();
    for (const part of formParts) {
      if (part.type === 'FORM') {
        formData.append(part.key, part.value);
      } else {
        const buffer = fs.readFileSync(part.value);
        formData.append(part.key, new Blob([buffer]), path.basename(part.value));
      }
    }
    body = formData;
  } else if (rawBody !== undefined) {
    body = rawBody;
  } else if (hasFields) {
    body = JSON.stringify(fields);
  }

  // A FormData body must NOT get an explicit Content-Type - fetch sets
  // the correct `multipart/form-data; boundary=...` value itself, and
  // setting it manually here would omit the boundary and break parsing.
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
  if (body !== undefined && !hasMultipart && !hasContentType) {
    headers['Content-Type'] = 'application/json';
  }

  // For an https endpoint, verification stays real - a per-request
  // Agent trusting exactly the endpoint's own real cert (never a
  // blanket rejectUnauthorized:false), so a genuinely wrong/expired cert
  // still fails the request instead of being silently accepted.
  const dispatcher = endpoint.caCert ? new Agent({ connect: { ca: endpoint.caCert } }) : undefined;

  // `redirect: 'manual'` deliberately - a 3xx (needed later for the
  // OAuth2 authorization-code flow's redirect) is directly observable as
  // a status + Location header, not silently auto-followed.
  const res = await fetchWithConnectionRetry(url, {
    method,
    headers,
    body,
    redirect: 'manual',
    ...(dispatcher ? { dispatcher } : {}),
  } as FetchInitWithDispatcher);
  const bytes = Buffer.from(await res.arrayBuffer());
  world.lastHttpResponse = {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: bytes.toString('utf8'),
    bodyBytes: bytes,
  };
  // Dual-bookkeeping: also populate lastCommandResult so the existing,
  // unmodified "the command result data has:" step keeps working for
  // JSON body assertions (a JSON body is valid YAML, so yaml.load +
  // JMESPath round-trips it with zero new code). Status/header
  // assertions get their own purpose-built Then steps in http.step.ts
  // instead of overloading "the command exited with {int}", which would
  // read misleadingly for an HTTP call.
  world.lastCommandResult = { EXIT_CODE: String(res.status), STDOUT: bytes.toString('utf8'), STDERR: '' };
}
