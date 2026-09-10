import { World } from '../world.js';

// Shared by both helm/chart.step.ts (HelmChart's "chart"/"repo" fields)
// and helm/repo.step.ts (HelmRepo's "url" field) - lives here rather
// than in either step-definition file so neither has to import from
// the other.
export function resolveResource(world: World, alias: string): string | undefined {
  return (
    world.directories.get(alias)?.path ??
    world.files.get(alias)?.path ??
    world.urls.get(alias)?.value ??
    world.ociArtifacts.get(alias)?.ref
  );
}
