#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts", "generate-devin-harness.mjs");

const DEVIN_NOTICE =
  "In Devin CLI, read [the Devin CLI adapter](../../docs/harness/devin-cli.md) before following this skill. " +
  "It maps Cursor names and explicit model routing to this host.";
const DEVIN_README_NOTE =
  "This is a generated local Devin CLI plugin. Use /pstack:poteto-mode and /pstack:setup-pstack. " +
  "Install the complete plugin from harness/devin/pstack. Personal two-model choices and native model " +
  "profiles stay outside this plugin and require an approved setup.";
const DEVIN_AGENT_NOTE =
  "In Devin CLI, read the caller-supplied absolute poteto-mode SKILL.md and the Devin adapter at " +
  "../../docs/harness/devin-cli.md relative to that skill directory. The adapter overrides Cursor-specific " +
  "instructions, paths, and model routing below. This file supplies upstream agent prose; explicit two-model " +
  "seats use the configured native profile, not this definition's default router.";

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

const DEVIN_ADAPTER = `# pstack in Devin CLI

| Cursor instruction | Devin CLI |
| \`Task\` | \`run_subagent\` |
| \`AskQuestion\` | \`ask_user_question\` |
| todolist | checklist |
| generalPurpose | profile |
| comment-sicko | read-only profile |
| poteto-agent | profile |
| \`readonly: true\` | read-only |
| \`environment: "cloud"\` | report gap |
| cloud_base_branch | report gap |
| \`run_in_background: true\` | is_background |
| \`resume\` | resume field |
| \`file_attachments\` | absolute paths |
| claude- | mapped |
| grok- | mapped |
| gpt- | mapped |
| inherit-parent | no mapping |
| pstack-models.mdc | models.md |
| .cursor/skills/ | plugin |
| ~/.cursor/plugins/ | plugin |
| .cursor/rules/ | native rules |
| agent-transcripts | session |
| Cursor-only features | unsupported |
| disable-model-invocation | triggers |
| \`icon\`, \`color\`, \`paths\` | omit |
| Run another pstack skill | read SKILL.md |
`;

const PI_ADAPTER = `# pstack in Pi

| Cursor instruction | Pi |
| \`Task\` | \`Agent\` |
| \`AskQuestion\` | ask |
| todolist | checklist |
| generalPurpose | subagent_type |
| comment-sicko | subagent_type: "pstack-comment-sicko" |
| poteto-agent | subagent_type: "pstack-poteto-agent" |
| \`readonly: true\` | read-only |
| \`environment: "cloud"\` | none |
| cloud_base_branch | none |
| \`run_in_background: true\` | none |
| \`resume\` | none |
| \`file_attachments\` | paths |
| claude- | mapped |
| grok- | mapped |
| gpt- | mapped |
| inherit-parent | mapped |
| pstack-models.mdc | models |
| .cursor/skills/ | package |
| ~/.cursor/plugins/ | package |
| .cursor/rules/ | none |
| agent-transcripts | session |
| Cursor-only features | unsupported |
| Run another pstack skill | read SKILL.md |
`;

