# Installing Thomas in another project

Thomas's step implementations are plain TypeScript, loaded directly by
`tsx`'s ESM loader — there is no compiled `dist/` build to consume.
That means a consuming project can point its own `cucumber.mjs` at the
installed package's `.ts` sources the same way Thomas points at its
own.

## Install

This package is not published to a registry yet — install it as a git
dependency:

```bash
npm install github:DeepSpaceCartel/thomas
```

## Wire up your own `cucumber.mjs`

```js
import { register } from 'tsx/esm/api';
register();

export default {
  import: [
    'node_modules/thomas/features/support/**/*.ts',
    'node_modules/thomas/features/step_definitions/**/*.ts',
    'features/step_definitions/**/*.ts', // your own project-specific steps
  ],
  paths: ['features/**/*.feature'],
};
```

Your project needs `@cucumber/cucumber` and `tsx` installed directly
(Thomas declares both as `peerDependencies`, not bundled
dependencies, so your project's own versions are what actually run).

## Using only some of the steps

The `exports` map lets you cherry-pick a single domain instead of
importing everything — for example, a project that only needs the Helm
steps:

```js
export default {
  import: [
    'node_modules/thomas/features/support/helm/**/*.ts',
    'node_modules/thomas/features/support/resources/**/*.ts', // Directory/File/URL/OCI Artifact - see docs/reference/RESOURCES.md
    'node_modules/thomas/features/support/{assert_condition,query,run_command,attempt,world}.ts',
    'node_modules/thomas/features/step_definitions/{directory,helm,helm-repo,helm-release,common}.step.ts',
  ],
  paths: ['features/**/*.feature'],
};
```

## Pointing steps at your own resources

Every alias's `PROPERTY` rows are just data — point `Directory`/`File`
paths, `HelmRelease.namespace`, and `Deployment`/`Service`/`Pod` label
selectors at your own project's charts and cluster namespace. Nothing
in the step implementations hardcodes Thomas's own `charts/` fixtures
or the `thomas-helm-test` namespace; those only appear in Thomas's
own `.feature` files.

See [BDD conventions](../concepts/bdd-conventions.md) and the per-tool
references ([Helm](../reference/HELM.md),
[Kubernetes](../reference/KUBECTL.md), [REST](../reference/REST.md))
for what's available once wired up.
