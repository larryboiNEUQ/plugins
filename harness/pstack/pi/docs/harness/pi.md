# pstack in Pi

Read this file before following a generated Pi skill. Its Pi instructions override Cursor names in the original text. Keep the original workflow, review requirements, approval gates, and output contracts.

This edition targets Pi with the Tintinweb `@tintinweb/pi-subagents` extension. Pi alone does not provide that extension's `Agent` tool. Other subagent extensions are not interchangeable with it.

`<pstack>` is the generated `harness/pstack/pi` directory. The generated skills and guide retain upstream wording. Apply the mappings below rather than treating a Cursor command, path, or model slug as a Pi capability.

## Where the rules come from

| Source | Rules in this edition | What another user needs |
| --- | --- | --- |
| Pi | Explicit `/skill:<name>` commands, skill names and discovery, session entries, and local package skill resources. | Pi with compatible skill loading. No extra runner is implied. |
| Tintinweb extension | `Agent`, the three agent definitions, per-call model and thinking fields, background results, steering, nested-agent permissions, and native worktrees. | The named extension with these capabilities. Check its actual tool schema. |
| This pstack edition | Role-table format, root-main inheritance and fallback, explicit invocation without persistent mode, privacy checks, and reporting unavailable features. | These are package policies, not guarantees enforced by Pi. |
| Current installation choices | Prefixed packaged `tdd` and `teach`, shared skill directories, mixed per-role thinking, model providers, quota priorities, and Mermaid-first visuals. | Keep or change these explicitly. They are not requirements of Pi. |
| Optional installed extensions and skills | Inline skill expansion, `ask_user_question`, pi-goal, ego-browser, and writing-for-agents. | Use them only when available and appropriate. Report absence instead of installing replacements. |
| Operating system | Linux measurement commands and possible macOS alternatives. | Check the command on the current machine. A dated observation is not a platform guarantee. |
| Unsupported Cursor features | Cursor cloud execution, Automations, Benny, make-bot-ui, a built-in PR tool, persistent mode, and timed `/loop` wakes. | Report the unavailable step and any dependent result. Do not simulate success. |

The example model table and subscription profile under `config/examples/current-installation/` preserve the reference installation's choices. They are not live model availability or remaining-quota measurements. Generation does not install them or change an existing user table.

## Generate and load

Run `node scripts/generate-pstack-harness-trees.mjs` from the repository root. Run the same command with `--check` to detect stale generated files without writing.

The generated package declares its skills for Pi and its three agents for Tintinweb through `pi.subagents`. Install from the repository root, `pi install git:github.com/larryboiNEUQ/plugins` or `pi install /path/to/plugins` for a local checkout, so the whole generated tree stays together. Tintinweb registers the agents only when the package is installed through Pi settings packages and `packageAgents` allows it. A local agent file with the same name in the Pi agent directory, `.agents/agents/`, or `.pi/agents/` overrides a package agent, and a user or project skill with the same name overrides a package skill, so remove or rename an older copy before relying on this edition, after asking. Linking each generated skill folder on its own breaks the relative mapping path.

Keep the complete generated directory together so its mapping reference, guide, licenses, and local links stay available. Do not install both the original pstack skills and this edition under the same names.

## Invoke skills and resolve names

- Use `/skill:poteto-mode <task>` explicitly. The main conversation runs the selected playbook. This package supplies no persistent mode, automatic per-turn reminder, or root-chat background routing.
- Map an upstream `/name` instruction to `/skill:<name>`. When following a sibling skill yourself, read its local `SKILL.md`. Resolve relative paths from the skill's directory.
- `disable-model-invocation` hides automatic discovery. It does not make a skill unavailable to explicit invocation or file reads.
- Inline `$<name>` expansion depends on the user's installed inline-skill extension. It is not provided by this package.
- Within pstack workflows, the upstream `tdd` and `teach` skills mean the packaged `pstack-tdd` and `pstack-teach`. This includes the bug-fix playbook's reference to the **tdd** skill. Use `/skill:pstack-tdd` and `/skill:pstack-teach` when directing the user.
- A user's explicit `/skill:tdd` or `/skill:teach` still means their separate external skill. Do not replace, recreate, or overwrite it. This naming policy preserves the reference installation's Matt Pocock skills. It is not a Pi naming requirement.
- `pstack-teach` uses the existing how and why roles. It does not introduce another model role.
- `todolist` means a checklist with the selected playbook's steps. If a todo tool is absent, maintain it in the conversation. Keep skipped steps with reasons.

