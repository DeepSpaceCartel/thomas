import { DataTable } from '@cucumber/cucumber';
import { runCommand } from '../run_command.js';

export interface K8sObjectRef {
  name: string;
  namespace: string;
}

// A selector being built progressively across several real Given steps
// (`Given <Kind> "<Alias>"` then `And "<Alias>" namespace is "<Y>"` /
// `And "<Alias>" label "<K>" is "<V>"` per label) rather than in one
// PROPERTY|VALUE table. Deliberately not resolved into a real
// K8sObjectRef until first real use (see kubernetes.step.ts's
// getRegisteredObject) - with this style the full selector genuinely
// isn't known until the last `And` line runs, so there's no earlier
// point where a real `kubectl get` would even have enough information.
export interface PendingSelector {
  kind: string;
  namespace?: string;
  labels: Record<string, string>;
}

// Unlike Directory/HelmRelease, there's no closed KNOWN_FIELDS list here -
// "namespace" is the one recognized non-label field; every other row is
// an arbitrary label key/value used to build the `-l` selector, since a
// real chart's label set isn't something this framework can enumerate in
// advance the way a fixed property set can.
//
// This runs a real `kubectl get` at construction time - but it's
// read-only, the same kind of real check Directory already does via
// fs.existsSync, just against the cluster instead of the filesystem.
// Takes a plain fields object rather than a DataTable directly so the
// progressive-selector path in kubernetes.step.ts (which accumulates
// namespace/labels across several real Given steps, not one table) can
// call the same real logic without fabricating a DataTable - one real
// implementation, two entry points, same shape as buildArgs/tokenizeFlags.
export function discoverByFields(kind: string, fields: Record<string, string>): K8sObjectRef {
  const { namespace, ...labels } = fields;
  if (!namespace) {
    throw new Error(`${kind} requires a "namespace" field`);
  }
  const labelKeys = Object.keys(labels);
  if (labelKeys.length === 0) {
    throw new Error(`${kind} requires at least one label field to select a resource by`);
  }
  const selector = labelKeys.map((key) => `${key}=${labels[key]}`).join(',');

  const list = runCommand('kubectl', ['get', kind, '-n', namespace, '-l', selector, '-o', 'name']);
  if (list.EXIT_CODE !== '0') {
    throw new Error(`kubectl get ${kind} failed: ${list.STDERR}`);
  }
  const matches = list.STDOUT.split('\n').filter(Boolean);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${kind} matching "${selector}" in namespace "${namespace}", found ${matches.length}`);
  }
  // `-o name` prints "deployment.apps/foo" / "service/foo" - the name is
  // always the part after the last "/".
  return { name: matches[0].split('/').pop()!, namespace };
}

export function discoverByLabels(kind: string, dataTable: DataTable): K8sObjectRef {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return discoverByFields(kind, fields);
}
