import { DataTable } from '@cucumber/cucumber';
import { Service } from '../k8s/service.js';
import { Pod } from '../k8s/pod.js';
import { runCommand } from '../run_command.js';

const KNOWN_FIELDS = ['service', 'pod', 'port', 'trust'] as const;

// A resolved target: exactly one of Service (DNS name) or Pod (real IP,
// looked up live - see RestEndpoint's constructor). Mirrors the two real
// ways a caller can reach a k8s-native app: through its Service (the
// common case, DNS-stable, only ever routes to a Ready backend) or
// straight at a Pod's own IP (bypasses the Service's readiness gate
// entirely - the only way to prove an app's own liveness/readiness
// distinction for real when the Pod is deliberately NotReady).
export type RestEndpointTarget = { kind: 'service'; service: Service } | { kind: 'pod'; pod: Pod };

export class RestEndpoint {
  // NOT a string alias like Directory/File/URL/OCIArtifact - a real
  // Service/Pod object, for the same reason HelmRelease.chart is: the
  // base URL needs the object's real name/namespace (Service) or real IP
  // (Pod), not a string that's already lost that structure.
  readonly baseUrl: string;
  readonly scheme: 'http' | 'https';
  // The real cert bytes (PEM) to trust for this endpoint's server
  // certificate - https only. Verification stays real (never disabled):
  // a mismatched cert makes the real request throw.
  readonly caCert?: Buffer;

  constructor(fields: Record<string, string>, scheme: 'http' | 'https', target: RestEndpointTarget, caCert?: Buffer) {
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
    if (target.kind === 'service') {
      this.baseUrl = `${scheme}://${target.service.name}.${target.service.namespace}.svc.cluster.local:${fields.port}`;
    } else {
      // A real, live lookup at construction time - the same category of
      // real check Secret's own retry-aware Given already does (see
      // k8s/secret.ts). A caller building an endpoint from a Pod is
      // expected to have already confirmed (via a real poll) that the
      // Pod genuinely has an IP - a bare `Given Pod "<X>"` alone doesn't
      // guarantee that, so this throws with a real, specific message
      // rather than silently producing a broken "http://:PORT" URL.
      const result = runCommand('kubectl', ['get', 'pod', target.pod.name, '-n', target.pod.namespace, '-o', 'jsonpath={.status.podIP}']);
      if (result.EXIT_CODE !== '0' || !result.STDOUT) {
        throw new Error(`Pod "${target.pod.name}" in namespace "${target.pod.namespace}" has no real IP yet - poll for it before building an Endpoint on a Pod`);
      }
      this.baseUrl = `${scheme}://${result.STDOUT}:${fields.port}`;
    }
  }
}

// Shared by the table-form `Given` and the oneline `Given ... with
// service ... port ...` step - one implementation, not two.
export function restEndpointFromFields(
  fields: Record<string, string>,
  scheme: 'http' | 'https',
  resolveService: (alias: string) => Service | undefined,
  resolvePod: (alias: string) => Pod | undefined,
  resolveTrustedCert: (alias: string) => Buffer | undefined,
): RestEndpoint {
  if (!fields.service && !fields.pod) {
    throw new Error('RestEndpoint requires either a "service" or a "pod" field');
  }
  if (fields.service && fields.pod) {
    throw new Error('RestEndpoint accepts only one of "service" or "pod", not both');
  }
  let target: RestEndpointTarget;
  if (fields.service) {
    const service = resolveService(fields.service);
    if (!service) {
      throw new Error(`No Service registered as "${fields.service}"`);
    }
    target = { kind: 'service', service };
  } else {
    const pod = resolvePod(fields.pod);
    if (!pod) {
      throw new Error(`No Pod registered as "${fields.pod}"`);
    }
    target = { kind: 'pod', pod };
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
  return new RestEndpoint(fields, scheme, target, caCert);
}

export function restEndpointFromTable(
  dataTable: DataTable,
  scheme: 'http' | 'https',
  resolveService: (alias: string) => Service | undefined,
  resolvePod: (alias: string) => Pod | undefined,
  resolveTrustedCert: (alias: string) => Buffer | undefined,
): RestEndpoint {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return restEndpointFromFields(fields, scheme, resolveService, resolvePod, resolveTrustedCert);
}