## Map tools and subagent fields

The rows in this section require Tintinweb. Check the installed schema before use. A missing field is a capability gap, not permission to pass an invented parameter.

| Cursor instruction | Pi with Tintinweb |
| --- | --- |
| `Task` | `Agent` |
| `generalPurpose`, `readonly: true` | `subagent_type: "pstack-readonly"` |
| `generalPurpose`, `readonly: false` | `subagent_type: "poteto-agent"` with inherited extension tools |
| `poteto-agent` | `subagent_type: "poteto-agent"` |
| `comment-sicko` | `subagent_type: "comment-sicko"` |
| `run_in_background: true` | `run_in_background: true` for top-level delegates |
| `resume` | Resume a completed agent by its returned ID only when costly local state is needed. Otherwise start fresh. |
| Interrupt a running agent | `steer_subagent` with its `agent_id` and the new message |
| Retrieve complete output | `get_subagent_result` with `agent_id` and `verbose: true` |
| `environment: "cloud"` | Local execution with `isolation: "worktree"` for concurrent writers |
| `environment: "local"` | Omit the Cursor-only field. |
| `cloud_base_branch` | Prepare the intended local base and name its commit in the brief. |
| `file_attachments` | Give local file paths in the brief unless the installed schema supports attachments. |
| `AskQuestion` | Optional `ask_user_question`. Otherwise ask the same question in plain text. |
| `Grep`, `Glob` | Use the host's read and search tools. Tool names depend on the host. |
| Run another pstack skill | Read `<pstack>/skills/<name>/SKILL.md`, applying the packaged tdd and teach aliases above. |

Pass a description, a self-contained task, the absolute path to the generated `poteto-mode/SKILL.md`, and the resolved model and thinking. Do not pass Cursor-only `readonly` or `environment` fields.

Start a fresh agent for new work, retries, and fix rounds. Reuse a completed agent only for costly state that is still inside it, such as a checkout, uncommitted work, or a running process. Do not resume a running agent. Steer it.

Top-level delegates can run in the background. Continue independent work, then retrieve their complete results. When no independent work remains, wait with `get_subagent_result` rather than polling. A completion preview is not the full evidence.

Tintinweb ties nested agents to their parent's lifetime. Keep nested delegates in the foreground and finish them before returning. Respect the installed depth limit and the generated agents' `allowed_subagents`. The read-only agent has no delegation tools. Its shell policy is an instruction, not an operating-system sandbox.

For concurrent writers, use the extension's native `isolation: "worktree"`. Commit the needed inputs first because a new worktree cannot see uncommitted changes. Preserve branch and commit references for review. If native isolation is disabled, report the gap before starting writers. Do not disguise a manually created worktree as native isolation.

## Select models and thinking

The Cursor `pstack-models.mdc` rule maps to the user-owned `~/.pi/agent/pstack/models.md`. Read it explicitly before the first role-based delegation. Pi does not automatically apply Cursor `.mdc` rules. The role catalog is `<pstack>/config/roles.json`.

Each line is `<full role label>: <provider/model>:<thinking>`, or a comma-separated list of model values. Match the full role label because a role label itself can contain commas. Split only the final thinking suffix from a model value. Pass `model: "provider/model"` and `thinking: "level"` separately.

- Preserve an existing table's exact provider/model identities, per-role thinking, panel lists, `auto`, and `inherit-parent`.
- A missing table, missing role, `auto`, or `inherit-parent` uses the root main conversation model in this edition. Do not apply the personal example table automatically.
- At the root, omit `model` for inheritance. Record the known exact root-main provider/model and thinking in every delegate's brief. Inside a nested delegate, pass that recorded root-main identity explicitly. If it is unknown, return model selection to the root rather than inheriting the immediate delegate's model by accident.
- Validate explicit model identities against the authenticated list from `pi --list-models`. Do not guess from Cursor's `claude-*`, `grok-*`, or `gpt-*` slugs. Do not append or remove `-fast`.
- Treat `max` to `xhigh` as this edition's compatibility choice when the host does not accept `max`. Adjust the separate thinking field only when supported and requested. Do not change a provider/model identity to adjust effort.
- Inspect returned effective model and thinking. A silent substitution is not a successful configured-model run. If effective values are unavailable, say so rather than claiming they matched.
- Start one agent per panel list entry. Choose cross-judges from a different model family than root-main when possible. Family means the model family, not its provider. Disclose reduced independence when a distinct family is unavailable.
- The role catalog includes adapter roles for recall slices, automate-me slices, verification source wave, and comment sicko. A coordinator remains on the main conversation model.

