import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { deploymentFromTable } from '../../support/k8s/deployment.js';
import { serviceFromTable } from '../../support/k8s/service.js';
import { Pod, podFromTable } from '../../support/k8s/pod.js';
import { configMapFromTable } from '../../support/k8s/configmap.js';
import { replicaSetFromTable } from '../../support/k8s/replicaset.js';
import { fetchCertPem, secretFromFields, secretFromTable } from '../../support/k8s/secret.js';
import { discoverByFields, K8sObjectRef } from '../../support/k8s/discover.js';
import { softSubstituteCapturedValue, substituteTableCapturedValues } from '../../support/http/capture.js';
import { buildArgs, CommandResult, outputFormatToArgs, runCommand } from '../../support/run_command.js';
import { attempt } from '../../support/attempt.js';
import { parseDuration, pollUntil } from '../../support/poll.js';
import { query } from '../../support/query.js';
import { assertResultCondition, getPendingPayload } from '../common.step.js';

Given('Deployment known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.deployments.set(alias, deploymentFromTable(substituteTableCapturedValues(this, dataTable)));
});

When('I attempt to define Deployment known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.deployments.set(alias, deploymentFromTable(dataTable));
  });
});

Given('Service known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.services.set(alias, serviceFromTable(substituteTableCapturedValues(this, dataTable)));
});

When('I attempt to define Service known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.services.set(alias, serviceFromTable(dataTable));
  });
});

Given('Pod known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.pods.set(alias, podFromTable(substituteTableCapturedValues(this, dataTable)));
});

When('I attempt to define Pod known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.pods.set(alias, podFromTable(dataTable));
  });
});

Given('ConfigMap known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.configMaps.set(alias, configMapFromTable(substituteTableCapturedValues(this, dataTable)));
});

When('I attempt to define ConfigMap known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.configMaps.set(alias, configMapFromTable(dataTable));
  });
});

// A real `kubectl create configmap ... --from-file=<key>=<path>` - unlike
// every other ConfigMap this suite touches (chart-managed, torn down by
// `helm uninstall` automatically), one created this way has no
// ownerReference back to any Helm release and is left behind unless
// deleted explicitly - registers into the same `world.configMaps` map
// discovery uses, so the already-generic `I delete {word} known as
// {string}` step (see its own comment above, which already anticipated
// exactly this case) is the cleanup, not a second bespoke step. The
// motivating real case: mounting a CA cert into a pod via a chart's
// generic `extraVolumes`/`extraVolumeMounts` escape hatch (e.g.
// `GIT_SSL_CAINFO`) - content that needs to exist as a real file inside
// the pod, which a Helm value alone can't produce.
When('I create ConfigMap known as {string} named {string} in {string} from file {string} at {string}', function (this: World, alias: string, name: string, namespace: string, key: string, filePath: string) {
  const ns = softSubstituteCapturedValue(this, namespace);
  this.lastCommandResult = runCommand('kubectl', ['create', 'configmap', name, '-n', ns, `--from-file=${key}=${softSubstituteCapturedValue(this, filePath)}`]);
  this.configMaps.set(alias, { name, namespace: ns });
});

// See support/k8s/replicaset.ts's header comment - only safe to register
// against a release that has been installed once and never upgraded/
// rolled back again, or the "exactly one match" check below fails.
Given('ReplicaSet known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.replicaSets.set(alias, replicaSetFromTable(substituteTableCapturedValues(this, dataTable)));
});

When('I attempt to define ReplicaSet known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.replicaSets.set(alias, replicaSetFromTable(dataTable));
  });
});

Given('Secret known as {string}:', async function (this: World, alias: string, dataTable: DataTable) {
  this.secrets.set(alias, await secretFromTable(substituteTableCapturedValues(this, dataTable)));
});

