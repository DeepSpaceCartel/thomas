# Getting started

## Prerequisites

The test harness requires a reachable Kubernetes cluster and these commands:

- Node.js and npm
- `helm`
- `kubectl`
- A configured Kubernetes context with permission to create resources

Cluster scenarios use the dedicated `thomas-helm-test` namespace. They are
real integration tests, so network access to the chart repositories and the
cluster is required.

## Install and run

From the repo root:

```bash
npm install
npm test
```

Useful focused commands are documented in [Development](development.md).

## Cleanup

Scenarios that install releases clean up after themselves. When diagnosing an
interrupted run, inspect the test namespace before starting another run:

```bash
kubectl get all -n thomas-helm-test
helm list -n thomas-helm-test
```
