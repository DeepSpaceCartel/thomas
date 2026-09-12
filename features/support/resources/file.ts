import fs from 'node:fs';
import { dirname } from 'node:path';
import { DataTable } from '@cucumber/cucumber';

const KNOWN_FIELDS = ['path'] as const;

// Named "ChartFile" internally (not "File") to avoid shadowing Node/TS's
// own global File type - the Gherkin-facing step text still says exactly
// "File known as ...".
export class ChartFile {
  readonly path: string;

  constructor(fields: Record<string, string>) {
    for (const key of Object.keys(fields)) {
      if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`File has no field "${key}" (known fields: ${KNOWN_FIELDS.join(', ')})`);
      }
    }
    if (!fields.path) {
      throw new Error('File requires a "path" field');
    }
    if (!fs.existsSync(fields.path) || !fs.statSync(fields.path).isFile()) {
      throw new Error(`File does not exist: "${fields.path}"`);
    }
    this.path = fields.path;
  }
}

export function chartFileFromTable(dataTable: DataTable): ChartFile {
  const fields = Object.fromEntries(dataTable.hashes().map(({ PROPERTY, VALUE }) => [PROPERTY, VALUE]));
  return new ChartFile(fields);
}

// Real mkdir -p of the parent + a real write, then constructs same as any
// other File. The counterpart to Directory's createDirectory - for a
// scenario that needs a real file with known content on disk (a settings
// file, a generated trust-store config) rather than one that already
// exists in the repo.
export function createFile(path: string, content: string): ChartFile {
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, content);
  return new ChartFile({ path });
}
