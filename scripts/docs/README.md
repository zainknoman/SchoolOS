# Documentation generators (BL-66)

Reproducible, dependency-free generators for the generated docs. Inputs are read only from the repository.

| Command (from `backend/`) | Direct | What it does |
|---|---|---|
| `npm run docs:generate` | `node scripts/docs/generate.mjs` | regenerates `ENDPOINTS`, `DATA-DICTIONARY`, `ERD` (whole files) and the marked generated blocks in `MIGRATIONS`, `DATA-MODEL`, `TEST-MATRIX` |
| `npm run docs:check` | `node scripts/docs/generate.mjs --check` | exits 1 if any generated doc drifted (runs in CI) |
| `npm run docs:test` | `node --test scripts/docs/lib.test.mjs` | unit tests for the parsers, incl. the method-level `@Roles` regression fixture |

- `domains.json` groups models into domains for the dictionary and ERD; the generator fails when a model is missing from it — add new models there.
- Executed test counts (as opposed to grep counts of `it/test` blocks) are recorded by hand in `docs/testing/TESTING-STRATEGY.md` after running the suites.
- Verified reproduction (2026-09-20): DATA-DICTIONARY and ERD regenerate byte-identical to the previously hand-verified docs; ENDPOINTS reproduces all 185 handlers.
