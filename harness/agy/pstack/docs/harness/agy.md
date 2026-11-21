# pstack in Antigravity (AGY)

Read this adapter before following a generated Antigravity (`agy`) skill or agent. It maps Cursor tool names, model routing, file locations, and unsupported features to the capabilities exposed by an Antigravity session. Keep upstream workflow rigor, scope fences, and verification requirements intact.

`<pstack>` refers to the installed `harness/agy/pstack` plugin directory (typically `~/.gemini/config/plugins/pstack` globally or `.agents/plugins/pstack` in a workspace). Source files remain upstream under `pstack/` and `cursor-team-kit/`. The generated tree lives under `harness/agy/pstack`, outside `harness/pstack`, which the upstream Claude Code generator rewrites.

## Generate, validate, and install

Run `node scripts/generate-agy-harness.mjs` from the repository root. Pass `--check` to fail on stale output without writing files.

Validate and install the generated plugin directory as a complete unit:

```sh
agy plugin validate /absolute/path/to/harness/agy/pstack --strict --json
```

Place or install the complete `harness/agy/pstack` directory at `~/.gemini/config/plugins/pstack` (machine-local) or `.agents/plugins/pstack` (workspace-scoped), then confirm discovery with `agy plugin list --json`. Ask before replacing an existing user installation, and back up any prior directory first.

Antigravity automatically namespaces plugin skills as `/pstack:<name>`. Skill folders keep their upstream names without a `pstack-` prefix, avoiding collisions with built-in commands such as `/swarm`. This edition bundles `control-cli`, `control-ui`, and `deslop` from `cursor-team-kit` with `disable-model-invocation: true` so playbooks can load them on demand without inflating casual chat context. It excludes Cursor-only `make-bot-ui`.

This package ships no `rules/AGENTS.md`, hooks, or MCP servers. Installing it never alters `~/.gemini/config/config.json`, `~/.gemini/antigravity-cli/settings.json`, or the main conversation's selected model.

## Invoke skills and map tools

| Cursor instruction | Antigravity (`agy`) mapping |
| --- | --- |
| Run another pstack skill, `/name`, or "the **name** skill" | Read `<pstack>/skills/<name>/SKILL.md` directly and apply this adapter. User slash invocation is `/pstack:<name>`. |
| `/poteto-mode` | `/pstack:poteto-mode` in the current conversation. Never delegate playbook ownership to a subagent. |
| `/setup-pstack` | `/pstack:setup-pstack`, writing the isolated model table described below. |
| `disable-model-invocation` | Supported natively in `SKILL.md` frontmatter. Skills marked `true` stay hidden from automatic model activation while remaining callable via `/pstack:<name>` or direct `read_file`. |
| `icon`, `color`, `paths` | Stripped during generation because AGY skill frontmatter does not use Cursor UI metadata or glob auto-attach fields. |
| `AskQuestion` | Use `ask_question` for structured multiple-choice prompts. Ask trivial yes/no confirmations in plain text. |
| `todolist` | Maintain a checklist in the conversation, or persist a task list artifact in `<appDataDir>/brain/<conversation-id>/` for long multi-step runs. |
| `Task` | Use two-tier delegation below (`invoke_subagent` for single-agent tasks, native `swarm` when cross-family model pins are required). |
| `generalPurpose` | For read-only research (`readonly: true`), use `invoke_subagent` with `TypeName: "research"`. For write-capable general tasks (`readonly: false`), use `TypeName: "self"` (with `poteto-mode` and task files passed explicitly). Built-in `poteto-agent` and `comment-sicko` subagent profiles in AGY omit `write_file`/`edit_file`/`run_command`, so any delegate that must edit files or execute tests maps to `TypeName: "self"` or a `swarm` worker (or a custom agent created with `define_subagent` and `EnableWriteTools: true`). |
| `poteto-agent` | Use `TypeName: "self"` via `invoke_subagent` (or a `swarm` worker) instructed to read `<pstack>/agents/poteto-agent.md` and `<pstack>/skills/poteto-mode/SKILL.md` in full before working whenever the delegate needs to edit files or run tests; reserve built-in `TypeName: "poteto-agent"` only for read-only inspection because built-in subagent profiles in AGY lack write/run tools. Always include the absolute path to `<pstack>/skills/poteto-mode/SKILL.md`. |
| `comment-sicko` | Native `TypeName: "comment-sicko"` via `invoke_subagent` (runs report-only without write or shell tools), or a read-only `swarm` reviewer reading `<pstack>/agents/comment-sicko.md` supplied with the scoped diff or file paths. Note that `comment-sicko` cannot run `git` shell commands when `run_command` is omitted, so pre-supply the commit diff or file contents in the prompt. |
| `readonly: true` | `invoke_subagent(TypeName: "research")` omits file-write tools (`write_file`, `edit_file`) and restricts `run_command` by agent instruction inside the workspace; it is not an OS-blocked filesystem jail when `run_command` runs inside a writable workspace. For `research`, `comment-sicko`, and read-only `swarm` reviewers (`workspace: "inherit"`), always prohibit edits in the brief and verify `git status` or file hashes afterward. |
| `run_in_background: true` | Omit as a parameter. Both `invoke_subagent` and `swarm(action: "add")` run asynchronously in the background and wake the parent conversation reactively when messages arrive. Never poll in a sleep loop. |
| `resume` | Prefer fresh subagents with consolidated context. When continuing stateful work is strictly required, message the existing subagent via `send_message(Recipient: "<conversationId>", Message: "...")` or post to an existing `swarm` worker on the board. |
| `file_attachments` | Pass absolute file paths in the `Prompt` or `brief` so the delegate reads them directly with `read_file`. |
| `environment: "cloud"` | Local execution only. For parallel code writers (`isolation: "worktree"`), pass `Workspace: "share"` on `invoke_subagent` or `workspace: "share"` on `swarm(action: "add")` (or `"branch"` for an isolated clone) when the active parent workspace is a `git` or `hg` repository. If the parent workspace has no VCS root (`share workspace not supported for VCS type Unknown`), create explicit `git worktree add` directories inside the target repo and assign each worker its own worktree path. |
| `cloud_base_branch` | Ensure the intended base commit is committed locally before spawning `share` or `branch` workers, since uncommitted parent edits do not transfer cleanly as a shared base. |