const UPSTREAM_POTETO = `---
name: poteto-agent
description: Upstream delegate.
role: reviewer
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
  return spawnSync(process.execPath, [join(root, "scripts", "generate-devin-harness.mjs"), ...args], {
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
  const root = mkdtempSync(join(tmpdir(), "devin-gen-"));
  temps.push(root);
  mkdirSync(join(root, "scripts"));
  cpSync(SCRIPT, join(root, "scripts", "generate-devin-harness.mjs"));

  put(root, "pstack/plugin.json", JSON.stringify({ name: "pstack", version: "9.9.9" }, null, 2) + "\n");
  put(root, "pstack/LICENSE", "MIT fixture license\n");
  put(root, "pstack/README.md", "# pstack\n\nSee [the guide](docs/guide/01-start.md) and [a skill](skills/alpha/SKILL.md).\n");
  put(root, "pstack/docs/guide/01-start.md", "# Start\n\nRun [alpha](../../skills/alpha/SKILL.md) and see [README](../../README.md).\n");
  put(root, "pstack/docs/harness/devin-cli.md", options.adapter ?? DEVIN_ADAPTER);
  put(root, "pstack/docs/harness/devin-cli/profile-body.md", "Profile body fixture.\n");
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
  put(root, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit control cli.\n---\n\n# Control CLI\n\nKit body.\n");
  put(root, "cursor-team-kit/skills/control-ui/SKILL.md", "---\nname: control-ui\ndescription: Kit control ui.\n---\n\n# Control UI\n\nSee [peer](../control-cli/SKILL.md).\n");
  put(root, "cursor-team-kit/skills/control-ui/renderer.js", "export const fixture = true;\n");

  if (options.beforeEmit) options.beforeEmit(root);
  return root;
}

test("emitted tree has expected paths, native names, and relocated links", () => {
  const root = fixture();
  generateOrFail(root);

  const emitted = readdirSync(join(root, "harness/devin/pstack/skills")).sort();
  for (const name of ["alpha", "beta", "gamma", "tdd", "teach", "deslop", "control-cli", "control-ui"]) {
    assert.ok(emitted.includes(name), `missing ${name}`);
    assert.ok(!name.startsWith("pstack-"), "names must not be prefixed");
  }
  assert.ok(!emitted.includes("make-bot-ui"), "excluded skill must not emit");
  assert.ok(!emitted.some((n) => n.startsWith("pstack-")), "no pstack- prefixes in Devin output");

  const alpha = read(root, "harness/devin/pstack/skills/alpha/SKILL.md");
  assert.ok(alpha.includes("name: alpha"), "native name unchanged");
  assert.ok(alpha.includes("../tdd/SKILL.md"), "tdd link stays relative");
  assert.ok(alpha.includes("../../agents/comment-sicko.md"), "local agent link stays local");
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/automations/nightly.md"),
    "excluded file link must fall back to GitHub");
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/skills/make-bot-ui/SKILL.md"),
    "excluded skill link must fall back to GitHub");
});

test("frontmatter converts to native triggers and drops Cursor-only keys", () => {
  const root = fixture();
  generateOrFail(root);

  const tdd = read(root, "harness/devin/pstack/skills/tdd/SKILL.md");
  assert.ok(tdd.includes("triggers: [user]"), "disable-model-invocation becomes user-only");
  assert.ok(!tdd.includes("disable-model-invocation"), "source key must not survive");
  const beta = read(root, "harness/devin/pstack/skills/beta/SKILL.md");
  assert.ok(beta.includes("triggers: [user, model]"), "absent flag becomes both triggers");
  for (const key of ["icon", "color", "paths"]) {
    assert.ok(!new RegExp(`^${key}:`, "m").test(beta.split("---")[1]), `${key} must be dropped`);
  }
  const alpha = read(root, "harness/devin/pstack/skills/alpha/SKILL.md");
  assert.ok(alpha.includes('argument-hint: "[path]"'), "scalar argument-hint preserved");
  const teach = read(root, "harness/devin/pstack/skills/teach/SKILL.md");
  assert.ok(teach.includes('description: "Quoted description with: colon and more text"'),
    "quoted description preserved verbatim");
  assert.ok(teach.includes("argument-hint: |\n  multi\n  line"), "block argument-hint preserved");
});

test("manifest, agents, licenses, and docs are emitted", () => {
  const root = fixture();
  generateOrFail(root);

  const manifest = JSON.parse(read(root, "harness/devin/pstack/.devin-plugin/plugin.json"));
  assert.deepEqual(manifest, {
    name: "pstack",
    version: "9.9.9",
    description: "pstack native Devin CLI edition",
    platforms: ["local"],
    skills: ["skills"],
  });
  assert.ok(!existsSync(join(root, "harness/devin/pstack/AGENTS.md")), "no AGENTS.md");
  assert.ok(!existsSync(join(root, "harness/devin/pstack/package.json")), "no Pi/package manifest");
  assert.ok(!existsSync(join(root, "harness/devin/pstack/config")), "no role catalog or examples");

  const sicko = read(root, "harness/devin/pstack/agents/comment-sicko.md");
  const sickoUpstream = read(root, "pstack/agents/comment-sicko.md").replace(/^---\n[\s\S]*?\n---\n*/, "");
  assert.ok(sicko.startsWith("---\nname: comment-sicko\n"));
  assert.ok(sicko.includes("allowed-tools: [read, grep, glob]"), "read-only agent gets tool restriction");
  assert.ok(sicko.includes("description: A deranged comment-hater that savors deletion."));
  assert.equal(sicko.split(`${DEVIN_AGENT_NOTE}\n\n`)[1], sickoUpstream, "agent body must equal upstream bytes");
  assert.ok(!/allowed_subagents|extensions:|skills:|prompt_mode|model:|thinking:|max-nesting|is_background/.test(sicko.split("---")[1] ?? ""), "no Pi/model fields");

  const poteto = read(root, "harness/devin/pstack/agents/poteto-agent.md");
  const potetoUpstream = read(root, "pstack/agents/poteto-agent.md").replace(/^---\n[\s\S]*?\n---\n*/, "");
  assert.ok(poteto.startsWith("---\nname: poteto-agent\n"));
  assert.ok(!/^allowed-tools:/m.test(poteto.split("---")[1] ?? ""), "full-tool agent keeps default tools");
  assert.equal(poteto.split(`${DEVIN_AGENT_NOTE}\n\n`)[1], potetoUpstream, "agent body must equal upstream bytes");
  assert.ok(poteto.includes(".cursor/projects/agent-transcripts"), "upstream prose survives");
  assert.ok(poteto.includes("grok-9.9-fast"), "upstream model slug survives");
  assert.deepEqual(readdirSync(join(root, "harness/devin/pstack/agents")).sort(), ["comment-sicko.md", "poteto-agent.md"]);

  assert.equal(read(root, "harness/devin/pstack/LICENSE"), "MIT fixture license\n");
  assert.equal(read(root, "harness/devin/pstack/LICENSE-cursor-team-kit"), "MIT kit license\n");
  assert.equal(read(root, "harness/devin/pstack/docs/harness/devin-cli.md"), DEVIN_ADAPTER);
  assert.equal(read(root, "harness/devin/pstack/docs/harness/devin-cli/profile-body.md"), "Profile body fixture.\n");
  const readme = read(root, "harness/devin/pstack/README.md");
  assert.ok(readme.includes("[the Devin CLI adapter](docs/harness/devin-cli.md)"));
  assert.ok(readme.includes(DEVIN_README_NOTE));
  const guide = read(root, "harness/devin/pstack/docs/guide/01-start.md");
  assert.ok(guide.includes("[the Devin CLI adapter](../harness/devin-cli.md)"));
  assert.ok(guide.includes("[alpha](../../skills/alpha/SKILL.md)"), "guide link stays local");
});

test("every emitted SKILL.md carries the adapter notice", () => {
  const root = fixture();
  generateOrFail(root);
  for (const name of readdirSync(join(root, "harness/devin/pstack/skills"))) {
    assert.ok(read(root, `harness/devin/pstack/skills/${name}/SKILL.md`).includes(DEVIN_NOTICE), `${name} lost the notice`);
  }
});

test("no emitted file carries a model or thinking pin", () => {
  const root = fixture();
  generateOrFail(root);
  const walkLocal = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walkLocal(path) : [path];
    });
  for (const path of walkLocal(join(root, "harness/devin/pstack"))) {
    if (!path.endsWith(".md")) continue;
    const text = readFileSync(path, "utf8").split("---")[1] ?? "";
    assert.ok(!/^(model|thinking):/m.test(text), `${path} pins model or thinking`);
  }
});

test("default run emits the tree and --check passes; fixture prose survives", () => {
  const root = fixture();
  generateOrFail(root);
  assert.ok(existsSync(join(root, "harness/devin/pstack/skills/alpha/SKILL.md")));
  const check = generate(root, ["--check"]);
  assert.equal(check.status, 0, `--check: ${check.stdout}${check.stderr}`);
  assert.equal(read(root, "harness/devin/pstack/skills/tdd/SKILL.md"), `---
