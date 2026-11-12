# pstack in Codex

Read this file before following a generated Codex skill or agent. It translates Cursor instructions into the capabilities actually exposed by the current Codex session. Keep the upstream workflow, evidence requirements, task scope, and output contracts. This is an instruction adapter, not a new execution engine or a native custom-agent registration.

`<pstack>` is the installed generated `harness/codex/pstack` package. The source is `pstack/docs/harness/codex.md`. Every generated skill links here, so loading this edition does not require a global AGENTS.md patch. Do not read the Claude Code or Pi adapter as instructions for Codex.

## Generate, install, and invoke

Run `node scripts/generate-codex-harness.mjs` from the repository root and commit the result. `--check` detects stale output without writing. The Codex tree lives outside `harness/pstack`, which the upstream Claude Code generator owns and rewrites.

The repo's `.agents/plugins/marketplace.json` exposes this edition as `pstack@larry-plugins-codex`. Add the fork using `codex plugin marketplace add larryboiNEUQ/plugins`, then install pstack from that marketplace in the plugin UI. For local development, add the checkout root instead. Use the current client's supported installation flow, and verify the installed skill paths point into this edition. The existing Cursor/Claude marketplace is separate. Avoid enabling two pstack editions with the same skill names at once; changing an existing installation requires the user's authorization.

Keep the whole package together: skill references, agent prompts, guide pages, licenses, and this adapter use relative paths. Invoke the pstack skill exposed by the host's skill picker. For nested calls, read the named local SKILL.md; do not invent a slash-command execution API. Resolve the current installed path from the skills catalog, not a pinned cache version. Upstream `icon`, `color`, `paths`, and other host metadata are retained as source metadata, not promises of Codex UI or automatic invocation behavior.

