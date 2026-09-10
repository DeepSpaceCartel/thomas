# Development

Run these commands from the repo root:

```bash
npm test
npm run test:ff
npm run test:verbose
npm run test:usage
npm run test:junit
pip install -r docs/requirements.txt   # once, before docs:serve/docs:build
npm run docs:serve
npm run docs:build
```

`docs/requirements.txt` pins `mkdocs-material>=9.7` — the version floor
where every theme feature and markdown extension used in this site
(navigation instant-loading, content tabs, admonitions, grid cards, ...)
is confirmed free/community, not gated behind a paid tier.

`docs:serve` starts the local MkDocs server with live reload. `docs:build`
uses strict mode so missing navigation entries and documentation warnings fail
the build.

The documentation site is configured in `mkdocs.yml`. Add new pages to the
navigation when they are created — every real page under `docs/` is
currently wired into `nav:`, with no unlisted/escape-hatch content.

The GitHub Actions workflow validates the site on changes. The Pages workflow
publishes the site from pushes to `main`; pull requests only run validation.