name: tdd
description: Fixture tdd.
triggers: [user]
---

# TDD

${DEVIN_NOTICE}

Fixture tdd body.
`);
});

test("source trees are unmodified and regeneration is stable", () => {
  const root = fixture();
  const before = sha(root);
  generateOrFail(root);
  const generated = new Map(sha(join(root, "harness")));
  generateOrFail(root);
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...generated.entries()].sort());
  const expected = sha(join(root, "harness"));
  assert.deepEqual([...sha(root).entries()].sort().filter(([path]) => !path.startsWith("harness/")),
    [...before.entries()].sort());
  assert.deepEqual([...expected.keys()].filter((k) => k.startsWith("devin/")).length > 0, true);
});

test("--check fails after corruption or addition and writes nothing", () => {
  const root = fixture();
  generateOrFail(root);
  put(root, "harness/devin/pstack/skills/alpha/extra.md", "extra\n");
  const afterAdd = sha(join(root, "harness"));
  const run = generate(root, ["--check"]);
  assert.notEqual(run.status, 0, "unexpected file must fail --check");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...afterAdd.entries()].sort(),
    "--check must not write on failure");
  rmSync(join(root, "harness/devin/pstack/skills/alpha/extra.md"));
  put(root, "harness/devin/pstack/skills/alpha/SKILL.md", "corrupt\n");
  const afterCorrupt = sha(join(root, "harness"));
  const run2 = generate(root, ["--check"]);
  assert.notEqual(run2.status, 0, "corruption must fail --check");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...afterCorrupt.entries()].sort(),
    "--check must not write on failure");
});

test("a link escaping the emitted tree fails before writes", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/beta/SKILL.md", "---\nname: beta\ndescription: Fixture beta.\n---\n\n# Beta\n\nSee [up](../../../outside.md).\n");
  const run = generate(root);
  assert.notEqual(run.status, 0, "escaping link must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("explicit false disable flag still emits user+model triggers", () => {
  const root = fixture();
  put(root, "pstack/skills/delta/SKILL.md", "---\nname: delta\ndescription: d.\ndisable-model-invocation: false\n---\n\n# Delta\n\nBody.\n");
  generateOrFail(root);
  const delta = read(root, "harness/devin/pstack/skills/delta/SKILL.md");
  assert.ok(delta.includes("triggers: [user, model]"), "false flag keeps model trigger");
  assert.ok(!delta.includes("disable-model-invocation"));
});

test("executable source files keep their executable bit", () => {
  const root = fixture();
  put(root, "pstack/skills/beta/scripts/run.sh", "#!/bin/sh\necho ok\n");
  chmodSync(join(root, "pstack/skills/beta/scripts/run.sh"), 0o755);
  generateOrFail(root);
  const emitted = join(root, "harness/devin/pstack/skills/beta/scripts/run.sh");
  assert.ok(existsSync(emitted));
  assert.ok((statSync(emitted).mode & 0o111) !== 0, "emitted script must be executable");
});

test("upstream agent with multiline description stays verbatim and parseable", () => {
  const root = fixture();
  put(root, "pstack/agents/poteto-agent.md", `---
