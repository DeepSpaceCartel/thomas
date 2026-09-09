import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../support/world.js';
import { deploymentFromTable } from '../support/k8s/deployment.js';
import { serviceFromTable } from '../support/k8s/service.js';
import { Pod, podFromTable } from '../support/k8s/pod.js';
import { configMapFromTable } from '../support/k8s/configmap.js';
import { replicaSetFromTable } from '../support/k8s/replicaset.js';
import { K8sObjectRef } from '../support/k8s/discover.js';
import { buildArgs, CommandResult, runCommand } from '../support/run_command.js';
import { attempt } from '../support/attempt.js';
import { parseDuration, pollUntil } from '../support/poll.js';
import { query } from '../support/query.js';

Given('Deployment known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.deployments.set(alias, deploymentFromTable(dataTable));
});

When('I attempt to define Deployment known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.deployments.set(alias, deploymentFromTable(dataTable));
  });
});

Given('Service known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.services.set(alias, serviceFromTable(dataTable));
});

When('I attempt to define Service known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.services.set(alias, serviceFromTable(dataTable));
  });
});

Given('Pod known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.pods.set(alias, podFromTable(dataTable));
});

When('I attempt to define Pod known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.pods.set(alias, podFromTable(dataTable));
  });
});

Given('ConfigMap known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.configMaps.set(alias, configMapFromTable(dataTable));
});

When('I attempt to define ConfigMap known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.configMaps.set(alias, configMapFromTable(dataTable));
  });
});

// See support/k8s/replicaset.ts's header comment - only safe to register
// against a release that has been installed once and never upgraded/
// rolled back again, or the "exactly one match" check below fails.
Given('ReplicaSet known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.replicaSets.set(alias, replicaSetFromTable(dataTable));
});

When('I attempt to define ReplicaSet known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.replicaSets.set(alias, replicaSetFromTable(dataTable));
  });
});

// One place mapping a lowercase kubectl kind word (the Gherkin {word}
// token in the get/events/logs steps below) to which World map holds
// that kind's discovered refs, and whether the kind supports `kubectl
// logs` (Service/ConfigMap don't - neither has logs). This is the entire
// per-kind cost of wiring a new kind into get/events/logs - no new step
// text needed. The `Given`/`attempt-to-define` pairs above stay literal,
// unavoidable registrations (see extend-thomas/SKILL.md and the docs) -
// a single `{word} known as ...:` step would collide with every other
// single-word alias type (Directory, HelmRelease, File, URL,
// OCIArtifact) already registered the same shape.
const KIND_REGISTRY: Record<string, { map: (world: World) => Map<string, K8sObjectRef>; supportsLogs: boolean }> = {
  deployment: { map: (w) => w.deployments, supportsLogs: true },
  service: { map: (w) => w.services, supportsLogs: false },
  pod: { map: (w) => w.pods, supportsLogs: true },
  configmap: { map: (w) => w.configMaps, supportsLogs: false },
  replicaset: { map: (w) => w.replicaSets, supportsLogs: false },
};

function getRegisteredObject(world: World, kind: string, alias: string): K8sObjectRef {
  const entry = KIND_REGISTRY[kind.toLowerCase()];
  if (!entry) {
    throw new Error(`Unknown Kubernetes kind "${kind}" (known kinds: ${Object.keys(KIND_REGISTRY).join(', ')})`);
  }
  const obj = entry.map(world).get(alias);
  if (!obj) {
    throw new Error(`No ${kind} registered as "${alias}"`);
  }
  return obj;
}

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

When('I get events for {word} known as {string}', function (this: World, kind: string, alias: string) {
  this.lastCommandResult = kubectlEvents(getRegisteredObject(this, kind, alias), kind.toLowerCase(), []);
});
When('I get events for {word} known as {string} with:', function (this: World, kind: string, alias: string, table: DataTable) {
  this.lastCommandResult = kubectlEvents(getRegisteredObject(this, kind, alias), kind.toLowerCase(), buildArgs(table));
});

When('I get logs for {word} known as {string}', function (this: World, kind: string, alias: string) {
  assertLogsSupported(kind);
  this.lastCommandResult = kubectlLogs(getRegisteredObject(this, kind, alias), kind.toLowerCase(), []);
});
When('I get logs for {word} known as {string} with:', function (this: World, kind: string, alias: string, table: DataTable) {
  assertLogsSupported(kind);
  this.lastCommandResult = kubectlLogs(getRegisteredObject(this, kind, alias), kind.toLowerCase(), buildArgs(table));
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

When('I poll events for Pod known as {string} every {string} for up to {string} until:', function (this: World, alias: string, interval: string, timeout: string, table: DataTable) {
  const pod = getRegisteredObject(this, 'pod', alias);
  return pollRawText(this, interval, timeout, table, () => kubectlEvents(pod, 'pod', []));
});
