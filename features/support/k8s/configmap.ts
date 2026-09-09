import { DataTable } from '@cucumber/cucumber';
import { discoverByLabels, K8sObjectRef } from './discover.js';

export type ConfigMap = K8sObjectRef;

export function configMapFromTable(dataTable: DataTable): ConfigMap {
  return discoverByLabels('configmap', dataTable);
}
