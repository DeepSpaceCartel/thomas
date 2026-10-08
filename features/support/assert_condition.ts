import { defineParameterType } from '@cucumber/cucumber';
import { getCurrentLogPath } from './command_log.js';

// Every condition name this file understands - shared by the error message
// below and the {condition} Cucumber parameter type (used by the oneline
// condition steps in common.step.ts). Sorted longest-first when building
// the regexp so a prefix condition (e.g. "gt") can never shadow a longer
// one that starts the same way (e.g. "gte") - same shape as httpMethod's
// custom parameter type in support/http/http_method.ts.
export const CONDITIONS = ['equals', 'contains', 'icontains', 'undefined', 'exists', 'not_equals', 'gt', 'gte', 'lt', 'lte'] as const;

// Symbol/plain-English spellings for the numeric/equality conditions -
// real aliases, not a second vocabulary: normalized to their word form at
// the top of check() below, so a table CONDITION cell and the oneline
// {condition} parameter both accept any spelling of the same real check,
// everywhere, for free. Word forms keep working unchanged. "is not" (a
// two-word alias) works with zero extra logic because of the longest-
// first sort below - confirmed directly against the real
// @cucumber/cucumber-expressions matcher, not assumed: "is not" (6 chars)
// is tried before "is" (2 chars), so it matches as one token instead of
// leaking a stray " not" into the following {word}.
const CONDITION_ALIASES: Record<string, (typeof CONDITIONS)[number]> = {
  '>=': 'gte',
  '<=': 'lte',
  '==': 'equals',
  '!=': 'not_equals',
  '>': 'gt',
  '<': 'lt',
  '=': 'equals',
  'is not': 'not_equals',
  is: 'equals',
};

defineParameterType({
  name: 'condition',
  regexp: new RegExp([...CONDITIONS, ...Object.keys(CONDITION_ALIASES)].sort((a, b) => b.length - a.length).join('|')),
  transformer: (s: string) => s,
});

// The only two conditions that genuinely ignore `expected` (see check()
// below) - the real, narrow set a value-less oneline is allowed to
// accept. Normalizes through the same real alias map first, so `is`
// (not just `equals`) is correctly rejected here too.
const VALUE_LESS_CONDITIONS = new Set(['exists', 'undefined']);

export function requiresValue(rawCondition: string): boolean {
  const condition = CONDITION_ALIASES[rawCondition] ?? rawCondition;
  return !VALUE_LESS_CONDITIONS.has(condition);
}

interface CheckResult {
  pass: boolean;
  reason: string;
}

function check(actual: unknown, rawCondition: string, expected: string): CheckResult {
  const condition = CONDITION_ALIASES[rawCondition] ?? rawCondition;
  const actualString = String(actual);
  switch (condition) {
    case 'undefined':
      return actual === undefined
        ? { pass: true, reason: '' }
        : { pass: false, reason: `expected field to be undefined, got "${actualString}"` };
    case 'exists':
      return actual !== undefined
        ? { pass: true, reason: '' }
        : { pass: false, reason: 'expected field to exist, but it was undefined' };
    case 'equals':
      return actualString === expected
        ? { pass: true, reason: '' }
        : { pass: false, reason: `expected "${expected}", got "${actualString}"` };
    case 'contains':
      return actualString.includes(expected)
        ? { pass: true, reason: '' }
        : { pass: false, reason: `expected "${actualString}" to contain "${expected}"` };
    case 'icontains':
      return actualString.toLowerCase().includes(expected.toLowerCase())
        ? { pass: true, reason: '' }
        : { pass: false, reason: `expected "${actualString}" to contain "${expected}" (case-insensitive)` };
    case 'not_equals':
      return actualString !== expected
        ? { pass: true, reason: '' }
        : { pass: false, reason: `expected value to not equal "${expected}", but it did` };
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return checkNumeric(actualString, condition, expected);
    default:
      return {
        pass: false,
        reason: `unknown condition "${rawCondition}" (known conditions: ${CONDITIONS.join(', ')}, or symbols: ${Object.keys(CONDITION_ALIASES).join(', ')})`,
      };
  }
}