// Payload-accumulator sibling - goes through the exact same real
// secretFromFields retry as the table form above (see secret.ts), not a
// bypass of it.
Given('Secret known as {string} using {string}', async function (this: World, alias: string, payloadAlias: string) {
  this.secrets.set(alias, await secretFromFields(getPendingPayload(this, payloadAlias)));
});

When('I attempt to define Secret known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, async () => {
    this.secrets.set(alias, await secretFromTable(dataTable));
  });
});

// Real `kubectl create secret generic ... --from-file=<key>=<path>` - the
// Secret sibling of "I create ConfigMap known as ... from file ..."
// above (same comment applies: no ownerReference, `I delete` is the real
// cleanup). Distinct from a chart's own self-managed Secret (e.g.
// gitCredentials.entries rendered via a real `--set-file
// gitCredentials.entries[0].privateKey=<path>` - see docs/reference/
// KUBECTL.md) - that path only ever produces a well-formed JSON array;
// this one is for seeding deliberately arbitrary/malformed real content
// (e.g. a negative-path "malformed git-credentials.json" scenario) no
// chart values field can express.
When('I create Secret known as {string} named {string} in {string} from file {string} at {string}', function (this: World, alias: string, name: string, namespace: string, key: string, filePath: string) {
  const ns = softSubstituteCapturedValue(this, namespace);
  this.lastCommandResult = runCommand('kubectl', ['create', 'secret', 'generic', name, '-n', ns, `--from-file=${key}=${softSubstituteCapturedValue(this, filePath)}`]);
  this.secrets.set(alias, { name, namespace: ns });
});

// One place mapping a lowercase kubectl kind word (the Gherkin {word}
// token in the get/events/logs steps below) to which World map holds
// that kind's discovered refs, and whether the kind supports `kubectl
// logs` (Service/ConfigMap/Secret don't - none of them have logs). This
// is the entire per-kind cost of wiring a new kind into get/events/logs -
// no new step text needed. The `Given`/`attempt-to-define` pairs above
// stay literal, unavoidable registrations (see
// .agents/skills/thomas/references/extending.md and the docs) - a
// single `{word} known as ...:` step would collide with
// every other single-word resource type (Directory, Helm Release, File,
// URL, OCI Artifact) already registered the same shape.
const KIND_REGISTRY: Record<string, { map: (world: World) => Map<string, K8sObjectRef>; supportsLogs: boolean }> = {
  deployment: { map: (w) => w.deployments, supportsLogs: true },
  service: { map: (w) => w.services, supportsLogs: false },
  pod: { map: (w) => w.pods, supportsLogs: true },
  configmap: { map: (w) => w.configMaps, supportsLogs: false },
  replicaset: { map: (w) => w.replicaSets, supportsLogs: false },
  secret: { map: (w) => w.secrets, supportsLogs: false },
};

// The one real lookup point every get/events/logs/delete/poll/"has" step
// goes through - which is also where a progressive selector (built up
// across several real `Given` lines instead of one PROPERTY|VALUE table,
// see PendingSelector's comment) gets resolved into a real object, the
// first time it's actually needed. Everything downstream of this
// function is unaware of which construction style built the alias -
// same real `kubectl get`, same real error behavior, just possibly
// deferred to here instead of already having run at `Given` time.
export function getRegisteredObject(world: World, kind: string, alias: string): K8sObjectRef {
  const entry = KIND_REGISTRY[kind.toLowerCase()];
  if (!entry) {
    throw new Error(`Unknown Kubernetes kind "${kind}" (known kinds: ${Object.keys(KIND_REGISTRY).join(', ')})`);
  }
  const map = entry.map(world);
  let obj = map.get(alias);
  if (!obj) {
    const pending = world.pendingSelectors.get(alias);
    if (pending && pending.kind === kind.toLowerCase()) {
      obj = discoverByFields(kind.toLowerCase(), { namespace: pending.namespace ?? '', ...pending.labels });
      map.set(alias, obj);
      world.pendingSelectors.delete(alias);
    }
  }
  if (!obj) {
    throw new Error(`No ${kind} registered as "${alias}"`);
  }
  return obj;
}