## Two-tier delegation and model routing

Antigravity separates lightweight subagent spawning from exact-slug multi-model orchestration:

1. **`invoke_subagent` (single-family tier routing)**: Accepts `Model` values `"inherit"`, `"flash_lite"`, `"flash"`, or `"pro"`, plus `Workspace` values `"inherit"`, `"share"`, or `"branch"`. It cannot pin an arbitrary cross-vendor model slug. Use `invoke_subagent` when the role resolves to `inherit-parent` / `auto`, when running single-family mechanical or research delegates (`poteto-agent`, `comment-sicko`, `research`, `self`), or when the operator chose single-family execution.
2. **Native `swarm` (exact model-slug routing across families)**: Call `swarm(action: "models", all: true)` (or `agy models` from the CLI) to inspect live entitled slugs and remaining quotas across Gemini (`gemini-*`), Claude (`claude-*`), and GPT-OSS (`gpt-*`) families. Spawn each explicit model seat with `swarm(action: "add", name: "<seat>", model: "<exact-slug>", workspace: "share" | "branch" | "inherit", brief: "...")`. After collecting results and merging or landing verified changes, call `swarm(action: "kill", name: "<seat>")` to clean up temporary `share` or `branch` workspaces.

### Model configuration (`models.md`)

The Cursor `pstack-models.mdc` file maps to `${AGY_PSTACK_CONFIG_DIR:-~/.gemini/config/pstack}/models.md`. When `AGY_PSTACK_CONFIG_DIR` is set in the environment, read and write `<AGY_PSTACK_CONFIG_DIR>/models.md`; otherwise use `~/.gemini/config/pstack/models.md`. Read this file explicitly before role-based delegation.

The file uses plain key-value lines (no `.mdc` frontmatter) with `# defaults: 3` and `# budget:` headers, optional `opus:`, `fable:`, `gemini:`, and legacy `grok:` family shorthands, and exact active role labels from `setup-pstack`:

