#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts", "generate-agy-harness.mjs");

const AGY_NOTICE =
  "In Antigravity (AGY), read [the AGY adapter](../../docs/harness/agy.md) before following this skill. " +
  "It maps Cursor tools, paths, two-tier subagent/swarm delegation, and unsupported features to this host.";
const AGY_README_NOTE =
  "This is the generated native Antigravity (AGY) plugin edition of pstack. " +
  "Use /pstack:poteto-mode and /pstack:setup-pstack. Install the complete directory from harness/agy/pstack " +
  "into ~/.gemini/config/plugins/pstack or .agents/plugins/pstack. Personal model choices live outside the plugin " +
  "in ${AGY_PSTACK_CONFIG_DIR:-~/.gemini/config/pstack}/models.md.";
const AGY_AGENT_NOTE =
  "In Antigravity (AGY), read [the AGY adapter](../docs/harness/agy.md) before following this agent. " +
  "Prefer the caller-supplied absolute path to skills/poteto-mode/SKILL.md when required. " +
  "If omitted, locate it at .agents/plugins/pstack/skills/poteto-mode/SKILL.md or " +
  "~/.gemini/config/plugins/pstack/skills/poteto-mode/SKILL.md rather than ~/.cursor/plugins/. " +
  "The adapter overrides Cursor-specific paths, tools, and model slugs below.";

const AGY_ADAPTER = `# pstack in Antigravity (AGY)

| Cursor instruction | AGY |
| \`Task\` | \`invoke_subagent\` / \`swarm\` |
| \`AskQuestion\` | \`ask_question\` |
| todolist | checklist |
| generalPurpose | research / self |
| comment-sicko | comment-sicko |
| poteto-agent | poteto-agent |
| \`readonly: true\` | research sandbox |
| \`environment: "cloud"\` | local Workspace share |
| cloud_base_branch | committed base |
| \`run_in_background: true\` | async default |
| \`resume\` | send_message |
| \`file_attachments\` | absolute paths |
| claude- | mapped |
| grok- | mapped |
| gpt- | mapped |
| inherit-parent | Model inherit |
| pstack-models.mdc | models.md |
| .cursor/skills/ | .agents/skills/ |
| ~/.cursor/plugins/ | ~/.gemini/config/plugins/ |
| .cursor/rules/ | GEMINI.md / AGENTS.md |
| agent-transcripts | transcript.jsonl |
| Cursor-only features | unsupported |
| disable-model-invocation | preserved |
| \`icon\`, \`color\`, \`paths\` | stripped |
| Run another pstack skill | read SKILL.md |
`;

const CC_ADAPTER = `# pstack in Claude Code

| Cursor instruction | Claude Code |
| \`Task\` | \`Agent\` |
| \`AskQuestion\` | \`AskUserQuestion\` |
| todolist | TodoWrite |
| generalPurpose | subagent_type |
| comment-sicko | subagent_type: "comment-sicko" |
| poteto-agent | subagent_type: "poteto-agent" |
| \`readonly: true\` | read-only |
| \`environment: "cloud"\` | cloud |
| cloud_base_branch | branch |
| \`run_in_background: true\` | background |
| \`resume\` | resume |
| \`file_attachments\` | attachments |
| claude- | mapped |
| grok- | mapped |
| gpt- | mapped |
| inherit-parent | inherit |
| pstack-models.mdc | models |
| .cursor/skills/ | local skills |
| ~/.cursor/plugins/ | plugin |
| .cursor/rules/ | rules |
| agent-transcripts | transcripts |
| Cursor-only features | unsupported |
| disable-model-invocation | model invoke |
| \`icon\`, \`color\`, \`paths\` | header |
| Run another pstack skill | read SKILL.md |
`;

const UPSTREAM_POTETO = `---
name: poteto-agent
description: Upstream delegate.
is_background: true
---

# Poteto Agent

Work scoped tasks on .cursor/projects/agent-transcripts and try grok-9.9-fast when told.
`;

const COMMENT_SICKO = `---
name: comment-sicko
description: A deranged comment-hater that savors deletion.
---

# Comment Sicko

My first output when spawned is exactly this.

Feed me the diff.
`;

