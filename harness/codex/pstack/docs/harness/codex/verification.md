# Codex harness verification snapshot

Date: 2026-11-13. Upstream pstack: 0.15.36. Reference Codex CLI: 0.167.1. This is a dated observation, not a promise of future host or account capabilities.

## Native loader

A fresh `codex app-server --stdio` process completed initialize and `plugin/read` against this checkout's `.agents/plugins/marketplace.json`, selecting `pluginName: "pstack"`.

Observed result:

```text
marketplaceName: larry-plugins-codex
plugin.id: pstack@larry-plugins-codex
plugin.localVersion: 0.15.36
plugin.source: harness/codex/pstack
skills: 58
installed: false
```

The test did not install a plugin or replace the user's enabled edition. This establishes native parsing and skill enumeration, not the complete desktop installation flow.

## Generated skill execution

A fresh `codex exec --ephemeral --sandbox read-only` invocation requested `gpt-6.1-sol` with `model_reasoning_effort="low"`, and was given the generated `in-your-own-words/SKILL.md` as its task. Command events recorded successful reads of that generated skill and its package-local `docs/harness/codex.md`, followed by a correct restatement of adding Codex while preserving Pi and Claude Code. The process exited successfully.

The user's pre-existing global pstack entry was also present and read its personal model file; this was not a clean-home installation test. The generated package-local adapter read was independently visible in the command events. No setup writes, installation, delegated work, credential reads, or application edits were requested. Model evidence is the requested invocation, not an independently attested server-side identity.

## Earlier local adapter checks

Before packaging, real collaboration calls using gpt-6.1-sol, gpt-6-astra, and gpt-6.1-terra at high completed. They covered the poteto-agent instruction load, the simple how explainer path, and an independent configuration review. Those runs used the user-level predecessor adapter, so they are not represented as full generated-package workflow tests.

## Reproduce offline gates

```sh
node scripts/generate-codex-harness.mjs --check
node --test scripts/generate-codex-harness.test.mjs
node scripts/generate-pi-harness.mjs --check
node --test scripts/generate-pi-harness.test.mjs
node scripts/generate-pstack-harness-trees.mjs --check
node scripts/check-pstack-docs.mjs
npm ci --prefix scripts/pi-sdk --ignore-scripts
PI_HARNESS_SDK="$PWD/scripts/pi-sdk/node_modules/@earendil-works/pi-coding-agent/dist/index.js" node --test scripts/pi-harness-sdk.test.mjs
```

The Codex generator suite passed 34 tests, including the source/output symlink and YAML-key regressions added after independent review. The authored diff passes whitespace checks; generated copies retain upstream trailing spaces and the automate-me trailing blank line to preserve source content.

Regression tests cover body preservation, adapter injection, metadata checks, links, executable modes, drift without writes, and separation from successful CC/Pi generation. The existing Pi generator suite passed 20 tests and its real SDK loader/expansion suite passed 9 tests after installing the locked SDK dependencies with lifecycle scripts disabled. Authenticated model calls are not part of public CI. Use GitHub's actual run status for remote CI; a local pass is not evidence of a remote pass.

## Not established

No claim is made here for full arena/interrogate/reflect/swarm/no-comments playbooks, native custom-agent registration, cloud isolation, Cursor automations, timed continuation, history migration, every reasoning level, or all Codex client tool schemas. Personal model setup remains an agent workflow with a concrete user review; no installer migrates existing settings automatically.

Raw account-bound process logs remain local rather than being published with the plugin.
