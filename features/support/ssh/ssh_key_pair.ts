import fs from 'node:fs';
import { DataTable } from '@cucumber/cucumber';
import { isResourceReference } from '../resources/resource_reference.js';

const KNOWN_FIELDS = ['directory'] as const;

// Deliberately no "privateKeyPath"/"publicKeyPath" fields - the real
// files a `ssh-keygen` call produces depend on whatever `-f`/`-t` the
// generation table asked for (see ssh_key_pair.step.ts), so this class
// only knows the directory a keypair lives in; a scenario reads the
// real files back through `File`/`resolveResource` the same way any
// other generated fixture does.
export class SshKeyPair {
  readonly directory: string;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`SshKeyPair has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.directory) {
      throw new Error('SshKeyPair requires a "directory" field');
    }
    if (!fs.existsSync(fields.directory) || !fs.statSync(fields.directory).isDirectory()) {
      throw new Error(`SshKeyPair directory does not exist: "${fields.directory}"`);
    }
    this.directory = fields.directory;
  }
}

export function sshKeyPairFromFields(fields: Record<string, string>, resolveResource: (alias: string) => string | undefined): SshKeyPair {
  const resolved = { ...fields };
  if (resolved.directory && isResourceReference(resolved.directory)) {
    const value = resolveResource(resolved.directory);
    if (value === undefined) {
      throw new Error(`No Resource registered as "${resolved.directory}"`);
    }
    resolved.directory = value;
  }
  return new SshKeyPair(resolved);
}

export function sshKeyPairFromTable(dataTable: DataTable, resolveResource: (alias: string) => string | undefined): SshKeyPair {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return sshKeyPairFromFields(fields, resolveResource);
}
