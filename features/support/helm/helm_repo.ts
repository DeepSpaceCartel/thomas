import { DataTable } from '@cucumber/cucumber';
import { isResourceReference } from '../resources/resource_reference.js';

const KNOWN_FIELDS = ['name', 'url'] as const;

export class HelmRepo {
  // "name" here is the real `helm repo add <name> <url>` alias - it's what
  // a HelmChart's "reference" kind (e.g. "bitnami/nginx") expects to find
  // already registered, distinct from the World alias this object itself
  // is known as (e.g. "<BitnamiHelmRepo>").
  readonly name: string;
  readonly url: string;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`HelmRepo has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.name) {
      throw new Error('HelmRepo requires a "name" field');
    }
    if (!fields.url) {
      throw new Error('HelmRepo requires a "url" field');
    }
    this.name = fields.name;
    this.url = fields.url;
  }
}

// Same resource-resolution shape as HelmChart's helmChartFromFields, and the
// same reason this takes a plain callback instead of World directly:
// world.ts imports HelmRepo for its `repos` map type, so importing World
// back into this module would be circular.
//
// Shared by the table-form `Given` and the oneline `Given ... named ...
// at ...` step - one implementation, not two.
export function helmRepoFromFields(fields: Record<string, string>, resolveResource: (alias: string) => string | undefined): HelmRepo {
  const resolved = { ...fields };
  if (resolved.url && isResourceReference(resolved.url)) {
    const value = resolveResource(resolved.url);
    if (value === undefined) {
      throw new Error(`No Resource registered as "${resolved.url}"`);
    }
    resolved.url = value;
  }
  return new HelmRepo(resolved);
}

export function helmRepoFromTable(dataTable: DataTable, resolveResource: (alias: string) => string | undefined): HelmRepo {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return helmRepoFromFields(fields, resolveResource);
}
