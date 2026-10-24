# pstack harness tree

This folder is generated from `pstack/skills`, `pstack/agents`, `pstack/docs/guide`, `pstack/docs/harness`, `pstack/README.md`, `pstack/LICENSE`, `pstack/plugin.json`, and `cursor-team-kit`. Do not edit it by hand.

Cursor uses `pstack/` directly, Claude Code installs `claude-code/`, and Pi loads `pi/` through the repository root `package.json`. The trees leave out the rest of `pstack/`, such as `pstack/automations` and `pstack/assets`. A relative link to a source file that a tree leaves out points at that file on GitHub `main` instead.

After editing those sources, run `node scripts/generate-pstack-harness-trees.mjs` from the repository root and commit the result.
