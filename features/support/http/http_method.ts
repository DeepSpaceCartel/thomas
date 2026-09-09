import { defineParameterType } from '@cucumber/cucumber';

// The real, currently-exercised HTTP method set - every endpoint under
// charts/test-rest-api/files/*.py and every "I send a <X> request" call site
// in features/rest/*.feature uses exactly one of these. Registered here
// (rather than added to only http.step.ts) so cucumber.mjs's
// `features/support/**/*.ts` import - which runs before
// `features/step_definitions/**/*.ts` - picks it up automatically; no
// step-definition file needs to import this module directly.
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

defineParameterType({
  name: 'httpMethod',
  regexp: new RegExp(HTTP_METHODS.join('|')),
  transformer: (s: string) => s,
});
