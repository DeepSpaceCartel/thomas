import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { CommandResult } from './run_command.js';

// Every scenario's full, untruncated command output goes in its own
// file - not one shared log. A Scenario Outline expands into several
// pickles that share one title, and unrelated feature files can reuse
// the same scenario name, so a name-based filename could collide and
// silently overwrite another scenario's log. A monotonically
// incrementing counter (not a line number - resolving one out of the
// pickle back through the Gherkin AST isn't worth the complexity) is
// guaranteed unique regardless of any of that.
const LOG_DIR = 'test-results';
let scenarioCounter = 0;
let currentLogPath: string | null = null;

export function setCurrentScenario(uri: string, name: string): void {
  mkdirSync(LOG_DIR, { recursive: true });
  scenarioCounter += 1;
  const flatUri = uri.replace(/\.feature$/, '').replace(/[\\/]/g, '-');
  currentLogPath = path.join(LOG_DIR, `${flatUri}-${String(scenarioCounter).padStart(3, '0')}.log`);
  appendFileSync(currentLogPath, `Scenario: ${name}\n${uri}\n\n`);
}

export function logCommand(command: string, args: string[], result: CommandResult): void {
  if (!currentLogPath) {
    return; // no scenario registered yet (shouldn't happen once hooks.ts wires this up) - never crash a real command over logging
  }
  const entry = [
    `[${new Date().toISOString()}] $ ${command} ${args.join(' ')}`,
    `exit: ${result.EXIT_CODE}`,
    '--- stdout ---',
    result.STDOUT,
    '--- stderr ---',
    result.STDERR,
    '',
    '',
  ].join('\n');
  appendFileSync(currentLogPath, entry);
}
