# Thomas

`Thomas` is a real-command BDD harness for Kubernetes-native applications.
It uses Cucumber and TypeScript to exercise Helm, `kubectl`, and HTTP APIs
without mocks.

The harness is designed around readable scenarios and observable behavior:
construct an object, perform an explicit action, then assert on the real
command or response.

## What it covers

<div class="grid cards" markdown>

-   :material-anchor:{ .lg .middle } **Helm**

    ---

    Charts, repositories, releases, and dependencies — real `helm`
    invocations, never mocked.

    [:octicons-arrow-right-24: Helm reference](HELM.md)

-   :material-kubernetes:{ .lg .middle } **Kubernetes**

    ---

    Deployment/Service/Pod discovery by real labels, and polling for
    eventually consistent cluster state.

    [:octicons-arrow-right-24: Kubernetes reference](KUBECTL.md)

-   :material-api:{ .lg .middle } **REST**

    ---

    Real HTTP requests: authentication, uploads, downloads, and JSON
    APIs against a deployed app.

    [:octicons-arrow-right-24: REST reference](REST.md)

</div>

Start with [Getting started](getting-started.md), then read the
[architecture](architecture.md) and [BDD conventions](bdd-conventions.md)
guides. Reusing these step implementations in your own project? See
[Installing Thomas](installing.md).
