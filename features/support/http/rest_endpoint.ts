import { DataTable } from '@cucumber/cucumber';
import { Service } from '../k8s/service.js';

const KNOWN_FIELDS = ['service', 'port', 'trust'] as const;

export class RestEndpoint {
  // NOT a string alias like Directory/File/URL/OCIArtifact - a real
  // Service object, for the same reason HelmRelease.chart is: the base URL
  // needs the Service's real .name/.namespace (already known-real via
  // the k8s/discover.ts label-selector mechanism), not a string that's
  // already lost that structure.
  readonly baseUrl: string;
  readonly scheme: 'http' | 'https';
  // The real cert bytes (PEM) to trust for this endpoint's server
  // certificate - https only. Verification stays real (never disabled):
  // a mismatched cert makes the real request throw.
  readonly caCert?: Buffer;

  constructor(fields: Record<string, string>, scheme: 'http' | 'https', service: Service, caCert?: Buffer) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`RestEndpoint has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.port) {
      throw new Error('RestEndpoint requires a "port" field');
    }
    if (!/^\d+$/.test(fields.port)) {
      throw new Error(`RestEndpoint "port" must be a positive integer: "${fields.port}"`);
    }
    if (scheme === 'https' && !caCert) {
      throw new Error('An HTTPS Endpoint requires a "trust" Secret to verify the real certificate against');
    }
    this.scheme = scheme;
    this.caCert = caCert;
    this.baseUrl = `${scheme}://${service.name}.${service.namespace}.svc.cluster.local:${fields.port}`;
  }
}

// Shared by the table-form `Given` and the oneline `Given ... with
// service ... port ...` step - one implementation, not two.
export function restEndpointFromFields(
  fields: Record<string, string>,
  scheme: 'http' | 'https',
  resolveService: (alias: string) => Service | undefined,
  resolveTrustedCert: (alias: string) => Buffer | undefined,
): RestEndpoint {
  if (!fields.service) {
    throw new Error('RestEndpoint requires a "service" field');
  }
  const service = resolveService(fields.service);
  if (!service) {
    throw new Error(`No Service registered as "${fields.service}"`);
  }
  let caCert: Buffer | undefined;
  if (scheme === 'https') {
    if (!fields.trust) {
      throw new Error('An HTTPS Endpoint requires a "trust" field naming a registered Secret to verify against');
    }
    caCert = resolveTrustedCert(fields.trust);
    if (!caCert) {
      throw new Error(`No Secret registered as "${fields.trust}"`);
    }
  }
  return new RestEndpoint(fields, scheme, service, caCert);
}

export function restEndpointFromTable(
  dataTable: DataTable,
  scheme: 'http' | 'https',
  resolveService: (alias: string) => Service | undefined,
  resolveTrustedCert: (alias: string) => Buffer | undefined,
): RestEndpoint {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return restEndpointFromFields(fields, scheme, resolveService, resolveTrustedCert);
}
