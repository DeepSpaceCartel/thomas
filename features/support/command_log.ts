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
// guaranteed unique regardless of any of that - within one process.
// Under cucumber-js's own `--parallel N`, each worker is a separate
// process with its own counter starting back at 0, so two workers would
// otherwise produce and silently clobber the exact same filename; folding
// the real CUCUMBER_WORKER_ID (set by cucumber-js itself under
// --parallel, absent otherwise - "0" either way) into the filename keeps
// it unique across workers too.
const LOG_DIR = 'test-results';
let scenarioCounter = 0;
let currentLogPath: string | null = null;

export function setCurrentScenario(uri: string, name: string): void {
  mkdirSync(LOG_DIR, { recursive: true });
  scenarioCounter += 1;
  const workerId = process.env.CUCUMBER_WORKER_ID ?? '0';
  const flatUri = uri.replace(/\.feature$/, '').replace(/[\\/]/g, '-');
  currentLogPath = path.join(LOG_DIR, `${flatUri}-w${workerId}-${String(scenarioCounter).padStart(3, '0')}.log`);
  appendFileSync(currentLogPath, `Scenario: ${name}\n${uri}\n\n`);
}

// Lets a failure message (assertCondition's `fail`, below in
// assert_condition.ts) point straight at this scenario's own full,
// untruncated log - formatAvailableFields's own 80-char truncation means
// a real failure's STDOUT/STDERR is often cut off in the console; the
// full text is always in this file. Absolute, not relative to whatever
// cwd the assertion happens to run from.
export function getCurrentLogPath(): string | null {
  return currentLogPath ? path.resolve(currentLogPath) : null;
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