See the [OpenAI plugin packaging documentation](https://developers.openai.com/plugins/build/plugins) for portable `plugin.json`, the `.codex-plugin/plugin.json` compatibility format, and repo marketplace discovery. Generating this tree does not install it or change personal configuration.

## Tools and subagent fields

The reference runtime exposes `collaboration`. Other Codex surfaces can expose different schemas. Inspect the actual tools before dispatch; do not assume every Codex CLI or app has these exact fields. If a host cannot preserve a required model, effort, or delegation contract, report that capability gap instead of silently running a different workflow.

| Cursor instruction | Codex mapping |
| --- | --- |
| `Task` | `collaboration.spawn_agent` in the reference runtime. |
| `generalPurpose` | Ordinary Codex subagent with an explicit task boundary. |
| `poteto-agent` | Ordinary subagent instructed to read `<pstack>/agents/poteto-agent.md` and the supplied absolute poteto-mode SKILL.md. The parent runs the playbook. |
| `comment-sicko` | Ordinary subagent instructed to read `<pstack>/agents/comment-sicko.md`; retain its scoped comment-review contract. |
| `readonly: true` | Explicitly prohibit writes in the brief and inspect the relevant working-tree diff afterward. This does not add an OS sandbox or remove MCP tools. |
| `readonly: false` | Use actual host permissions and task authorization; it does not grant new write access. |
| `environment: "cloud"` | Local execution only. Prepare separate worktrees for concurrent writers when needed, or assign disjoint files. Neither supplies a separate cloud machine. |
| `environment: "local"` | Omit the unsupported field. |
| `cloud_base_branch` | Prepare the intended local base and pass its branch and commit; uncommitted inputs do not appear in a new worktree. |
| `run_in_background: true` | Omit; collaboration spawns are asynchronous. Continue independent work, then collect results. |
| `resume` | Prefer a fresh agent for new work and fixes. Use `followup_task` only when an idle agent holds costly state needed by the continuation. |
| Steering and results | `send_message` for running-agent steering, `wait_agent` and delivered reports for completion. Respect the host's wait limits. |
| `file_attachments` | Supply absolute paths in the task unless actual attachment support is exposed. |
| `AskQuestion` | The available user-input tool, or the same question in normal chat. Respect tool option limits. |
| `todolist` | Available planning tool, otherwise a Markdown checklist. Preserve skipped steps with reasons. |
| `Read`, `Write`, `Shell`, `Grep`, `Glob` | Current file, patch, shell, and search tools. Prefer `rg` for text and file searches. |
| Run another pstack skill | Read `<pstack>/skills/<name>/SKILL.md` and apply this adapter. |

For a model or effort override in the reference runtime use `fork_turns: "none"`. Full-history forks cannot accept these overrides. Each brief must therefore include the goal, necessary context, scope, file ownership, expected evidence, this adapter's absolute path, the user model-table path if used, and relevant skill/agent paths. Load referenced instructions before doing the task. Do not pass Cursor-only fields or assume a named Markdown agent has been registered as a native Codex agent type.

Respect the actual concurrency limit, including the parent. Queue excess panel seats rather than dropping them. Each entry is a separate run even when several entries select the same model. Complete candidates before judging them. Collect nested work before returning; do not assume a child can outlive its parent. Actual tool output and effective-model records, when available, are stronger evidence than a worker's self-description.

## Models and dynamic reasoning

The Cursor `pstack-models.mdc` rule maps to the user-owned `~/.codex/pstack-models.md`. Read it explicitly before role-based delegation. This file is not automatically discovered as a Codex rules directory. A generated skill's adapter supplies the read instruction. The package does not change the main conversation's model or global reasoning effort.

No model ID in a documentation example is universally available. Detect exact IDs and supported effort values from the session's subagent tool schema or a current host model listing. Do not infer availability from a product name, a dated cache, or credentials. Do not inspect authentication files to choose models.

The user table accepts optional `grok: <model>` and `opus: <model>` family mappings plus exact upstream role labels. Exact role overrides take precedence. A line such as `reflect judgment, divergent, synthesizer: <model>` has one label before the colon; its commas are not panel separators. Split only the model values after the colon. Markdown backticks/bullets around existing role entries are acceptable. `auto` and `inherit-parent` mean the immediate parent model, as in upstream; disclose that nested inheritance can differ from the root model.

Resolve a seat in this order:

1. Use the exact role override, preserving panel count and order.
2. Otherwise read that role's current default from the invoked skill or setup-pstack. Map `grok-*` through `grok`, and `claude-opus-*` through `opus`. Do not maintain a second authoritative role catalog. Keep the upstream number of seats even if mappings coincide.
3. With no accepted mapping, use `inherit-parent` and disclose the missing explicit mapping and any lost diversity. A `gpt-*` ID in an upstream source is not automatically entitled either; validate it before use. Setup can establish explicit GPT choices.
4. A configured model that fails or is unavailable is different from a missing mapping: retain the error and ask before substituting another model/provider. Do not silently retry on upstream Grok/Claude defaults or rewrite the user's table.

Model and effort are separate parameters: `model` and `reasoning_effort` in the reference runtime. Never append an effort or `-fast` suffix to a Codex ID. If the host cannot apply per-call effort, report that limitation instead of claiming an adjustment happened.

Preserve upstream poteto-mode's dynamic effort selection:

- A selected budget defines a starting level: `small` -> `medium`, `medium` -> `high`, `large` -> `xhigh`, `unlimited` -> `max`. With no selected budget, use the effort in the current role's upstream default when known, otherwise inherit and report that the starting effort is unknown.
- For each new task, start from its baseline. Raise one step for the hardest or subtlest work, capped at `max`; lower one for ordinary judgment and two or more for mechanical work. Use `low < medium < high < xhigh < max`. Do not carry an earlier task's adjusted effort into a new task. Explicit user instructions take precedence.
- A `medium` budget therefore starts at `high`: ordinary implementation high, hard work xhigh, ordinary judgment medium, mechanical work low. These are examples of applying the upstream rule, not fixed per-role pins. Do not automatically add `ultra` to the upstream ladder.
- Check the chosen model's supported effort values. Select the nearest supported level on the ladder, preferring lower on a tie, and disclose any adjustment. If an adjusted value is rejected, retry once at the supported baseline, not at a string of guessed values. If that also fails, report incomplete and ask before model substitution.
- Verification keeps the configured `swarm workers` model. Do not invent a Codex fast-mode parameter. Effort selection is independent of model identity and speed.

Use actual model families for Arena's cross-judge rule. `sol`, `terra`, and `astra` are all GPT models; different variants are not different families. If the parent and accepted judge pool are GPT-only, skip the cross-family judge as Arena permits and report it. The parent selects the base. An optional same-family independent reviewer must be labelled as such and cannot satisfy that gate. Never fall back to a non-GPT pool against a user's GPT-only choice.

## Run setup-pstack

Follow the original skill's budget choice and role confirmation, with these Codex changes:

1. Read the existing user model table. Preserve accepted choices and unrelated user instructions, including the earlier combined local adapter format. Detect current model/effort support; if no listing is available, ask for supported identities or propose inheritance, never fabricate IDs.
2. Read roles and defaults from the current setup-pstack file. Show every role and panel seat with its proposed model, baseline effort, dynamic-adjustment behavior, inheritance, and unavailable choices. Keep existing explicit role mappings. For an initial setup, offer family mappings or per-role GPT choices; examples are opt-in only. Report retired/removed rows before dropping them.
3. Keep the four budget labels and their starting levels. A request to change the budget changes the baseline, not the dynamic rules. An explicitly requested fixed effort can override dynamic adjustment for that scoped task, but is not the default.
4. Obtain the user's acceptance of the concrete table and changes, reusing an acceptance already given for that exact proposal. Check availability again before writing. Back up the previous file, stage and reread the proposed contents, and replace only the accepted user table. Do not destroy other instructions in a legacy combined file; preserve them or propose an explicit migration.
5. Use a `# budget: medium (high starting level; dynamic)` style header and family/role lines, with no Cursor frontmatter. Store the model ID separately from the baseline policy. Do not write `~/.cursor/rules/pstack-models.mdc`, modify config.toml, credentials, global AGENTS.md, installed agents, or plugin sources as part of setup.
6. Report the table, backup, dynamic behavior, and reduced panel diversity. Keep applicable optional verification-skill offers; do not install project harnesses without a task requiring them.

The [GPT example](codex/models.example.md) records one opt-in mapping, including the three different GPT variants already exercised in a reference session. It is not an entitlement list or an auto-installed default.

## Paths and history

| Cursor path | Codex policy |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | Use current discovered skills or host-supported workspace/user skill directories. Do not mutate shared directories merely to load this package. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | Resolve this generated package from the actual skill path. Use root plugin.json or .codex-plugin/plugin.json. Never search Cursor caches as the agent fallback. |
| `.cursor/rules/`, always-applied rule | Existing host instructions; explicitly read the separate user model table. Codex does not apply `.mdc` here. |
| `agent-transcripts`, `~/.cursor/projects/` | No fixed path translation. Use an identified Codex thread/history source for the authorized workspace and time range only. |
| Upstream links to packaged files | Read the local packaged copy first. Other source links may point at upstream GitHub. |

For recall, reflect, and show-me-your-work, report missing or incomplete history. A latest timestamp does not identify the current thread; subagent sessions are not parent sessions. Do not scan unrelated private sessions to compensate. Cursor Custom Mode persistence is not implemented by these files.

## Cursor-only features and external capabilities

Report unavailable steps and their dependent outputs. A missing proof step remains unverified even if the rest of the workflow proceeds.

- Cursor cloud agents, their dashboard, Automations, Benny, make-bot-ui webhooks, persistent Custom Modes, and timed `/loop` wakes are unsupported. The make-bot-ui skill is retained for source parity but its Cursor-specific execution is unavailable here; do not invoke its external-message steps through this adapter.
- The literal `/loop 1h` in the upstream plan checker is a structural marker, not a working scheduler. A passing check does not prove timed continuation.
- Existing Bugbot comments are ordinary review evidence. Starting or configuring Bugbot is not supplied here.
- A built-in PR tool maps to the available forge integration or CLI, such as gh, subject to task authorization. Installation does not authorize publication, messaging, merging, deployment, or broader permissions.
- This package does not bundle cursor-team-kit control-cli, control-ui, or deslop. It does not install browser tools, project verification harnesses, TLA+, image/video rendering, or platform measurement tools. Resolve available capabilities when needed and report gaps. Follow the user's browser preference.
- Parent model changes, native agent registration, sandbox enforcement, and authentication are host responsibilities. Read-only delegation is a behavioral boundary, not an extra OS sandbox.

## Evidence and maintenance

Generation and offline checks prove file/metadata consistency, not authenticated model execution. A native plugin-read or skill-list result proves loader discovery, not a completed playbook. Record actual subagent call parameters and returned evidence separately; do not claim service-side identity from a worker self-report. Do not publish raw session transcripts or account data as test fixtures.

Re-run generation and regression checks after upstream updates. Keep Codex output outside CC/Pi-owned trees. Validate newly introduced tool concepts instead of silently treating them as supported. Personal models remain outside the generated package and survive regeneration.