// Progressive discovery: an additive second construction style alongside
// the PROPERTY|VALUE table `Given <Kind> known as "<Alias>":` above (that
// one still resolves eagerly, exactly as before - this one accumulates
// real predicates across several `Given` lines and resolves lazily, see
// getRegisteredObject above and PendingSelector's comment). All three
// registered as `Given`, matching this project's "Given only ever
// constructs" discipline - Gherkin's `And` in a real .feature file reads
// as whichever keyword the narrative wants regardless of how the step
// was registered.
Given('{word} {string}', function (this: World, kind: string, alias: string) {
  if (!KIND_REGISTRY[kind.toLowerCase()]) {
    throw new Error(`Unknown Kubernetes kind "${kind}" (known kinds: ${Object.keys(KIND_REGISTRY).join(', ')})`);
  }
  this.pendingSelectors.set(alias, { kind: kind.toLowerCase(), labels: {} });
});

function getPendingSelector(world: World, alias: string) {
  const pending = world.pendingSelectors.get(alias);
  if (!pending) {
    throw new Error(`No pending selector registered as "${alias}" (use "Given <Kind> "${alias}"" first)`);
  }
  return pending;
}

Given('{string} namespace is {string}', function (this: World, alias: string, namespace: string) {
  getPendingSelector(this, alias).namespace = softSubstituteCapturedValue(this, namespace);
});

Given('{string} label {string} is {string}', function (this: World, alias: string, key: string, value: string) {
  getPendingSelector(this, alias).labels[key] = value;
});

// A progressive selector's own discovery (getRegisteredObject) is
// eager and one-shot - fine for a Helm install that actually waited
// (--atomic/--wait, so the Deployment/Service/Pod already exist by the
// time anything discovers them), but wrong for a deliberate fire-and-
// forget rollout (no --wait): the real object plausibly doesn't exist
// for real yet at the exact moment discovery first runs. This retries
// discovery itself - not a field of an already-known object, the
// resource actually coming into existence - tolerating "not found yet"
// as retryable and only registering once real, unambiguous discovery
// succeeds.
When('I wait for {word} known as {string} every {string} for up to {string}', function (this: World, kind: string, alias: string, interval: string, timeout: string) {
  const lowerKind = kind.toLowerCase();
  const entry = KIND_REGISTRY[lowerKind];
  if (!entry) {
    throw new Error(`Unknown Kubernetes kind "${kind}" (known kinds: ${Object.keys(KIND_REGISTRY).join(', ')})`);
  }
  const pending = getPendingSelector(this, alias);
  if (pending.kind !== lowerKind) {
    throw new Error(`Pending selector "${alias}" was registered as "${pending.kind}", not "${lowerKind}"`);
  }
  const world = this;
  return pollUntil(parseDuration(interval), parseDuration(timeout), () => {
    try {
      const obj = discoverByFields(lowerKind, { namespace: pending.namespace ?? '', ...pending.labels });
      entry.map(world).set(alias, obj);
      world.pendingSelectors.delete(alias);
      return { rows: [{ label: 'discovered', actual: true, condition: 'equals', expected: 'true', outcome: 'pass' }], snapshot: JSON.stringify(obj) };
    } catch (e) {
      return { rows: [{ label: 'discovered', actual: false, condition: 'equals', expected: 'true', outcome: 'pass' }], snapshot: e instanceof Error ? e.message : String(e) };
    }
  });
});

function assertLogsSupported(kind: string): void {
  const entry = KIND_REGISTRY[kind.toLowerCase()];
  if (entry && !entry.supportsLogs) {
    throw new Error(`${kind} has no logs`);
  }
}

