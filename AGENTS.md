# AGENTS.md

## Quality gate

- `yarn qg`
  Runs the full quality gate:
  - `yarn check`
  - `yarn test`
  - `yarn build`

- `yarn check`
  Runs the non-test quality checks:
  - `yarn format`
  - `yarn lint`
  - `yarn ast-grep`
  - `yarn typecheck`
  - `yarn knip`

- `yarn fix`
  Runs all available auto-fixes:
  - `yarn ast-grep:fix`
  - `yarn lint:fix`
  - `yarn format:fix`

- `yarn clean`
  Runs workspace clean scripts through `turbo` and removes root task state.

## Task runner

- This repository uses `turbo` as the monorepo task runner.
- `yarn build`, `yarn test`, and `yarn clean` are wired through `turbo`.

## Package scripts

- Publishable packages and shared examples usually expose `build`, `typecheck`, `test`, and `clean`.
- `build` is package-local. The root `yarn build` runs workspace builds through `turbo`.
- Root `yarn typecheck` uses `tsc -b` across the referenced project graph. Package-local `typecheck` scripts still use `tsc --noEmit`.
- Package `clean` scripts remove generated outputs such as `dist`, `.tsbuild`, and `*.tsbuildinfo`.

## ast-grep

- All rules use `language: TSX` so they target both .ts and .tsx
- Use `yarn ast-grep:fix` to apply rewrites. It retries until the result settles and fails if it cannot converge.
- After fixes, re-run `yarn ast-grep` until no problems found.
- Do not edit rules unless user told so.
