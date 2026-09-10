import { spawnSync } from 'node:child_process';
import { DataTable, defineParameterType } from '@cucumber/cucumber';
import { logCommand } from './command_log.js';

// OPTION | VALUE rows to argv: blank OPTION = positional; VALUE === 'True'
// = boolean flag with no value token; VALUE === 'False' = row skipped
// entirely (there's no way to pass "off" for a store-true CLI flag, so
// "False" means "don't include this flag"); anything else = --flag value.
export function buildArgs(table: DataTable): string[] {
  const args: string[] = [];
  for (const { OPTION, VALUE } of table.hashes()) {
    if (VALUE === 'False') {
      continue;
    }
    if (!OPTION) {
      args.push(VALUE);
      continue;
    }
    args.push(OPTION);
    if (VALUE !== 'True') {
      args.push(VALUE);
    }
  }
  return args;
}

// The short-form sibling of buildArgs() above: a raw "--flag value
// --bool-flag" string tokenized straight to argv, honoring double-quoted
// segments for a value containing a space (e.g. --set foo="a b"). A plain
// whitespace split already reproduces exactly what buildArgs() emits from
// a table (a boolean flag -> one bare token; a --flag value row -> two
// adjacent tokens; a blank-OPTION positional row -> one bare token) - this
// isn't a second argv-building implementation, just a terser way to type
// the same shape inline instead of as a table. No new dependency: a small
// hand-rolled tokenizer, same convention as parseDuration/buildArgs
// themselves.
export function tokenizeFlags(raw: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    tokens.push(match[1] !== undefined ? match[1] : match[2]);
  }
  return tokens;
}

defineParameterType({
  name: 'flags',
  regexp: /.+/,
  transformer: (raw: string) => tokenizeFlags(raw),
});

// `--output json`/`--output yaml` and nothing else is by far the single
// most common real `{flags}` payload in this suite - a dedicated `as
// JSON`/`as YAML` shorthand for exactly that case, alongside `with
// {flags}` (still needed for anything with more than just an output
// format). Case-insensitive so `as JSON`/`as json` both work.
export function outputFormatToArgs(format: string): string[] {
  return ['--output', format.toLowerCase()];
}

defineParameterType({
  name: 'outputFormat',
  regexp: /json|yaml|JSON|YAML/,
  transformer: (s: string) => s,
});

export interface CommandResult {
  EXIT_CODE: string;
  STDOUT: string;
  STDERR: string;
}

// spawnSync, not execFileSync: must NOT throw on a nonzero exit code -
// the paired `Then` step asserts the exit code itself. stdio explicitly
// piped (not inherited) - same leak already fixed once for `helm pull`.
export function runCommand(command: string, args: string[]): CommandResult {
  const { stdout, stderr, status } = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const result = {
    EXIT_CODE: String(status ?? ''),
    STDOUT: (stdout ?? '').trim(),
    STDERR: (stderr ?? '').trim(),
  };
  logCommand(command, args, result);
  return result;
}
