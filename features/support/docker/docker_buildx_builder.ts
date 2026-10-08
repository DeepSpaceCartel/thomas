import { DataTable } from '@cucumber/cucumber';
import { isResourceReference } from '../resources/resource_reference.js';

const KNOWN_FIELDS = ['name', 'endpoint'] as const;

export class DockerBuildxBuilder {
  // The real `docker buildx create --name <name>` builder name - distinct
  // from the World alias this object itself is known as (e.g.
  // "<RemoteBuilder>"), same distinction HelmRepo draws between its real
  // `name` and its own World alias.
  readonly name: string;
  // A `tcp://host:port` (or any driver-specific) endpoint string. No live
  // check at construction - same reasoning as RestEndpoint: there's no
  // cheap read-only probe for "is a remote buildkitd reachable" that isn't
  // itself the real action this object exists to perform.
  readonly endpoint: string;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`DockerBuildxBuilder has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.name) {
      throw new Error('DockerBuildxBuilder requires a "name" field');
    }
    if (!fields.endpoint) {
      throw new Error('DockerBuildxBuilder requires an "endpoint" field');
    }
    this.name = fields.name;
    this.endpoint = fields.endpoint;
  }
}

// Same resource-resolution shape as HelmRepo's helmRepoFromFields - "endpoint"
// may be written as an "<Alias>" pointing at a captured value instead of a
// literal, e.g. a URL resource holding a real remote BuildKit address.
export function dockerBuildxBuilderFromFields(fields: Record<string, string>, resolveResource: (alias: string) => string | undefined): DockerBuildxBuilder {
  const resolved = { ...fields };
  if (resolved.endpoint && isResourceReference(resolved.endpoint)) {
    const value = resolveResource(resolved.endpoint);
    if (value === undefined) {
      throw new Error(`No Resource registered as "${resolved.endpoint}"`);
    }
    resolved.endpoint = value;
  }
  return new DockerBuildxBuilder(resolved);
}

export function dockerBuildxBuilderFromTable(dataTable: DataTable, resolveResource: (alias: string) => string | undefined): DockerBuildxBuilder {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return dockerBuildxBuilderFromFields(fields, resolveResource);
}
