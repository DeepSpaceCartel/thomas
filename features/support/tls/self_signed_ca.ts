import fs from 'node:fs';
import { DataTable } from '@cucumber/cucumber';
import { isResourceReference } from '../resources/resource_reference.js';

const KNOWN_FIELDS = ['directory'] as const;

// Same shape as SshKeyPair - only the directory is a construction field;
// the real ca-key.pem/ca-cert.pem file names are fixed by the generating
// step (they're what make this alias findable again afterward), not
// something a scenario chooses.
export class SelfSignedCa {
  readonly directory: string;
  readonly keyPath: string;
  readonly certPath: string;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`SelfSignedCa has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.directory) {
      throw new Error('SelfSignedCa requires a "directory" field');
    }
    if (!fs.existsSync(fields.directory) || !fs.statSync(fields.directory).isDirectory()) {
      throw new Error(`SelfSignedCa directory does not exist: "${fields.directory}"`);
    }
    this.directory = fields.directory;
    this.keyPath = `${fields.directory}/ca-key.pem`;
    this.certPath = `${fields.directory}/ca-cert.pem`;
  }
}

export function selfSignedCaFromFields(fields: Record<string, string>, resolveResource: (alias: string) => string | undefined): SelfSignedCa {
  const resolved = { ...fields };
  if (resolved.directory && isResourceReference(resolved.directory)) {
    const value = resolveResource(resolved.directory);
    if (value === undefined) {
      throw new Error(`No Resource registered as "${resolved.directory}"`);
    }
    resolved.directory = value;
  }
  return new SelfSignedCa(resolved);
}

export function selfSignedCaFromTable(dataTable: DataTable, resolveResource: (alias: string) => string | undefined): SelfSignedCa {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return selfSignedCaFromFields(fields, resolveResource);
}
