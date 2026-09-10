## What this changes

<!-- What does this PR do, and why? -->

## Checklist

- [ ] Added a real entry under `## [Unreleased]` in `CHANGELOG.md` (see the `keepachangelog` skill in [DeepSpaceCartel/skills](https://github.com/DeepSpaceCartel/skills)) — skip only for changes with nothing user-facing to note (typo fixes, internal refactors with no behavior change).
- [ ] If this touches a step definition or table vocabulary: ran the actual `.feature` scenario(s) against a real cluster, not just `cucumber-js --dry-run` — CI only runs `--dry-run` (no cluster access), so this is the one check nobody else does for you.
- [ ] If this adds/changes a step's shape: updated the matching reference doc (`docs/reference/{HELM,KUBECTL,REST,RESOURCES}.md`) and the agent skill catalog (`.agents/skills/thomas/references/`) — both need real `Short`/`Full` examples, not just a mention.
- [ ] `npx tsc --noEmit` and `npx cucumber-js --dry-run` pass locally (same as CI).
- [ ] If this touches `docs/`: `mkdocs build --strict` passes locally.

<!--
package.json's version bumps automatically once this PR is opened
against a same-repo branch — no manual version edit needed. See
docs/project/releasing.md if you're curious how that works.
-->