The reference installation uses Sol for much implementation and judgment, SWE for small mechanical blocks, and other families for some review seats. Those allocations and their mixed thinking levels are personal choices preserved only in the example. Without an accepted table, report that inherited seats may not provide model diversity.

## Handle model failures

1. Preserve the requested model, effective model if known, original error, and useful partial output.
2. For startup, authentication, version-gate, quota, rate-limit, availability, or effective-model mismatch failures, retry that seat once using root-main. Report the cause accurately. Ask the user about authentication or permission problems. Do not update providers or configuration as a workaround.
3. Start a fresh agent. At the root, omit its model. In a delegate, pass recorded root-main explicitly. Return the retry to the root when its identity is missing.
4. Report the requested and fallback models, cause, effective thinking if known, and any lost panel diversity. If the retry fails, mark the seat incomplete.

This overrides upstream same-family, closest-slug, and Sonnet fallback instructions. It does not edit the user's model table. Do not invent transport-retry counts or unseen provider errors.

## Run setup-pstack

Follow the original setup skill with these replacements. This section replaces its Cursor model detection, default-table, budget, and write steps. Keep its applicable optional verification offers.

1. Read `<pstack>/config/roles.json` and the existing `~/.pi/agent/pstack/models.md` and `subscriptions.md`, if present. Preserve their current choices. The labeled example is an optional starting point only if the user explicitly chooses it.
2. Run `pi --list-models`. A failed command stops the write. Cached examples and fuzzy names do not prove current availability.
3. Propose the whole role table. With no accepted choices, use root-main inheritance and explain reduced panel diversity. Preserve mixed thinking. Ask for a uniform budget only when the user requests one. Map unlimited to `xhigh` when `max` is unsupported, large to `xhigh`, medium to `high`, and small to `medium`, without changing model identities. Show any compatibility mapping.
4. Show current and proposed values, role purposes, reasons, unavailable identities, removed roles, thinking, and panel diversity. A subscription or quota change requests a proposal, not an immediate write. Prefer quota-based reallocation only when requested.
5. Ask the user to accept the table, edit rows, or cancel. Use an available question tool or plain text. A request for a smoke test is not approval to write.
6. Refresh the model list before writing. Validate exact identities, role labels, panel entries, and supported thinking values against the accepted proposal. Reject unavailable values and unresolved `max`. Never write Cursor slugs.
7. Back up every existing file that will change. Stage and reread the accepted contents beside the destination before replacement. Preserve backups on failure and report partial state. Write only the approved model table and subscription changes.
8. Report the effective table, backups, inherited roles, any requested uniform budget, compatibility choices, and reduced diversity. Re-running setup preserves user choices rather than resetting them to the example.

Setup does not edit Pi settings, authentication, installed extensions, or agent definitions. Agent definitions contain no fixed model or thinking.

## Map paths and inspect sessions

| Cursor path or instruction | Pi path or policy |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | Use the current host's configured skill directories. The reference installation uses shared `.agents/skills/`. Ask before changing shared user resources. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Use the caller's absolute generated skill path. The generated Pi package descriptor declares skills, not a Cursor plugin installation. |
| `.cursor/rules/`, always-applied rules | Use the current host's supported instructions. Do not assume Pi reads `.mdc`. Read the separate model table explicitly. |
| `agent-transcripts`, `~/.cursor/projects/` | Use only the identified Pi session and approved workspace scope below. |
| Upstream GitHub links to packaged files | Read the local generated copy first. Give the user a URL only when a link is needed. |

Use the explicitly identified current session path first. Pi supports custom agent and session directories, so the default path is not universal.