const temps = [];
process.once("exit", () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function put(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function sha(root) {
  const map = new Map();
  if (!existsSync(root)) return map;
  const walkLocal = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walkLocal(path) : [path];
    });
  for (const path of walkLocal(root)) {
    const rel = relative(root, path);
    const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
    map.set(rel, `${digest}:${(statSync(path).mode & 0o111) !== 0 ? "x" : "-"}`);
  }
  return map;
}

function generate(root, args = []) {
  return spawnSync(process.execPath, [join(root, "scripts", "generate-agy-harness.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function generateOrFail(root, args = []) {
  const run = generate(root, args);
  assert.equal(run.status, 0, `generation failed: ${run.stdout}${run.stderr}`);
  return run;
}

function read(root, path) {
  return readFileSync(join(root, path), "utf8");
}

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "agy-gen-"));
  temps.push(root);
  mkdirSync(join(root, "scripts"));
  cpSync(SCRIPT, join(root, "scripts", "generate-agy-harness.mjs"));

  put(root, "pstack/plugin.json", JSON.stringify({
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: "pstack",
    version: "9.9.9",
    description: "Fixture pstack description.",
    author: { name: "Lauren Tan" },
    homepage: "https://github.com/cursor/plugins/tree/main/pstack",
    repository: "https://github.com/cursor/plugins",
    license: "MIT",
  }, null, 2) + "\n");
  put(root, "pstack/LICENSE", "MIT fixture license\n");
  put(root, "pstack/assets/logo.png", "PNGDATA\n");
  put(root, "pstack/README.md", "# pstack\n\nSee [the guide](docs/guide/01-start.md) and [a skill](skills/alpha/SKILL.md).\n");
  put(root, "pstack/docs/guide/01-start.md", "# Start\n\nRun [alpha](../../skills/alpha/SKILL.md) and see [README](../../README.md).\n");
  put(root, "pstack/docs/harness/agy.md", options.adapter ?? AGY_ADAPTER);
  put(root, "pstack/agents/comment-sicko.md", COMMENT_SICKO);
  put(root, "pstack/agents/poteto-agent.md", UPSTREAM_POTETO);
  put(root, "pstack/automations/nightly.md", "# Nightly automation\n");

  put(root, "pstack/skills/alpha/SKILL.md", `---
name: alpha
description: Fixture alpha.
argument-hint: "[path]"
---

# Alpha

Open a todolist, then call \`Task\` and the **teach** skill. See [tdd](../tdd/SKILL.md) and [bot](../make-bot-ui/SKILL.md), plus [nightly](../../automations/nightly.md) and [sicko](../../agents/comment-sicko.md).
`);
  put(root, "pstack/skills/tdd/SKILL.md", `---
name: tdd
description: Fixture tdd.
disable-model-invocation: true
---

# TDD

Fixture tdd body.
`);
  put(root, "pstack/skills/teach/SKILL.md", `---
name: teach
description: "Quoted description with: colon and more text"
argument-hint: |
  multi
  line
---

# Teach

Fixture teach body.
`);
  put(root, "pstack/skills/make-bot-ui/SKILL.md", `---
name: make-bot-ui
description: Fixture make-bot-ui.
---

# Make Bot UI
`);
  put(root, "pstack/skills/beta/SKILL.md", `---
name: beta
description: Fixture beta.
icon: gear
color: blue
paths:
  - "*.ts"
---

# Beta

Fixture beta body.
`);
  put(root, "pstack/skills/gamma/SKILL.md", `---
name: gamma
description: Fixture gamma without a heading.
---

Fixture body survives without a heading.
`);

  put(root, "cursor-team-kit/LICENSE", "MIT kit license\n");
  put(root, "cursor-team-kit/skills/deslop/SKILL.md", "---\nname: deslop\ndescription: Kit deslop.\n---\n\n# Deslop\n\nKit body.\n");
  put(root, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit control cli.\ndisable-model-invocation: false\n---\n\n# Control CLI\n\nKit body.\n");
  put(root, "cursor-team-kit/skills/control-ui/SKILL.md", "---\nname: control-ui\ndescription: Kit control ui.\n---\n\n# Control UI\n\nSee [peer](../control-cli/SKILL.md).\n");
  put(root, "cursor-team-kit/skills/control-ui/renderer.js", "export const fixture = true;\n");

  if (options.beforeEmit) options.beforeEmit(root);
  return root;
}

test("emitted tree keeps unprefixed names, bundles kit skills, excludes make-bot-ui, and relocates links", () => {
  const root = fixture();
  generateOrFail(root);

  const emitted = readdirSync(join(root, "harness/agy/pstack/skills")).sort();
  for (const name of ["alpha", "beta", "gamma", "tdd", "teach", "deslop", "control-cli", "control-ui"]) {
    assert.ok(emitted.includes(name), `missing ${name}`);
    assert.ok(!name.startsWith("pstack-"), "names must stay unprefixed");
  }
  assert.ok(!emitted.includes("make-bot-ui"), "excluded skill must not emit");

  const alpha = read(root, "harness/agy/pstack/skills/alpha/SKILL.md");
  assert.ok(alpha.includes("name: alpha"));
  assert.ok(alpha.includes("../tdd/SKILL.md"));
  assert.ok(alpha.includes("../../agents/comment-sicko.md"));
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/automations/nightly.md"));
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/skills/make-bot-ui/SKILL.md"));
});

test("frontmatter strips Cursor-only keys, preserves disable-model-invocation, and forces kit skills hidden", () => {
  const root = fixture();
  generateOrFail(root);

  const tdd = read(root, "harness/agy/pstack/skills/tdd/SKILL.md");
  assert.ok(tdd.includes("disable-model-invocation: true"), "canonical disable flag preserved");
  const beta = read(root, "harness/agy/pstack/skills/beta/SKILL.md");
  for (const key of ["icon", "color", "paths", "triggers"]) {
    assert.ok(!new RegExp(`^${key}:`, "m").test(beta.split("---")[1]), `${key} must not appear`);
  }
  for (const kitName of ["deslop", "control-cli", "control-ui"]) {
    const kitHeader = read(root, `harness/agy/pstack/skills/${kitName}/SKILL.md`).split("---")[1];
    assert.ok(/^disable-model-invocation:\s*true$/m.test(kitHeader), `${kitName} must set disable-model-invocation: true`);
  }
  const teach = read(root, "harness/agy/pstack/skills/teach/SKILL.md");
  assert.ok(teach.includes('description: "Quoted description with: colon and more text"'));
  assert.ok(teach.includes("argument-hint: |\n  multi\n  line"));
});

test("native plugin.json, logo, agents, licenses, and docs are emitted without always-on rules", () => {
  const root = fixture();
  generateOrFail(root);

  const manifest = JSON.parse(read(root, "harness/agy/pstack/plugin.json"));
  assert.equal(manifest.name, "pstack");
  assert.equal(manifest.version, "9.9.9");
  assert.equal(manifest.logo, "assets/logo.png");
  assert.equal(manifest.$schema, undefined, "native AGY manifest omits $schema");
  assert.ok(existsSync(join(root, "harness/agy/pstack/assets/logo.png")));
  assert.ok(!existsSync(join(root, "harness/agy/pstack/rules")), "must not emit always-on rules");
  assert.ok(!existsSync(join(root, "harness/agy/pstack/AGENTS.md")), "must not emit root AGENTS.md");

  for (const agentName of ["poteto-agent.md", "comment-sicko.md"]) {
    const renderedAgent = read(root, `harness/agy/pstack/agents/${agentName}`);
    assert.ok(renderedAgent.includes(AGY_AGENT_NOTE), `${agentName} must include AGY agent note`);
    assert.ok(!/^is_background:/m.test(renderedAgent.split("---")[1] ?? ""), "is_background stripped");
  }
  assert.equal(read(root, "harness/agy/pstack/LICENSE"), "MIT fixture license\n");
  assert.equal(read(root, "harness/agy/pstack/LICENSE-cursor-team-kit"), "MIT kit license\n");
  const readme = read(root, "harness/agy/pstack/README.md");
  assert.ok(readme.includes("[the AGY adapter](docs/harness/agy.md)"));
  assert.ok(readme.includes(AGY_README_NOTE));
});

test("every emitted SKILL.md carries the AGY adapter notice and zero model pins", () => {
  const root = fixture();
  generateOrFail(root);
  for (const name of readdirSync(join(root, "harness/agy/pstack/skills"))) {
    const content = read(root, `harness/agy/pstack/skills/${name}/SKILL.md`);
    assert.ok(content.includes(AGY_NOTICE), `${name} missing notice`);
    assert.ok(!/^(model|thinking):/m.test(content.split("---")[1] ?? ""), `${name} pins model`);
  }
});

test("--check passes when clean and fails without writing on drift", () => {
  const root = fixture();
  generateOrFail(root);
  assert.equal(generate(root, ["--check"]).status, 0);

  put(root, "harness/agy/pstack/skills/alpha/extra.md", "drift\n");
  const driftedSnapshot = sha(join(root, "harness"));
  const failed = generate(root, ["--check"]);
  assert.notEqual(failed.status, 0);
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...driftedSnapshot.entries()].sort());
});

