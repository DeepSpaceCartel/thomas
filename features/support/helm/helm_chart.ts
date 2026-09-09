import fs from 'node:fs';
import { DataTable } from '@cucumber/cucumber';
import { isResourceReference } from '../resources/resource_reference.js';

// The CHART_REF positional argument to `helm install/upgrade` covers six
// forms (see `helm install --help`):
//   1. chart reference        example/mariadb
//   2. path to a packaged chart  ./nginx-1.2.3.tgz
//   3. path to an unpacked chart directory  ./nginx
//   4. absolute URL           https://example.com/charts/test-nginx-1.2.3.tgz
//   5. chart reference + --repo   nginx (with repo: https://example.com/charts/)
//   6. OCI registry ref       oci://example.com/charts/test-nginx
// A bare relative path (no scheme, no leading "./") is syntactically
// identical to form 1's "repo/name" shape - the real `helm` binary
// disambiguates by checking the filesystem, which a pure classifier
// shouldn't do (result would depend on cwd, and stop being a pure function
// of the string). So local paths MUST be written with an explicit "./"
// (or "../", "/") prefix to be recognised as local rather than a reference.
export type ChartRef =
  | { kind: 'oci'; ref: string }
  | { kind: 'url'; ref: string }
  | { kind: 'local-archive'; path: string }
  | { kind: 'local-directory'; path: string }
  | { kind: 'reference'; name: string; repo?: string; version?: string };

// "version" only applies to the "reference" kind - it becomes a real
// `--version` flag on `helm pull`/`install`/`upgrade`/`template`/`show`.
// The other four kinds are already pinned by construction: a local path
// IS a specific version, and `url`/`oci` already carry their exact
// version in the URL/tag itself (e.g. `nginx-18.2.5.tgz`,
// `oci://.../nginx:25.1.10`) - a separate `version` field there would be
// redundant with (and could silently disagree with) what's already in
// the ref, so it's rejected rather than silently ignored.
function parseChartRef(raw: string, repo: string | undefined, version: string | undefined): ChartRef {
  if (raw.startsWith('oci://')) return { kind: 'oci', ref: raw };
  if (/^https?:\/\//.test(raw)) return { kind: 'url', ref: raw };
  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) {
    return raw.endsWith('.tgz') ? { kind: 'local-archive', path: raw } : { kind: 'local-directory', path: raw };
  }
  if (raw.includes('/')) return { kind: 'reference', name: raw, version }; // "example/mariadb" - repo baked into the ref itself
  if (repo) return { kind: 'reference', name: raw, repo, version }; // "nginx" + a separate repo field, form 5
  throw new Error(`Cannot determine chart reference kind for "${raw}" (a bare name with no "/" needs a "repo" field)`);
}

// Only the two local forms can be checked without a network call (helm
// show chart / fetching the repo index). "reference"/"url"/"oci" are left
// unverified here on purpose - see the comment at the top of the file.
//
// This is mostly redundant with Directory/File's own existence checks,
// which already run when "chart" comes from a "<Alias>" (the recommended
// path) - but "chart" also accepts a raw literal path typed directly,
// bypassing the alias system entirely, and that path still needs its own
// validation. Not dead code, just a narrower safety net than it looks.
function validateChartExists(chart: ChartRef): void {
  if (chart.kind === 'local-directory') {
    if (!fs.existsSync(chart.path) || !fs.statSync(chart.path).isDirectory()) {
      throw new Error(`HelmChart local directory does not exist: "${chart.path}"`);
    }
  } else if (chart.kind === 'local-archive') {
    if (!fs.existsSync(chart.path) || !fs.statSync(chart.path).isFile()) {
      throw new Error(`HelmChart local archive does not exist: "${chart.path}"`);
    }
  }
}

const KNOWN_FIELDS = ['chart', 'repo', 'version'] as const;

export class HelmChart {
  readonly chart: ChartRef;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`HelmChart has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.chart) {
      throw new Error('HelmChart requires a "chart" field');
    }
    this.chart = parseChartRef(fields.chart, fields.repo, fields.version);
    if (fields.version && this.chart.kind !== 'reference') {
      throw new Error(`HelmChart "version" is only valid for a reference chart (repo/name or name+repo), not a "${this.chart.kind}" source`);
    }
    validateChartExists(this.chart);
  }
}

// `resolveResource` is a plain callback, not `World` itself - this module
// has zero dependency on world.ts (which already imports HelmChart for its
// `charts` map type), so taking World directly here would create a
// circular import. The step definition builds the closure since it's the
// one with `this: World`. Both `chart` (a location: directory/file/url/oci)
// and `repo` (always a url) can be written as an "<Alias>" instead of a
// raw literal.
//
// Shared by the table-form `Given` (builds `fields` from a DataTable) and
// the oneline `Given ... with chart/repo/version ...` steps (build
// `fields` directly, no table) - one real implementation of "turn field
// values into a HelmChart", not two.
export function helmChartFromFields(fields: Record<string, string>, resolveResource: (alias: string) => string | undefined): HelmChart {
  const resolved = { ...fields };
  for (const key of ['chart', 'repo'] as const) {
    if (resolved[key] && isResourceReference(resolved[key])) {
      const value = resolveResource(resolved[key]);
      if (value === undefined) {
        throw new Error(`No Resource registered as "${resolved[key]}"`);
      }
      resolved[key] = value;
    }
  }
  return new HelmChart(resolved);
}

export function helmChartFromTable(dataTable: DataTable, resolveResource: (alias: string) => string | undefined): HelmChart {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return helmChartFromFields(fields, resolveResource);
}
