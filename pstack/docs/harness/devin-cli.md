# pstack in Devin CLI

Read this adapter before following a generated Devin skill. It overrides Cursor-specific names and host behavior, not higher-priority host instructions or the operator's approval gates.

This edition targets local Devin CLI. `<pstack>` is the installed `harness/devin/pstack` plugin root. Official skill and agent prose stays upstream. The generated tree sits outside `harness/pstack` because the official CC generator rewrites that entire directory.

## Generate and install

Run `node scripts/generate-devin-harness.mjs` from the repository root. Add `--check` to detect stale output without writing.

Install the complete generated plugin, not individual skill symlinks:

```sh
devin plugins install --local 'larryboiNEUQ/plugins#harness/devin/pstack'
devin plugins update pstack
```

`--local` keeps installation on this machine rather than adding it to the user's personal cloud plugin manifest. Local-folder development uses `devin plugins install --local /absolute/path/to/harness/devin/pstack`. Ask before changing an existing installation.

This package installs no always-on `AGENTS.md`, hooks, MCP servers, model defaults, or subscription profile. Installing the plugin does not configure model routing.

## Invoke and resolve skills

| Cursor instruction | Devin CLI |
| --- | --- |
| Run another pstack skill, `/name`, or "the **name** skill" | Read `<pstack>/skills/<name>/SKILL.md` and follow it. The user command is `/pstack:<name>`. |
| `/poteto-mode` | `/pstack:poteto-mode`, inline in the main conversation. |
| `/setup-pstack` | `/pstack:setup-pstack`, with the replacements below. |
| `disable-model-invocation: true` | Native `triggers: [user]`. Reach dependent skills by reading their local files. |
| `icon`, `color`, and skill `paths` frontmatter | Omit these unsupported header fields. The TypeScript skill remains explicitly invoked and routed by the upstream workflow. |
| `todolist` | Use the available todo tool, or maintain a checklist in the conversation. |
| `AskQuestion` | Use `ask_user_question` if offered, respecting its actual schema; plain text is the fallback. |

Devin adds the `pstack:` namespace to skills and plugin agents. Keep original skill folder names; do not add Pi's `pstack-` prefix. Unscoped user skills such as tdd and teach remain independent. Markdown links resolve relative to the containing file. Put the actual absolute poteto-mode skill path in every delegated pstack brief.

## Map delegation

| Cursor instruction | Devin CLI |
| --- | --- |
| `Task` | Use native `run_subagent` with the selected configured profile, title, task, and supported lifecycle fields. |
| `generalPurpose`, `readonly: false`, `poteto-agent` | Use the selected family's full-tool profile and supply `<pstack>/agents/poteto-agent.md` when the upstream workflow requires that agent. |
| `generalPurpose`, `readonly: true` | Use the selected family's read-only profile. It has read, grep, and glob only. |
| `comment-sicko` | Use the selected family's read-only profile with `<pstack>/agents/comment-sicko.md` and the root-provided scoped diff. |
| `run_in_background: true` | `is_background: true` only when needed tools are already approved; otherwise use the foreground. |
| `resume` | Use the actual resume field only when supported and appropriate. Native resumed agents run in the foreground. |
| `file_attachments` | Put absolute approved file paths in the task. |
| `environment: "local"` | Omit the field. |
| `environment: "cloud"`, `cloud_base_branch` | No per-call cloud or isolation field exists on this tool. Report the gap instead of passing either field. |

Pass the absolute selected skill path, adapter path, scoped task, and any required agent-definition path. The local profile reads current plugin files, so an upstream prompt update does not require copying new prose into personal profiles.

Background agents cannot ask for new tool approvals. A denial is not permission to broaden permissions or switch to dangerous mode. Read results with `read_subagent`; use native completion notifications rather than polling.

Personal profiles do not enable nested spawning. Return nested work to the root unless a separately approved native `max-nesting` policy exists. There is no native worktree-isolation parameter here. Serialize writers until a scoped worktree procedure has been independently verified.

## Select the two models

The Cursor `pstack-models.mdc` rule maps to the user-owned `~/.config/devin/pstack/models.md`. On Windows use the corresponding Devin user config directory under `%APPDATA%`. A customized config location needs explicit path resolution before writing.

The file has two lines:

```text
grok: <exact Devin model UID>
opus: <exact Devin model UID>
```

Read upstream role assignments from the current skills or setup-pstack text. Map each `grok-*` default to grok and each `claude-opus-*` default to opus. Preserve panel length and order, including repeated seats. There is no copied role registry.

Devin's model UID includes its reasoning variant. Setup selects the exact variant for each family. That variant is an explicit family-wide effort choice; it does not automatically reproduce every upstream effort suffix. There is no separate per-call model or thinking field on `run_subagent`. Never invent one, or rewrite the configured UID to simulate Cursor's `-fast` choice.

