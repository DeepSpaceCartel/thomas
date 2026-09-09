import { DataTable } from '@cucumber/cucumber';
import { discoverByFields, K8sObjectRef } from './discover.js';
import { runCommand } from '../run_command.js';

export type Secret = K8sObjectRef;

// The one real place that turns a registered Secret into decoded
// certificate bytes - shared by the certificate-inspection step
// (kubernetes.step.ts) and HTTPS Endpoint construction (rest_endpoint.ts
// via http.step.ts), so there's exactly one implementation of "kubectl
// get secret + base64-decode tls.crt", not two.
export function fetchCertPem(secret: Secret): Buffer {
  const result = runCommand('kubectl', ['get', 'secret', secret.name, '-n', secret.namespace, '-o', 'json']);
  if (result.EXIT_CODE !== '0') {
    throw new Error(`kubectl get secret failed: ${result.STDERR}`);
  }
  const parsed = JSON.parse(result.STDOUT);
  const certBase64 = parsed?.data?.['tls.crt'];
  if (typeof certBase64 !== 'string') {
    throw new Error(`Secret "${secret.name}" has no "tls.crt" data field - is it a real kubernetes.io/tls Secret?`);
  }
  return Buffer.from(certBase64, 'base64');
}

// Unlike Deployment/Service/ConfigMap - which `helm upgrade --atomic`
// already guarantees exist by the time this runs - a cert-manager Secret
// is created by cert-manager's own controller reacting to a Certificate,
// asynchronously and outside Helm's wait entirely. A short, bounded real
// retry (matching how long a real SelfSigned issuance actually takes,
// verified live at well under this) covers that real gap without adding a
// separate explicit poll step for what's otherwise a plain discovery.
//
// The real retry lives here, against plain fields - not in secretFromTable
// below, which is now just its table-form sugar - so the payload-
// accumulator construction step (`Secret known as {string} using
// {string}`, kubernetes.step.ts) goes through the identical real retry,
// not a bypass of it. Progressive discovery (a different construction
// style entirely) resolves through discoverByFields *directly*, with no
// retry - that's the real reason Secret discovery still can't use
// progressive discovery, unrelated to this function.
export async function secretFromFields(fields: Record<string, string>): Promise<Secret> {
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      return discoverByFields('secret', fields);
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function secretFromTable(dataTable: DataTable): Promise<Secret> {
  return secretFromFields(Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE])));
}
