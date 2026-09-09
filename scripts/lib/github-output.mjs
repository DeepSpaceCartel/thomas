import { appendFileSync } from 'node:fs';

// Writes `key=value` to $GITHUB_OUTPUT when running in Actions, and
// always echoes it to stdout too so scripts are just as inspectable
// when run locally outside CI.
export function setOutput(key, value) {
  console.log(`${key}=${value}`);
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
}
