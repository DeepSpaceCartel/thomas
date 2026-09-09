import { DataTable } from '@cucumber/cucumber';
import { discoverByLabels, K8sObjectRef } from './discover.js';

export type ReplicaSet = K8sObjectRef;

// A Deployment's real ReplicaSet children are NOT versioned out of
// existence on upgrade - by default Kubernetes keeps old ones around
// (`revisionHistoryLimit`), and every one of them - old or current -
// carries the exact same `app.kubernetes.io/name`/`instance` labels as
// the Deployment itself (only `pod-template-hash` differs, which this
// framework's open-ended label selector doesn't know to add). That means
// discoverByLabels's "exactly one match" requirement genuinely fails
// against any release that has been upgraded more than once (e.g.
// `features/helm/release-short.feature`/`release-full.feature`'s
// RollbackRelease, which upgrades twice before rolling back) - only use
// this against a release installed once and never upgraded/rolled back
// again.
export function replicaSetFromTable(dataTable: DataTable): ReplicaSet {
  return discoverByLabels('replicaset', dataTable);
}