Native profiles materialize the mapping:

| Family | Full tools | Read-only tools |
| --- | --- | --- |
| grok | `pstack-grok` | `pstack-grok-readonly` |
| opus | `pstack-opus` | `pstack-opus-readonly` |

Before the first routed call, check that the profile's model matches the accepted table and that it is available in `devin models list --format json`. Missing or inconsistent mappings, unknown families such as an unmapped `gpt-*` or non-Opus `claude-*`, and unavailable models stop routed delegation. Report the gap and offer setup; do not silently use the router, a built-in profile, or the main model.

An unmapped `auto` or `inherit-parent` request has no exact-profile mapping in this edition. Report it before delegating. A custom profile without model uses Devin's subagent router, not necessarily the parent model. The plugin's two upstream-derived agent definitions are prompt sources, not a substitute for the configured model profiles.

## Keep Fusion as the parent

An explicit pstack task using an accepted two-model mapping requests the corresponding native profiles for its delegated seats. Keep the root's Fusion selection unchanged. A mapped seat is not interchangeable with Fusion's persistent execution partner.

Respect the actual host policy and the operator's authorization for native subagents. If the host disallows a requested spawn, report the blocked seat; this adapter cannot grant higher-priority permission. Never claim an independent multi-model panel ran when it did not.

An isolated local test on Devin 3000.11.205 ran two explicit model profiles under a Fusion parent. Host `generation_model` metadata matched the two selected model UIDs. This establishes that route, not all future versions, nested routing, background permissions, or backend model identity beyond the host's records.

Report effective model metadata when the host exposes it. If it is absent, say unknown. A worker's self-description is not model evidence. On a model failure, preserve the error and partial work, mark the seat incomplete, and ask before choosing a replacement. Do not rewrite personal settings or guess quota.

## Run setup-pstack

This replaces upstream model detection, role-table, reasoning-budget, and write steps. Keep applicable optional verification-skill offers. Setup is an agent workflow, as in the CC and Pi adapters.

1. Read the existing user-owned model table and the four profiles, if present. Leave subscription files, authentication, the selected Fusion model, and the global default subagent model untouched.
2. Run `devin models list --format json`. Ask which exact UID maps to Grok and which maps to Opus. Explain the effort in each UID. Existing choices remain current until a replacement is approved.
3. Propose the complete two-line table and the four profile files under `~/.config/devin/agents/`. Their names and filenames match the table above. A full-tool profile has only name, description, and model frontmatter. A read-only profile additionally has `allowed-tools: [read, grep, glob]`. Include no `max-nesting`, hooks, or permission grants.
4. Use the body from `<pstack>/docs/harness/devin-cli/profile-body.md` verbatim in all four files. The description identifies its family and whether it is read-only. Every profile's model is exactly its family's accepted UID. Keep upstream prompts out of these files.
5. Show every changed or removed row/file, both effective model variants, profile tool access, and panel diversity. Ask to accept, edit, or cancel. Invocation of setup alone is not approval to overwrite existing files. Equal model selections reduce independence and must be disclosed.
6. Refresh the model list before writing. Reject unavailable UIDs, unresolved aliases, and conflicting existing profile names. Back up every existing destination before replacement. Stage and reread accepted contents, then replace only the approved table and profiles.
7. Run `devin doctor --json` to check profile parsing. Report partial writes on failure and preserve backups. Report exactly which files changed and that profile changes require a fresh session. Do not install a plugin or change user config as an incidental setup step.

## Cursor-only features, paths, and sessions

| Cursor path or feature | Devin policy |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Use this installed native plugin and the caller's absolute skill path. Never search Cursor caches for the Devin edition. |
| `.cursor/rules/`, always-applied rules | Use native project/user rules only when explicitly requested. The model table is read separately; this plugin installs no always-on rule. |
| `agent-transcripts`, `~/.cursor/projects/` | Use the exact identified Devin session or approved ATIF export. Never scan unrelated sessions. |
| Upstream links to files shipped here | Read the current local generated file first. Keep public URLs for the user when needed. |
| Cursor cloud agents, Automations, webhooks, Benny, make-bot-ui, timed `/loop` | Unsupported. Report the skipped step and any unavailable dependent result. Do not launch Devin Cloud or add a scheduler as a substitute. |
| Built-in PR tool and Bugbot | Use an available approved forge tool such as gh. Assess existing review comments as evidence; do not claim to start unavailable checks. |

OS-specific measurement commands remain capability checks, not guaranteed replacements. Read-only profiles cannot run shell history commands; the root gathers approved git history and diffs before delegation. Optional browser or visual skills are used only when actually installed and authorized.

Generation and offline checks do not call models, modify personal settings, or establish live behavior. Native plugin registration, explicit-profile routing, read-only enforcement, permission flow, and update behavior each need their own recorded check. Preserve the current authorization scope and never print credentials or environment secrets.
