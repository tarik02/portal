# AGENTS.md

## Quality gate

- `yarn qg`
  Runs all quality gates defined by `qg` script (slow - prefer individual scripts):
    - `yarn format`
    - `yarn lint`
    - `yarn ast-grep` (without scan!)
    - `yarn typecheck`
    - `yarn test`
    - `yarn build`

## Task runner

- This repository uses `turbo` as the monorepo task runner.
- The `qg` script is wired through `turbo`:

## ast-grep

- All rules use `language: TSX` so they target both .ts and .tsx
- When fixing ast-grep problems - re-run `yarn ast-grep` until no problems found
- Do not edit rules unless user told so.