name: poteto-agent
description: >
  Long folded
  description here.
role: reviewer
---

# Poteto Agent

Body.
`);
  generateOrFail(root);
  const poteto = read(root, "harness/devin/pstack/agents/poteto-agent.md");
  const fm = poteto.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.ok(fm.includes("description: >\n  Long folded\n  description here."), "multiline description block preserved");
  assert.ok(!/^role:/m.test(fm), "other upstream metadata stripped");
  assert.ok(poteto.includes(`${DEVIN_AGENT_NOTE}\n\n# Poteto Agent`), "note then upstream body");
});

test("an unknown source frontmatter key fails before writes", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/delta/SKILL.md", "---\nname: delta\ndescription: d.\nsandbox: strict\n---\n\n# Delta\n\nBody.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0, "unknown header key must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("missing mapping coverage fails before touching the tree", () => {
  const broken = DEVIN_ADAPTER.replace("| todolist | checklist |\n", "");
  const root = fixture({ adapter: broken });
  const run = generate(root);
  assert.notEqual(run.status, 0, "missing adapter row must fail");
  assert.ok(run.stdout.includes("todolist"), `failure must name the key: ${run.stdout}`);
  assert.ok(!existsSync(join(root, "harness/devin/pstack")), "tree must not be written");
});

test("invalid source metadata fails before writes", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/alpha/SKILL.md", "---\nname: not-alpha\ndescription: renamed.\n---\n\n# Alpha\n\nOpen a todolist.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0);
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("skill without a heading still gets the notice with body intact", () => {
  const root = fixture();
  generateOrFail(root);
  assert.equal(read(root, "harness/devin/pstack/skills/gamma/SKILL.md"), `---
name: gamma
description: Fixture gamma without a heading.
triggers: [user, model]
---

${DEVIN_NOTICE}

Fixture body survives without a heading.
`);
});

test("a link to a missing local file fails after a valid render", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/beta/SKILL.md", "---\nname: beta\ndescription: Fixture beta.\n---\n\n# Beta\n\nSee [gone](./gone.md).\n");
  const run = generate(root);
  assert.notEqual(run.status, 0);
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("a canonical skill colliding with a bundled kit skill fails before writes", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/control-ui/SKILL.md", "---\nname: control-ui\ndescription: Canonical collider.\n---\n\n# Other\n\nBody.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0, "emitted-path collision must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("invalid kit skill metadata fails", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "cursor-team-kit/skills/deslop/SKILL.md", "---\nname: not-deslop\ndescription: renamed.\n---\n\n# Deslop\n\nKit body.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0);
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("a kit-only Cursor term requires an adapter row", () => {
  const noAsk = DEVIN_ADAPTER.replace("| `AskQuestion` | `ask_user_question` |\n", "");
  const root = fixture({ adapter: noAsk });
  put(root, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit control cli.\n---\n\n# Control CLI\n\nUse AskQuestion to confirm.\n");
  const asking = generate(root);
  assert.notEqual(asking.status, 0, "kit-only Cursor term must require coverage");
  assert.ok(asking.stdout.includes("AskQuestion"), `failure must name the term: ${asking.stdout}`);
  const covered = fixture();
  put(covered, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit control cli.\n---\n\n# Control CLI\n\nUse AskQuestion to confirm.\n");
  const ok = generate(covered);
  assert.equal(ok.status, 0, `coverage present must pass: ${ok.stdout}${ok.stderr}`);
});

test("upstream agent body edits flow through without touching adapter sources", () => {
  const root = fixture();
  put(root, "pstack/agents/poteto-agent.md", UPSTREAM_POTETO.replace("try grok-9.9-fast", "try opus-4.4-ultra"));
  const run = generate(root);
  assert.equal(run.status, 0);
  assert.ok(read(root, "harness/devin/pstack/agents/poteto-agent.md").includes("opus-4.4-ultra"),
    "edited upstream body must appear in generated agent");
});

test("Devin TERMS cover every upstream generator term key", () => {
  const upstream = readFileSync(join(REPO, "scripts", "generate-pstack-harness-trees.mjs"), "utf8");
  const upstreamKeys = [...upstream.matchAll(/key: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  assert.ok(upstreamKeys.length > 15, "expected to parse upstream term keys");
  const own = spawnSync(process.execPath, [join(REPO, "scripts", "generate-devin-harness.mjs"), "--print-terms"], { encoding: "utf8" });
  assert.equal(own.status, 0);
  const ownKeys = new Set(own.stdout.trim().split("\n"));
  for (const key of upstreamKeys) assert.ok(ownKeys.has(key), `Devin generator is missing upstream term key ${key}`);
});

test("Devin generation leaves harness/pstack and harness/pi byte-identical", () => {
  const root = fixture();
  put(root, "harness/pstack/claude-code/skills/sentinel/SKILL.md", "sentinel cc\n");
  put(root, "harness/pi/pstack/skills/sentinel/SKILL.md", "sentinel pi\n");
  const before = sha(join(root, "harness"));
  generateOrFail(root);
  const after = sha(join(root, "harness"));
  assert.deepEqual([...after.entries()].sort().filter(([k]) => k.startsWith("pstack/") || k.startsWith("pi/")),
    [...before.entries()].sort().filter(([k]) => k.startsWith("pstack/") || k.startsWith("pi/")));
  assert.equal(read(root, "harness/pstack/claude-code/skills/sentinel/SKILL.md"), "sentinel cc\n");
  assert.equal(read(root, "harness/pi/pstack/skills/sentinel/SKILL.md"), "sentinel pi\n");
});

test("other generators do not touch the Devin tree", () => {
  const root = fixture();
  generateOrFail(root);
  put(root, "pstack/docs/harness/claude-code.md", CC_ADAPTER);
  put(root, "pstack/docs/harness/pi.md", PI_ADAPTER);
  put(root, "pstack/docs/harness/pi/agents/pstack-readonly.md",
    "---\nname: pstack-readonly\ndescription: Read-only delegate.\nextensions: false\nskills: true\nprompt_mode: replace\n---\n\nRead only.\n");
  cpSync(join(REPO, "scripts", "generate-pstack-harness-trees.mjs"), join(root, "scripts", "generate-pstack-harness-trees.mjs"));
  cpSync(join(REPO, "scripts", "generate-pi-harness.mjs"), join(root, "scripts", "generate-pi-harness.mjs"));
  const before = sha(join(root, "harness/devin"));
  const cc = spawnSync(process.execPath, [join(root, "scripts", "generate-pstack-harness-trees.mjs")], { cwd: root, encoding: "utf8" });
  assert.equal(cc.status, 0, `CC generator: ${cc.stdout}${cc.stderr}`);
  const pi = spawnSync(process.execPath, [join(root, "scripts", "generate-pi-harness.mjs")], { cwd: root, encoding: "utf8" });
  assert.equal(pi.status, 0, `Pi generator: ${pi.stdout}${pi.stderr}`);
  assert.deepEqual([...sha(join(root, "harness/devin")).entries()].sort(), [...before.entries()].sort(),
    "Devin tree must be untouched by other generators");
});
