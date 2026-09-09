import { DataTable } from '@cucumber/cucumber';
import { HelmChart } from './helm_chart.js';

const KNOWN_FIELDS = ['chart', 'name', 'namespace'] as const;

export class HelmRelease {
  // NOT a string resource like Directory/File/URL/OCIArtifact - a real
  // HelmChart object. Its CLI representation depends on chart.kind (local
  // path vs URL vs OCI vs reference+repo), so HelmRelease needs the object
  // itself, resolved via a dedicated (alias) => HelmChart callback, not
  // the string-only resolveResource used everywhere else.
  readonly chart: HelmChart;
  readonly name: string;
  readonly namespace: string;

  constructor(fields: Record<string, string>, chart: HelmChart) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`HelmRelease has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.name) {
      throw new Error('HelmRelease requires a "name" field');
    }
    if (!fields.namespace) {
      throw new Error('HelmRelease requires a "namespace" field');
    }
    this.chart = chart;
    this.name = fields.name;
    this.namespace = fields.namespace;
  }
}

// Shared by the table-form `Given` and the oneline `Given ... with chart
// ... name ... namespace ...` step - one implementation, not two.
export function helmReleaseFromFields(fields: Record<string, string>, resolveChart: (alias: string) => HelmChart | undefined): HelmRelease {
  if (!fields.chart) {
    throw new Error('HelmRelease requires a "chart" field');
  }
  const chart = resolveChart(fields.chart);
  if (!chart) {
    throw new Error(`No HelmChart registered as "${fields.chart}"`);
  }
  return new HelmRelease(fields, chart);
}

export function helmReleaseFromTable(dataTable: DataTable, resolveChart: (alias: string) => HelmChart | undefined): HelmRelease {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return helmReleaseFromFields(fields, resolveChart);
}