// The one family of conditions that compares numbers, not strings - every
// other condition in this file does plain string comparison. Both sides
// go through Number() (not parseFloat/parseInt) so a non-numeric value
// (e.g. a status.phase string) fails loudly with a clear reason instead
// of silently comparing NaNs (which are never equal, so a naive numeric
// comparison would just always report "not pass" with no explanation).
function checkNumeric(actualString: string, condition: 'gt' | 'gte' | 'lt' | 'lte', expected: string): CheckResult {
  const actualNum = Number(actualString);
  const expectedNum = Number(expected);
  if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) {
    return { pass: false, reason: `"${condition}" needs numeric values, got actual="${actualString}" expected="${expected}"` };
  }
  const pass =
    condition === 'gt' ? actualNum > expectedNum : condition === 'gte' ? actualNum >= expectedNum : condition === 'lt' ? actualNum < expectedNum : actualNum <= expectedNum;
  return pass ? { pass: true, reason: '' } : { pass: false, reason: `expected ${actualNum} ${condition} ${expectedNum}, was not` };
}

// "not_equals" is the one condition where an array check must be universal
// (every element must satisfy it - none may equal the forbidden value)
// rather than existential (at least one matches) - it's a negation, so the
// quantifier has to flip too.
const UNIVERSAL_CONDITIONS = new Set(['not_equals']);

// The boolean-only half of condition-checking, shared by assertCondition
// (below, which throws with a detailed message) and the polling mechanism
// in support/poll.ts (which needs a plain true/false every tick, not an
// exception) - one implementation of "does this actually hold", not two.
export function conditionHolds(actual: unknown, condition: string, expected: string): boolean {
  if (Array.isArray(actual)) {
    const results = actual.map((value) => check(value, condition, expected));
    return UNIVERSAL_CONDITIONS.has(condition) ? results.every((r) => r.pass) : results.some((r) => r.pass);
  }
  return check(actual, condition, expected).pass;
}

// Builds its own message rather than relying on node:assert's automatic
// actual/expected diff rendering, which doesn't identify which table row
// (KEY) failed and can end up showing an unhelpful boolean diff instead of
// the values actually being compared. When `actual` is an array (a
// JMESPath wildcard projection like "[*].name"), the check is existential
// - it passes if *any* element matches - but a failure still lists why
// *every* element failed, never collapsing to a bare true/false.
export function assertCondition(key: string, actual: unknown, condition: string, expected: string, source: Record<string, unknown>): void {
  const fail = (reason: string) => {
    const logPath = getCurrentLogPath();
    const logLine = logPath ? `\nFull log: ${logPath}` : '';
    throw new Error(`${reason}\n${formatAvailableFields(source)}${logLine}`);
  };

  if (Array.isArray(actual)) {
    const results = actual.map((value) => check(value, condition, expected));
    const universal = UNIVERSAL_CONDITIONS.has(condition);
    const overallPass = universal ? results.every((r) => r.pass) : results.some((r) => r.pass);
    if (!overallPass) {
      const relevant = universal ? results.filter((r) => !r.pass) : results;
      const verb = universal ? 'at least one element violated' : 'no element satisfied';
      const detail = relevant.length === 0 ? '  (the list was empty)' : relevant.map((r) => `  - ${r.reason}`).join('\n');
      fail(`"${key}": ${verb} "${condition} ${expected}" (checked ${results.length}):\n${detail}`);
    }
    return;
  }

  const result = check(actual, condition, expected);
  if (!result.pass) {
    fail(`"${key}": ${result.reason}`);
  }
}

const MAX_VALUE_LENGTH = 80;

function formatAvailableFields(source: Record<string, unknown>): string {
  const lines = Object.entries(source).map(([k, v]) => {
    let rendered = typeof v === 'string' ? v : JSON.stringify(v);
    if (rendered.length > MAX_VALUE_LENGTH) {
      rendered = `${rendered.slice(0, MAX_VALUE_LENGTH)}...`;
    }
    return `  ${k}: ${rendered}`;
  });
  return `Available fields:\n${lines.join('\n')}`;
}
