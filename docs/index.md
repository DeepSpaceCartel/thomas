---
hide:
  navigation:
---

# Thomas

`Thomas` is a real (no mocks) BDD harness for Kubernetes-native applications.
It uses Cucumber and TypeScript to run `helm`, `kubectl`, and `curl`
without mocks.

The harness is designed around readable scenarios and observable behavior:
construct an object, perform an explicit action, then assert on the real
command or response.

## Why this exists

Reviewing and maintaining a codebase an AI agent wrote or extended has
a real, specific problem ordinary code review doesn't: a confident
commit message or PR description ("added X, verified it works") is
just a claim, and a human reviewer can't tell from the diff alone
whether "verified" meant "ran once locally" or "asserted against
mocked responses that happen to match what the code returns." Neither
tells you what happens against the real thing.

A `.feature` file sidesteps that problem structurally, not by asking
for more trust: every step shells out to a real `helm`/`kubectl`/HTTP
call against a real cluster, so a passing scenario isn't a claim to
take on faith — it's independently re-runnable, human-readable
evidence that a specific real behavior actually happened, at a
specific point in time, checkable by anyone (including the next agent)
without re-deriving it from the implementation. That's what makes this
pattern worth adopting specifically *because* an agent is doing the
work: the review question stops being "do I trust this changed?" and
becomes "does this scenario, which I can read in plain English and
re-run myself, actually prove what it claims to?"

## Quick Start

Say you just built a chart and want to prove it actually works end to
end — not just that `helm install` exits zero, but that Kubernetes
reports it healthy and a real HTTP request against it succeeds. Here's
the whole loop, using this repo's own `charts/test-nginx` as a stand-in for
your chart. This is the complete, real, passing
`features/quickstart.feature` — nothing here is trimmed or simplified
for the docs:

```gherkin
Feature: Deploy and Test a Service
  As a full-stack developer
  I want to deploy a service and check that it is working
  So that I can see a complete service deployment and verification flow

  # Deploys into "dev", not thomas-helm-test - see docs/project/ci.md
  # for why that excludes this scenario from the narrowly-scoped real
  # CI run.
  @requires-broad-rbac
  Scenario: Deploy a chart from a folder, verify it in k8s, then check it over REST
    Given Helm Chart "<NginxHelmChart>" in "./charts/test-nginx"
    And Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "nginx-release" in "dev"
    When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
    Then the command succeeds
    When I get status of Helm Release "<NginxRelease>" as YAML
    Then Helm Release "<NginxRelease>" is "deployed"

    Given Deployment "<NginxDeployment>"
    And "<NginxDeployment>" namespace is "dev"
    And "<NginxDeployment>" label "app.kubernetes.io/instance" is "nginx-release"
    When I get Deployment "<NginxDeployment>" as JSON
    Then Deployment "<NginxDeployment>" has "status.readyReplicas" >= 1

    Given Service "<NginxService>"
    And "<NginxService>" namespace is "dev"
    And "<NginxService>" label "app.kubernetes.io/instance" is "nginx-release"
    When I get Service "<NginxService>" as JSON
    Then Service "<NginxService>" has "spec.type" == ClusterIP
    And HTTP Endpoint "<NginxApi>" on "<NginxService>" port "80"
    When I send a GET request to Endpoint known as "<NginxApi>" path "/"
    Then the response status is 200

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains uninstalled
```

`"dev"` here is a stand-in for whatever namespace is real for *your*
project — this scenario deploys and cleans up a real, disposable
`nginx-release` in it, same as it would for your own chart. (The rest of
this repo's own suite targets its own dedicated `thomas-helm-test`
namespace instead — a project-specific convention, not a requirement;
once you [install Thomas into your own project](concepts/installing.md),
point the namespace/release fields at whatever's real for you.) See
[BDD conventions](concepts/bdd-conventions.md) for the full "define,
then act" pattern behind every step above, and
[Helm](reference/HELM.md)/[Kubernetes](reference/KUBECTL.md)/[REST](reference/REST.md)
for the complete reference each one belongs to.

!!! info "`.feature` file is a verified record, not just a test"

    Because every step here shells out to something real, a passing
    scenario isn't just "the test suite is green" — it's proof that a
    specific real behavior was actually observed, on a real cluster, at a
    real point in time. That makes `.feature` files worth reading as
    documentation in their own right, not just as CI plumbing: the file
    above **is** the complete, current spec of "what does deploying this
    chart and checking it actually look like," kept honest by the fact that
    it has to keep passing for real.

    This matters most for an AI agent working in this repo. A commit
    message or PR description claiming "added X and verified it works" is
    just a claim — the `.feature` file the agent wrote (or extended) *is*
    the verification, and it's checkable by anyone, including the next
    agent, without having to trust the claim. Treat writing the scenario as
    part of building the feature, not a separate step to remember afterward.

## What it covers

<div class="grid cards" markdown>

-   :material-anchor:{ .lg .middle } **Helm**

    ---

    Charts, repositories, releases, and dependencies — real `helm`
    invocations, never mocked.

    [:octicons-arrow-right-24: Helm reference](reference/HELM.md)

-   :material-kubernetes:{ .lg .middle } **Kubernetes**

    ---

    Deployment/Service/Pod discovery by real labels, and polling for
    eventually consistent cluster state.

    [:octicons-arrow-right-24: Kubernetes reference](reference/KUBECTL.md)

-   :material-api:{ .lg .middle } **REST**

    ---

    Real HTTP requests: authentication, uploads, downloads, and JSON
    APIs against a deployed app.

    [:octicons-arrow-right-24: REST reference](reference/REST.md)

</div>