The default workspace session directory is `~/.pi/agent/sessions/--<encoded-cwd>--/`. Resolve cwd to an absolute path, remove its first slash, replace `/`, `\`, and `:` with `-`, and wrap it in `--`. List files only in that approved workspace directory.

Read each session header and verify its cwd. Order candidates by modification time, not UUID. The latest file is not proof that it is this conversation. A subagent session is not the parent session.

Pi JSONL contains typed entries. For conversation messages, inspect entries with `type: "message"` and their `message.role` and `message.content`. Text, thinking, tool calls, tool results, and custom notifications differ. Preserve roles, tool names, arguments, timestamps, and results when auditing actions.

Recall uses only the approved workspace and time range. Reflect and show-me-your-work use only the identified run. If its path is unavailable, ask or report incomplete. Do not search unrelated private sessions.

For correct, use commits, reverts, review comments, and instruction files in the named repository. Edit its instruction file only after task-specific approval. An unidentified session is not permission to mine transcripts.

## Optional capabilities and current visual policy

- `pi-goal` can supply `/goal` with an explicit stop condition. It is an optional extension, not a timer or a substitute for `/loop 1h`.
- `ask_user_question` is optional. Respect its advertised question and option limits. Plain text is the fallback.
- ego-browser is the reference installation's preferred browser. If it is installed and selected for this task, read its skill. Other Pi installations can use their available browser tooling.
- Use the packaged control-ui for Electron or IDE tasks and control-cli for CLI or TUI tasks. Check actual capabilities before claiming coverage.
- Cursor's built-in create-skill maps to the installed writing-for-agents skill when available. Otherwise use the host's available skill-authoring workflow and report the missing built-in. This does not supply proprietary evaluation or description-tuning tools.
- Newly authored verification skills belong in a directory the current host discovers. The reference installation uses `.agents/skills/`. Global changes need explicit approval.
- In the reference installation's visual policy, pstack-teach uses Mermaid unless the user requests raster output. Ketchup uses Mermaid or existing captures and stays read-only. Do not start an app or image-generation job just because upstream mentions a whiteboard or visualize skill. This is a conservative package policy, not a Pi limitation.

## Cursor-only features and forge operations

Report unsupported steps with a reason and name any dependent result that remains unavailable. Never convert missing infrastructure into a passing test.

Cursor cloud agents, Automations, Benny, webhooks, make-bot-ui, persistent mode, per-turn reminders, timed `/loop`, and background routing of the root conversation are not implemented here. Do not install a competing runner or scheduler.

The upstream plan template and check-plan helper remain unchanged. Their literal `/loop 1h` marker is a structural check, not proof that a timer exists or fired. Report timed continuation as unsupported even when that checker passes.

Pi provides no built-in PR tool through this package. Check authentication and repository scope, then use the resolved forge command, normally `gh`. Use Origin only if it is installed and can resolve the repository. Keep authorization gates for pushes, publication, external messages, destructive changes, and merges.

Bugbot comments are review evidence to assess, not proof that Bugbot can be started or configured on this host.

## Measurement tools

Check command availability on the current machine. Linux instructions in benchmark-checklist do not establish macOS support.

On macOS, `sysctl -n hw.ncpu` can replace a missing `nproc` for a core count. An available `top` can show per-process CPU when `pidstat` is absent, but its output is not equivalent.

Do not claim `dtruss` is a verified replacement for `strace -c`. It may need privileges. Report an unavailable syscall-count check. Do not assume `py-spy` or `perf` is installed. For Node profiling, confirm `node --cpu-prof` in the installed Node's help before using it.

## Authority and evidence

Generation writes only the generated repository tree. It does not install skills or agents, change user configuration, check credentials, or call a model.

Preserve the operator's current authorization limits. Reversible local work does not grant permission to alter shared settings, publish, send external messages, delete data, deploy, or merge.

Do not dump environment values or inspect credential files to identify a model or debug a provider. Obtain effective identity from host result records. Do not print tokens, keys, cookies, or authorization headers.

Offline loading and queued skill expansion prove loading and expansion only. They do not prove Tintinweb calls, effective models, worktree isolation, browser operation, panel independence, or autonomous continuation. Record remote CI as not run unless its actual result is available.
