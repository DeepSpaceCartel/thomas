import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Before, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { setCurrentScenario } from './command_log.js';

// Resolved from this file's own real location (features/support/hooks.ts,
// two levels below Thomas's package root), never from the current
// process's cwd - a consuming project's cucumber.mjs imports this file
// wholesale (see docs/concepts/installing.md), and its own cwd is that
// project's root, not Thomas's. A plain relative "charts/test-nginx"
// silently resolved against the *consumer's* cwd instead, and failed
// loudly there ("no such file or directory") the first time anything
// outside Thomas's own repo actually loaded this hook for real.
const THOMAS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// cucumber-js's own default step timeout (5000ms) is far shorter than a
// legitimate real poll used elsewhere in this suite (up to 2m, for the
// bad-image fast-fail scenario in features/k8s/kubernetes-full.feature) - a
// latent bug since the polling mechanism (support/poll.ts) was added,
// which never surfaced because every poll happened to resolve on its
// very first tick (Deployment/Service are already stable via --atomic
// before discovery runs, so the first check always passed immediately).
// The first scenario whose poll genuinely needs multiple real ticks
// before succeeding (features/rest/health-{short,full}.feature's readiness-flip
// scenario, which needs several real seconds for the readiness probe to
// actually fail) hit cucumber-js's own timeout mid-poll, well before
// pollUntil's own internal timeout (an explicit, per-step "for up to
// {string}" value) was ever reached. Raised well past the longest real
// poll timeout anywhere in this suite - pollUntil's own timeout stays
// the real, meaningful bound; this just has to not fire first.
setDefaultTimeout(5 * 60 * 1000);

// Regenerates charts/test-nginx-0.1.0.tgz fresh from charts/test-nginx/
// before every run (real `helm package`, not a stub) - a previous version
// of this file was manually packaged once and never re-synced, so "Local
// Archive Chart" could silently test stale content after any edit to the
// chart source. This makes drift impossible: the archive is always exactly
// what the current source would produce. If Chart.yaml's version ever
// changes, the output filename changes too (helm names it
// <chart>-<version>.tgz) - a scenario referencing the old filename will
// fail loudly instead of silently reading stale content.
// `charts/` isn't in Thomas's own package.json "files" list (it's
// Thomas's internal fixture set, never meant to be distributed) - a
// consuming project installing Thomas as a dependency genuinely has no
// `charts/test-nginx` to repackage, materialized copy or not. A no-op
// here, not an error: this hook exists to keep Thomas's *own* test suite
// honest, and has nothing to regenerate when it isn't that suite.
const TEST_NGINX_CHART = path.join(THOMAS_ROOT, 'charts/test-nginx');
BeforeAll(function () {
  if (!fs.existsSync(TEST_NGINX_CHART)) {
    return;
  }
  execFileSync('helm', ['package', TEST_NGINX_CHART, '-d', path.join(THOMAS_ROOT, 'charts')], { stdio: ['ignore', 'pipe', 'pipe'] });
});

// Routes every real command this scenario runs (via runCommand(), the
// one real choke point every helm/kubectl step goes through) to its
// own log file under test-results/ - see command_log.ts for why a
// counter, not the scenario name, keys the filename.
Before(function (scenario) {
  setCurrentScenario(scenario.pickle.uri, scenario.pickle.name);
});
