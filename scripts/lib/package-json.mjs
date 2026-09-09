import { readFileSync, writeFileSync } from 'node:fs';

const VERSION_LINE_RE = /("version"\s*:\s*")([^"]+)(")/;

export function readVersion(path) {
  const text = readFileSync(path, 'utf8');
  const match = VERSION_LINE_RE.exec(text);
  if (!match) {
    throw new Error(`Could not find a "version" field in ${path}`);
  }
  return match[2];
}

// Regex-replaces only the "version" line rather than JSON.parse +
// JSON.stringify, which would reformat/reorder the whole file and
// produce a noisy diff for a one-line change.
export function writeVersion(path, newVersion) {
  const text = readFileSync(path, 'utf8');
  if (!VERSION_LINE_RE.test(text)) {
    throw new Error(`Could not find a "version" field in ${path}`);
  }
  const updated = text.replace(VERSION_LINE_RE, `$1${newVersion}$3`);
  writeFileSync(path, updated);
}