// The three verb shapes (get/events/logs) all reduce to
// "kubectl <verb...> -n <namespace> [...]" over a ref's name/namespace -
// centralized here once, taking plain argv (`extraArgs`) rather than a
// DataTable, so both the one-shot `get`/`events`/`logs` steps below
// (which derive extraArgs from a real OPTION|VALUE table via buildArgs)
// and the polling functions further down (which pass a small fixed argv
// of their own, e.g. `['-o', 'json']`) go through the exact same argv
// construction - one implementation of each real command shape, not two.
//
// `kind` is always passed lowercase (kubectl's own CLI convention, e.g.
// "deployment") - kubectlEvents capitalizes it itself for the
// `involvedObject.kind` field-selector value, which needs the exact
// capitalized Kind (`Deployment`), so callers never have to remember to
// pass two different casings for the same type.
function capitalize(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function kubectlGet(ref: K8sObjectRef, kind: string, extraArgs: string[]): CommandResult {
  return runCommand('kubectl', ['get', kind, ref.name, '-n', ref.namespace, ...extraArgs]);
}

function kubectlEvents(ref: K8sObjectRef, kind: string, extraArgs: string[]): CommandResult {
  return runCommand('kubectl', [
    'get',
    'events',
    '-n',
    ref.namespace,
    '--field-selector',
    `involvedObject.name=${ref.name},involvedObject.kind=${capitalize(kind)}`,
    ...extraArgs,
  ]);
}

function kubectlLogs(ref: K8sObjectRef, kind: string, extraArgs: string[]): CommandResult {
  return runCommand('kubectl', ['logs', `${kind}/${ref.name}`, '-n', ref.namespace, ...extraArgs]);
}

When('I get {word} known as {string}', function (this: World, kind: string, alias: string) {
  this.lastCommandResult = kubectlGet(getRegisteredObject(this, kind, alias), kind.toLowerCase(), []);
});
When('I get {word} known as {string} with:', function (this: World, kind: string, alias: string, table: DataTable) {
  this.lastCommandResult = kubectlGet(getRegisteredObject(this, kind, alias), kind.toLowerCase(), buildArgs(table));
});
When('I get {word} {string} with {flags}', function (this: World, kind: string, alias: string, flags: string[]) {
  this.lastCommandResult = kubectlGet(getRegisteredObject(this, kind, alias), kind.toLowerCase(), flags);
});
When('I get {word} {string} as {outputFormat}', function (this: World, kind: string, alias: string, format: string) {
  this.lastCommandResult = kubectlGet(getRegisteredObject(this, kind, alias), kind.toLowerCase(), outputFormatToArgs(format));
});

// Object-flavored sibling of "the command result has ...": still only
// ever reads lastCommandResult (populated by a prior real `I get ...`
// above), via the exact same assertResultCondition every other
// condition step uses - the real value added here is
// getRegisteredObject's check that the alias is a genuinely registered
// object of the stated kind, catching a copy-paste kind/alias mismatch
// before comparing anything.
function assertObjectResultCondition(this: World, kind: string, alias: string, key: string, condition: string, value: string) {
  getRegisteredObject(this, kind, alias);
  assertResultCondition(this, key, condition, value);
}

Then('{word} {string} has {string} {condition} {word}', assertObjectResultCondition);
Then('{word} {string} has {string} {condition} {string}', assertObjectResultCondition);

// Real cleanup escape hatch for objects `helm uninstall` doesn't own and
// so never deletes - discovered for real while building the TLS
// capability: cert-manager's own Secret (created via a Certificate's
// `secretTemplate`, not templated by the chart itself) has no
// ownerReference back to anything Helm tracks, and is left behind by
// every install/uninstall cycle unless deleted explicitly. Deployment/
// Service/Pod/ConfigMap/ReplicaSet never need this (Helm already owns
// and removes them on uninstall) but it's wired generically through the
// same KIND_REGISTRY for any kind that might.
When('I delete {word} known as {string}', function (this: World, kind: string, alias: string) {
  const ref = getRegisteredObject(this, kind, alias);
  this.lastCommandResult = runCommand('kubectl', ['delete', kind.toLowerCase(), ref.name, '-n', ref.namespace]);
});

When('I get events for {word} known as {string}', function (this: World, kind: string, alias: string) {
  this.lastCommandResult = kubectlEvents(getRegisteredObject(this, kind, alias), kind.toLowerCase(), []);
});
When('I get events for {word} known as {string} with:', function (this: World, kind: string, alias: string, table: DataTable) {
  this.lastCommandResult = kubectlEvents(getRegisteredObject(this, kind, alias), kind.toLowerCase(), buildArgs(table));
});
When('I get events for {word} {string} with {flags}', function (this: World, kind: string, alias: string, flags: string[]) {
  this.lastCommandResult = kubectlEvents(getRegisteredObject(this, kind, alias), kind.toLowerCase(), flags);
});

When('I get logs for {word} known as {string}', function (this: World, kind: string, alias: string) {
  assertLogsSupported(kind);
  this.lastCommandResult = kubectlLogs(getRegisteredObject(this, kind, alias), kind.toLowerCase(), []);
});
When('I get logs for {word} known as {string} with:', function (this: World, kind: string, alias: string, table: DataTable) {
  assertLogsSupported(kind);
  this.lastCommandResult = kubectlLogs(getRegisteredObject(this, kind, alias), kind.toLowerCase(), buildArgs(table));
});
When('I get logs for {word} {string} with {flags}', function (this: World, kind: string, alias: string, flags: string[]) {
  assertLogsSupported(kind);
  this.lastCommandResult = kubectlLogs(getRegisteredObject(this, kind, alias), kind.toLowerCase(), flags);
});

// --- Polling: for state that isn't guaranteed stable the instant it's
// discovered (a Pod, unlike a Deployment/Service already stabilized by
// `--atomic` before discovery runs). Every tick re-runs the real command
// (never re-checks stale data), succeeds the moment every `pass` row
// holds, fails immediately the moment any `fail` row holds (no need to
// exhaust the timeout on a state that's already terminal-bad), and only
// times out when the state is genuinely still pending.

function pollStructured(world: World, intervalStr: string, timeoutStr: string, table: DataTable, run: () => CommandResult): Promise<void> {
  const rows = table.hashes();
  return pollUntil(parseDuration(intervalStr), parseDuration(timeoutStr), () => {
    const result = run();
    world.lastCommandResult = result;
    const parsed = result.EXIT_CODE === '0' ? JSON.parse(result.STDOUT) : undefined;
    return {
      rows: rows.map((r) => ({
        label: r.KEY,
        actual: parsed === undefined ? undefined : query(parsed, r.KEY),
        condition: r.CONDITION,
        expected: r.VALUE,
        outcome: r.OUTCOME as 'pass' | 'fail',
      })),
      snapshot: result.STDOUT || result.STDERR,
    };
  });
}

function pollRawText(world: World, intervalStr: string, timeoutStr: string, table: DataTable, run: () => CommandResult): Promise<void> {
  const rows = table.hashes();
  return pollUntil(parseDuration(intervalStr), parseDuration(timeoutStr), () => {
    const result = run();
    world.lastCommandResult = result;
    return {
      rows: rows.map((r) => ({
        label: r.SOURCE,
        actual: result[r.SOURCE as 'STDOUT' | 'STDERR'],
        condition: r.CONDITION,
        expected: r.VALUE,
        outcome: r.OUTCOME as 'pass' | 'fail',
      })),
      snapshot: result.STDOUT || result.STDERR,
    };
  });
}

function pollPodStatus(world: World, pod: Pod, interval: string, timeout: string, table: DataTable): Promise<void> {
  return pollStructured(world, interval, timeout, table, () => kubectlGet(pod, 'pod', ['-o', 'json']));
}

When('I poll Pod known as {string} every {string} for up to {string} until:', function (this: World, alias: string, interval: string, timeout: string, table: DataTable) {
  return pollPodStatus(this, getRegisteredObject(this, 'pod', alias), interval, timeout, table);
});

When('I attempt to poll Pod known as {string} every {string} for up to {string} until:', function (this: World, alias: string, interval: string, timeout: string, table: DataTable) {
  const pod = getRegisteredObject(this, 'pod', alias);
  return attempt(this, () => pollPodStatus(this, pod, interval, timeout, table));
});

When('I poll logs for Pod known as {string} every {string} for up to {string} until:', function (this: World, alias: string, interval: string, timeout: string, table: DataTable) {
  const pod = getRegisteredObject(this, 'pod', alias);
  return pollRawText(this, interval, timeout, table, () => kubectlLogs(pod, 'pod', []));
});

// Flags-accepting sibling of the step above - needed for `--previous`
// (a crash-looping container's *previous* terminated instance's logs can
// lag real restarts by a few ticks, so this needs the same real retry
// loop the no-flags form gets, not a one-shot `kubectl logs --previous`).
When('I poll logs for Pod known as {string} every {string} for up to {string} with {flags} until:', function (this: World, alias: string, interval: string, timeout: string, flags: string[], table: DataTable) {
  const pod = getRegisteredObject(this, 'pod', alias);
  return pollRawText(this, interval, timeout, table, () => kubectlLogs(pod, 'pod', flags));
});

When('I poll events for Pod known as {string} every {string} for up to {string} until:', function (this: World, alias: string, interval: string, timeout: string, table: DataTable) {
  const pod = getRegisteredObject(this, 'pod', alias);
  return pollRawText(this, interval, timeout, table, () => kubectlEvents(pod, 'pod', []));
});

// Structured sibling of the raw-text poll above - a real k8s Event's
// `reason`/`message` are separate real fields (confirmed against the
// real `-o json` shape, same "Type/Reason/.../Message" columns `kubectl
// get events`'s default text rendering already shows, just parseable
// per-field instead of as one combined blob). Reuses pollStructured
// unchanged - the only real difference from `poll Pod` is which command
// produces the JSON. `KEY` is a JMESPath array projection over the real
// events list (`items[*].reason` / `items[*].message`) - existential
// matching across every event in the list, same real semantics already
// documented for any array-shaped KEY.
When('I poll structured events for Pod known as {string} every {string} for up to {string} until:', function (this: World, alias: string, interval: string, timeout: string, table: DataTable) {
  const pod = getRegisteredObject(this, 'pod', alias);
  return pollStructured(this, interval, timeout, table, () => kubectlEvents(pod, 'pod', ['-o', 'json']));
});

// --- Reaching inside a Pod, for the checks `get`/`logs`/`events` genuinely
// can't answer from the outside: a mounted file's real content, an env
// var, whether a process is actually running. Real `kubectl exec`, piped
// through a real shell (`sh -c`) so a real operator's command - including
// pipes/redirects - works unmodified, not a bespoke argv-splitting scheme.
function kubectlExec(pod: K8sObjectRef, command: string): CommandResult {
  return runCommand('kubectl', ['exec', pod.name, '-n', pod.namespace, '--', 'sh', '-c', command]);
}

When('I exec {string} in Pod known as {string}', function (this: World, command: string, alias: string) {
  const pod = getRegisteredObject(this, 'pod', alias);
  this.lastCommandResult = kubectlExec(pod, command);
});

// --- RBAC: "can this Pod's real ServiceAccount actually do X" - a
// different axis from Deployment/Service/Pod discovery entirely
// (permissions, not state). Reuses the already-discovered Pod - no new
// alias type needed. `kubectl auth can-i` itself is the real assertion
// mechanism: it exits 0 when allowed, 1 when denied, printing "yes"/"no"
// to STDOUT - so the existing `the command exited with {int}` step
// already covers "was this allowed", zero new vocabulary.
function kubectlAuthCanI(pod: K8sObjectRef, verb: string, resource: string, serviceAccount: string): CommandResult {
  return runCommand('kubectl', ['auth', 'can-i', verb, resource, `--as=system:serviceaccount:${pod.namespace}:${serviceAccount}`, '-n', pod.namespace]);
}

When('I check if Pod known as {string} can {string} {string}', function (this: World, alias: string, verb: string, resource: string) {
  const pod = getRegisteredObject(this, 'pod', alias);
  // Fresh real lookup, not a field cached at discovery time - the Pod's
  // spec (and thus its real serviceAccountName) is only known once
  // fetched, and this step exists specifically to check the account that
  // is actually, currently running the workload.
  const podJson = runCommand('kubectl', ['get', 'pod', pod.name, '-n', pod.namespace, '-o', 'json']);
  if (podJson.EXIT_CODE !== '0') {
    throw new Error(`kubectl get pod failed: ${podJson.STDERR}`);
  }
  const parsed = JSON.parse(podJson.STDOUT);
  const serviceAccount = query(parsed, 'spec.serviceAccountName') ?? 'default';
  this.lastCommandResult = kubectlAuthCanI(pod, verb, resource, String(serviceAccount));
});

// Stateless (no alias registered/resolved) - a real namespace, usually
// one just created via `--create-namespace` on a Helm install, has no
// object of its own in this suite to attach an action step to. `name`
// goes through the same soft captured-value substitution as any other
// namespace field (a dynamically-computed namespace is the real reason
// this exists - see PodSecurity labeling for a per-run disposable
// BuildKit instance).
When('I label namespace {string} with:', function (this: World, name: string, table: DataTable) {
  this.lastCommandResult = runCommand('kubectl', ['label', 'namespace', softSubstituteCapturedValue(this, name), ...buildArgs(table)]);
});
When('I label namespace {string} with {flags}', function (this: World, name: string, flags: string[]) {
  this.lastCommandResult = runCommand('kubectl', ['label', 'namespace', softSubstituteCapturedValue(this, name), ...flags]);
});

// --- TLS: inspecting a real cert-manager-issued certificate. `data.
// "tls.crt"` in a real Kubernetes TLS Secret is base64-encoded PEM - real
// `openssl x509` is the actual tool for reading it, not a bespoke ASN.1
// parser. Written to a real temp file (openssl needs a real path/stdin,
// not an in-memory buffer) and cleaned up immediately after - the
// certificate's real, parsed fields land in `lastCommandResult` exactly
// like every other command this suite runs, so `the command exited with
// {int}:` + `SOURCE|CONDITION|VALUE` against the real STDOUT (subject,
// expiry, SANs) needs no new assertion vocabulary either.
When('I inspect the certificate in Secret known as {string}', function (this: World, alias: string) {
  const secret = getRegisteredObject(this, 'secret', alias);
  const certPem = fetchCertPem(secret);
  const tmpFile = path.join(os.tmpdir(), `thomas-cert-${process.pid}-${Date.now()}.pem`);
  fs.writeFileSync(tmpFile, certPem);
  try {
    // -nameopt RFC2253 pins the real subject-line format (CN=x, no
    // spaces) explicitly - openssl's own unflagged default varies by
    // OS/build (confirmed for real: this dev sandbox's default omits
    // spaces around "=", a CI runner image's default didn't), so this
    // makes the assertion below environment-independent instead of
    // accidentally depending on which OpenSSL happened to run it. See
    // docs/project/ci.md - revisit once CI runs the same container
    // image as dev (Dev Containers), at which point this divergence
    // can't happen and the explicit flag is no longer load-bearing.
    this.lastCommandResult = runCommand('openssl', [
      'x509',
      '-in',
      tmpFile,
      '-noout',
      '-subject',
      '-nameopt',
      'RFC2253',
      '-enddate',
      '-ext',
      'subjectAltName',
    ]);
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});
