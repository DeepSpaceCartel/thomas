import fs from 'node:fs';
import { DataTable } from '@cucumber/cucumber';
import { isResourceReference } from '../resources/resource_reference.js';

const KNOWN_FIELDS = ['directory'] as const;

// Same shape as SelfSignedCa - fixed real file names (tls-key.pem/
// tls-cert.pem) so the alias is re-discoverable from just the
// directory, the CA that signed it isn't part of this object's own
// identity (a scenario references the CA separately, at generation time).
export class TlsCertificate {
  readonly directory: string;
  readonly keyPath: string;
  readonly certPath: string;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`TlsCertificate has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.directory) {
      throw new Error('TlsCertificate requires a "directory" field');
    }
    if (!fs.existsSync(fields.directory) || !fs.statSync(fields.directory).isDirectory()) {
      throw new Error(`TlsCertificate directory does not exist: "${fields.directory}"`);
    }
    this.directory = fields.directory;
    this.keyPath = `${fields.directory}/tls-key.pem`;
    this.certPath = `${fields.directory}/tls-cert.pem`;
  }
}

export function tlsCertificateFromFields(fields: Record<string, string>, resolveResource: (alias: string) => string | undefined): TlsCertificate {
  const resolved = { ...fields };
  if (resolved.directory && isResourceReference(resolved.directory)) {
    const value = resolveResource(resolved.directory);
    if (value === undefined) {
      throw new Error(`No Resource registered as "${resolved.directory}"`);
    }
    resolved.directory = value;
  }
  return new TlsCertificate(resolved);
}

export function tlsCertificateFromTable(dataTable: DataTable, resolveResource: (alias: string) => string | undefined): TlsCertificate {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return tlsCertificateFromFields(fields, resolveResource);
}
