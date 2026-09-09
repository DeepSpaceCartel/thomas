# CLAUDE.md

Thomas's agent instructions live in **`AGENTS.md`** — read that first,
it's the canonical, tool-agnostic reference (purpose, conventions,
layout, known gotchas, current status). This file only adds notes
specific to Claude Code.

## Claude-Code-specific notes

- This directory was built almost entirely through `/plan` (EnterPlanMode)
  cycles — every non-trivial addition here (a new alias type, a new
  DataTable vocabulary, a new chart) went through a plan the user
  reviewed and often revised before implementation started. Default to
  planning before implementing here, even more than usual — this
  project's design has been repeatedly, deliberately reworked based on
  user review, not gotten right on the first attempt.
- Skills live in `.agents/skills/`. Load the relevant one before working
  in that domain — see `AGENTS.md`'s "Domain skills" section.
- Every `helm`/`kubectl` scenario deploys into and cleans up
  `thomas-helm-test` on a real cluster. Treat this the same as any
  other real, hard-to-reverse action: check `kubectl get all -n
  thomas-helm-test` / `helm list -n thomas-helm-test` before AND
  after significant work, not just at the end — this project's own
  history includes real incidents of overlapping/interrupted test runs
  leaving orphaned releases behind.