test("symbolic links in source or output are rejected before writes", () => {
  const root = fixture();
  symlinkSync(join(root, "pstack/LICENSE"), join(root, "pstack/skills/alpha/linked-license.md"));
  const run = generate(root);
  assert.notEqual(run.status, 0, "symlink in source must fail");
  assert.ok((run.stdout + run.stderr).includes("symbolic link"));
});

test("escaping links, missing local links, and missing adapter rows fail before touching output", () => {
  const noTodo = AGY_ADAPTER.replace("| todolist | checklist |\n", "");
  const root1 = fixture({ adapter: noTodo });
  const run1 = generate(root1);
  assert.notEqual(run1.status, 0);
  assert.ok(run1.stdout.includes("todolist"));

  const root2 = fixture();
  generateOrFail(root2);
  const before = sha(join(root2, "harness"));
  put(root2, "pstack/skills/beta/SKILL.md", "---\nname: beta\ndescription: Fixture beta.\n---\n\n# Beta\n\nSee [up](../../../outside.md).\n");
  assert.notEqual(generate(root2).status, 0);
  assert.deepEqual([...sha(join(root2, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("AGY TERMS cover every upstream generator term key", () => {
  const upstream = readFileSync(join(REPO, "scripts", "generate-pstack-harness-trees.mjs"), "utf8");
  const upstreamKeys = [...upstream.matchAll(/key: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  assert.ok(upstreamKeys.length > 15);
  const own = spawnSync(process.execPath, [SCRIPT, "--print-terms"], { encoding: "utf8" });
  assert.equal(own.status, 0);
  const ownKeys = new Set(own.stdout.trim().split("\n"));
  for (const key of upstreamKeys) assert.ok(ownKeys.has(key), `missing upstream term key ${key}`);
});

test("AGY generation and CC generation do not clobber each other", () => {
  const root = fixture();
  put(root, "pstack/docs/harness/claude-code.md", CC_ADAPTER);
  cpSync(join(REPO, "scripts", "generate-pstack-harness-trees.mjs"), join(root, "scripts", "generate-pstack-harness-trees.mjs"));
  generateOrFail(root);
  const agyBefore = sha(join(root, "harness/agy"));
  const cc = spawnSync(process.execPath, [join(root, "scripts", "generate-pstack-harness-trees.mjs")], { cwd: root, encoding: "utf8" });
  assert.equal(cc.status, 0, `CC generator failed: ${cc.stdout}${cc.stderr}`);
  assert.deepEqual([...sha(join(root, "harness/agy")).entries()].sort(), [...agyBefore.entries()].sort());
});

test("real repository generated tree passes --check and agy plugin validate --strict", () => {
  const check = spawnSync(process.execPath, [SCRIPT, "--check"], { cwd: REPO, encoding: "utf8" });
  assert.equal(check.status, 0, `${check.stdout}${check.stderr}`);
  const agyBin = "/Users/larry/.local/bin/agy";
  if (existsSync(agyBin)) {
    const val = spawnSync(agyBin, ["plugin", "validate", join(REPO, "harness/agy/pstack"), "--strict", "--json"], {
      cwd: REPO,
      encoding: "utf8",
    });
    assert.equal(val.status, 0, `${val.stdout}${val.stderr}`);
    const parsed = JSON.parse(val.stdout);
    assert.equal(parsed.components.skills, 60);
    assert.equal(parsed.components.agents, 2);
    assert.deepEqual(parsed.findings, []);
  }
});