- Resolve an exact role override first (preserving panel list length and seat order). Note that commas inside a role name before the colon (such as `feature, refactoring:`) belong to that single role key; split commas only on the right-hand model list.
- Otherwise resolve upstream `claude-opus-*` via `opus:`, `claude-fable-*` via `fable:`, `gemini-*` via `gemini:`, and legacy `grok-` / `gpt-` defaults via `grok:`, or fall back to `inherit-parent` while disclosing unmapped defaults and any reduced cross-vendor diversity (note that `claude-opus-*` and `claude-fable-*` share one Claude vendor for Arena's cross-judge check).
- `inherit-parent` and `auto` run on the parent model (`Model: "inherit"` in `invoke_subagent`, or omitting `model` in `swarm`).
- Dynamic effort follows upstream `poteto-mode` (`low < medium < high < xhigh`, capped at `xhigh`; starting from the chosen budget baseline, stepping up one level for the hardest tasks and down for routine or mechanical work). Match the nearest entitled variant slug exposed by `swarm(action: "models", all: true)` within the same family (for example `gemini-4-neon-xhigh`, `gemini-4-neon-high`, `gemini-4-hydrogen-high`, `claude-opus-5-5-high`, `claude-sonnet-5-5-medium`, `gpt-oss-120b-medium`), or pass `--effort` when invoking `agy` CLI sessions. Never invent unentitled slugs or `-fast` suffixes.
- If a configured slug fails at runtime (quota exhausted or unavailable), preserve the exact error, report the incomplete seat, and ask before substituting another family or falling back to `invoke_subagent` on the parent family.

## Run setup-pstack

Follow `/pstack:setup-pstack` with these Antigravity rules:

1. Inspect live entitled models via `swarm(action: "models", all: true)` (preferring it inside an active session; `agy models` is the CLI equivalent). Never read credential files to infer entitlements.
2. Read `${AGY_PSTACK_CONFIG_DIR:-~/.gemini/config/pstack}/models.md` if it exists, preserving valid active role choices, replacing stale legacy defaults per `setup-pstack` step 2 when approved, and dropping retired roles after listing them.
3. Offer the three upstream reasoning budgets (`large`, `medium`, `small`; coercing any legacy `unlimited` to `large`) via `ask_question`, map the 9 active roles (`# defaults: 3`) to verified live AGY model slugs (plus `inherit-parent` / `auto`), and show the full proposed table, any effort clamping (for families whose highest variant is `high`, such as `claude-opus-5-5-high`), and cross-vendor panel diversity.
4. Wait for explicit operator approval before writing. On cancel, write nothing.
5. Re-validate every non-alias slug against the live model list before writing. Back up any existing `models.md` to `models.md.bak`, write to a staged temporary file in the same directory, read back to verify non-empty parseable rows, and atomically rename into `models.md`. Never touch `~/.gemini/config/config.json` or `~/.gemini/antigravity-cli/settings.json`.

## Paths, transcripts, scheduling, and Cursor-only features

| Cursor path or feature | Antigravity (`agy`) policy |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | Use discovered AGY workspace skills (`.agents/skills/`) or global skills (`~/.gemini/config/skills/`). |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Resolve files relative to this installed plugin (`plugin.json` at `<pstack>/plugin.json`). Never search `~/.cursor/plugins/` for AGY skills. |
| `.cursor/rules/`, always-applied rules | Use AGY `GEMINI.md`, `AGENTS.md`, or `.agents/rules/*.md` only when a task explicitly edits project rules. Model routing stays in `models.md`. |
| `agent-transcripts`, `~/.cursor/projects/` | For `/pstack:reflect` and session pickup, read `AGY_PSTACK_TRANSCRIPT_PATH` if explicitly provided, otherwise the current conversation's `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` (reading specific lines of `transcript_full.jsonl` only when `truncated_fields` is set). Never scan unrelated user conversations. |
| Local `/loop` and timed checks | Supported locally via AGY native `schedule` (`DurationSeconds` for one-shot timers, `CronExpression` for recurring checks) paired with `manage_task` to list or cancel active schedules. Never use shell `sleep` loops. |
| Cursor-only features | Cursor Cloud Agents, cloud dashboard URLs, Cursor Automation webhooks (`cursor.com/automations`), Benny, `make-bot-ui`, persistent Cursor Custom Modes, Bugbot triggering, and the built-in PR tool are unsupported here. Use `gh` CLI for authorized PR operations, treat existing Bugbot review comments on GitHub as normal evidence, and explicitly report any skipped cloud or webhook step. |

Offline generation and `agy plugin validate --strict` prove package structure and link integrity, not live model behavior. Keep raw transcripts and user credentials out of git commits and test fixtures.
