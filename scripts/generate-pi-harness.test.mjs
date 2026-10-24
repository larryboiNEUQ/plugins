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
const SCRIPT = join(REPO, "scripts", "generate-pi-harness.mjs");

const PI_NOTICE =
  "In Pi, read [the Pi adapter](../../docs/harness/pi.md) before following this skill. " +
  "It maps Cursor names to Pi and records extension requirements and local policies.";
const PI_README_NOTE =
  "This is a generated local Pi package. Install it with `pi install git:github.com/larryboiNEUQ/plugins` " +
  "or `pi install /path/to/plugins` for a local checkout, which registers its skills and, with Tintinweb, its agents. " +
  "All package skills use the pstack- prefix. Start with `/skill:pstack-poteto-mode`; model setup is " +
  "`/skill:pstack-setup-pstack`. Personal model mappings stay in ~/.pi/agent/pstack/models.md and are changed only " +
  "by an approved setup. Updating the package does not remove older unprefixed pstack resources.";
const PI_AGENT_NOTE =
  "In Pi, read the caller-supplied absolute pstack-poteto-mode SKILL.md and the Pi adapter at ../../docs/harness/pi.md " +
  "relative to that skill directory before following this agent. The adapter overrides Cursor-specific instructions, " +
  "names, and paths below. If no skill path was supplied, locate skills/pstack-poteto-mode/SKILL.md in this installed " +
  "Pi package rather than a Cursor cache. If the package cannot be identified, report the missing path before working.";
const UPSTREAM_POTETO = `---
name: poteto-agent
description: Upstream delegate.
role: reviewer
---

# Poteto Agent

Work scoped tasks on .cursor/projects/agent-transcripts and try grok-9.9-fast when told.
`;

const temps = [];
process.once("exit", () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function put(root, path, content, mode = 0o644) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  chmodSync(target, mode);
}

function sha(root) {
  const map = new Map();
  if (!existsSync(root)) return map;
  for (const path of walk(root)) {
    const rel = relative(root, path);
    const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
    map.set(rel, `${digest}:${(statSync(path).mode & 0o111) !== 0 ? "x" : "-"}`);
  }
  return map;
}

const CC_ADAPTER = `# Claude Code adapter

| Cursor instruction | Claude Code |
| \`Task\` | Task tool |
| todolist | TodoWrite |
| generalPurpose | general-purpose |
| comment-sicko | comment-sicko agent |
| Run another pstack skill | Read the SKILL.md |
`;

const PI_ADAPTER = `# pstack in Pi

| Cursor instruction | Pi |
| \`Task\` | \`Agent\` |
| grok- | mapped model |
| todolist | checklist |
| generalPurpose | subagent_type |
| comment-sicko | subagent_type: "comment-sicko" |
| Run another pstack skill | Read SKILL.md |
`;

const COMMENT_SICKO = `---
name: comment-sicko
description: A deranged comment-hater that savors deletion.
---

# Comment Sicko

My first output when spawned is exactly this.

Feed me the diff.
`;

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "harness-gen-"));
  temps.push(root);
  mkdirSync(join(root, "scripts"));
  cpSync(SCRIPT, join(root, "scripts", "generate-pi-harness.mjs"));

  put(root, "pstack/plugin.json", JSON.stringify({ name: "pstack", version: "9.9.9" }, null, 2) + "\n");
  put(root, "pstack/LICENSE", "MIT fixture license\n");
  put(root, "pstack/README.md", "# pstack\n\nSee [the guide](docs/guide/01-start.md) and [a skill](skills/alpha/SKILL.md).\n");
  put(root, "pstack/docs/guide/01-start.md", "# Start\n\nRun [alpha](../../skills/alpha/SKILL.md) and see [README](../../README.md).\n");
  put(root, "pstack/docs/harness/claude-code.md", CC_ADAPTER);
  put(root, "pstack/docs/harness/pi.md", options.piAdapter ?? PI_ADAPTER);
  put(root, "pstack/docs/harness/pi/agents/pstack-readonly.md",
    "---\nname: pstack-readonly\ndescription: Read-only delegate.\nextensions: false\nskills: true\nprompt_mode: replace\n---\n\nRead only.\n");
  put(root, "pstack/agents/comment-sicko.md", COMMENT_SICKO);
  put(root, "pstack/agents/poteto-agent.md", UPSTREAM_POTETO);
  put(root, "pstack/automations/nightly.md", "# Nightly automation\n");

  put(root, "pstack/skills/alpha/SKILL.md", `---
name: alpha
description: Fixture alpha skill.
---

# Alpha

Open a todolist, then call \`Task\` and the **teach** skill. See [tdd](../tdd/SKILL.md) and [bot](../make-bot-ui/SKILL.md), plus [nightly](../../automations/nightly.md) and [sicko](../../agents/comment-sicko.md).

Alpha fixture body stays identical.
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
description: Fixture teach.
disable-model-invocation: true
---

# Teach

Fixture teach body.
`);
  put(root, "pstack/skills/make-bot-ui/SKILL.md", `---
name: make-bot-ui
description: Fixture bot.
---

# Bot UI

Fixture bot body.
`);
  put(root, "pstack/skills/beta/SKILL.md", `---
name: beta
description: Fixture beta with executable helper.
---

# Beta

Fixture beta body.
`);
  put(root, "pstack/skills/beta/scripts/run.sh", "#!/bin/sh\necho fixture\n", 0o755);

  put(root, "cursor-team-kit/LICENSE", "MIT kit license\n");
  put(root, "cursor-team-kit/skills/deslop/SKILL.md", "---\nname: deslop\ndescription: Kit deslop.\n---\n\n# Deslop\n\nKit body.\n");
  put(root, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit control cli.\n---\n\n# Control CLI\n\nKit body.\n");
  put(root, "cursor-team-kit/skills/control-ui/SKILL.md", "---\nname: control-ui\ndescription: Kit control ui.\n---\n\n# Control UI\n\nSee [peer](../control-cli/SKILL.md).\n");
  put(root, "cursor-team-kit/skills/control-ui/renderer.js", "export const fixture = true;\n");
  put(root, "pstack/skills/gamma/SKILL.md", `---
name: gamma
description: Fixture gamma without a heading.
---

Fixture body survives without a heading.
`);

  return root;
}

function generate(root, args = []) {
  const run = spawnSync(process.execPath, [join(root, "scripts/generate-pi-harness.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

function read(root, path) {
  return readFileSync(join(root, path), "utf8");
}

function generateOrFail(root) {
  const run = generate(root);
  assert.equal(run.status, 0, `generation failed: ${run.stdout}${run.stderr}`);
  return run;
}

test("pi tree has expected paths, renamed skills, exclusions, and relocated links", () => {
  const root = fixture();
  generateOrFail(root);

  const skills = readdirSync(join(root, "harness/pi/pstack/skills")).sort();
  assert.ok(skills.includes("pstack-alpha"));
  assert.ok(skills.includes("pstack-tdd"));
  assert.ok(skills.includes("pstack-teach"));
  assert.ok(skills.includes("pstack-deslop"));
  assert.ok(skills.includes("pstack-control-cli"));
  assert.ok(skills.includes("pstack-control-ui"));
  assert.ok(!skills.includes("tdd"), "bare tdd must not be emitted");
  assert.ok(!skills.includes("teach"), "bare teach must not be emitted");
  assert.ok(!skills.includes("make-bot-ui"), "excluded skill must not be emitted");

  const tdd = read(root, "harness/pi/pstack/skills/pstack-tdd/SKILL.md");
  assert.match(tdd, /^name: pstack-tdd$/m);
  assert.ok(!/^name: tdd$/m.test(tdd));
  assert.ok(tdd.includes("disable-model-invocation: true"));
  const teach = read(root, "harness/pi/pstack/skills/pstack-teach/SKILL.md");
  assert.match(teach, /^name: pstack-teach$/m);

  const alpha = read(root, "harness/pi/pstack/skills/pstack-alpha/SKILL.md");
  assert.ok(alpha.includes("../pstack-tdd/SKILL.md"), "tdd link must relocate");
  assert.ok(!alpha.includes("../tdd/SKILL.md"), "old tdd link must not remain");
  assert.ok(alpha.includes("../../agents/pstack-comment-sicko.md"), "local agent link stays local");
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/automations/nightly.md"),
    "excluded file link must fall back to GitHub");
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/skills/make-bot-ui/SKILL.md"),
    "excluded skill link must fall back to GitHub");
});

test("kit skills, licenses, agent files, config, and package.json are emitted", () => {
  const root = fixture();
  generateOrFail(root);

  assert.equal(read(root, "harness/pi/pstack/LICENSE"), "MIT fixture license\n");
  assert.equal(read(root, "harness/pi/pstack/LICENSE-cursor-team-kit"), "MIT kit license\n");
  assert.equal(read(root, "harness/pi/pstack/skills/pstack-control-ui/renderer.js"), "export const fixture = true;\n");
  const controlUi = read(root, "harness/pi/pstack/skills/pstack-control-ui/SKILL.md");
  assert.ok(controlUi.includes("../pstack-control-cli/SKILL.md"), "kit-internal link stays local");

  const sicko = read(root, "harness/pi/pstack/agents/pstack-comment-sicko.md");
  const sickoUpstream = read(root, "pstack/agents/comment-sicko.md").replace(/^---\n[\s\S]*?\n---\n*/, "");
  assert.ok(sicko.startsWith("---\nname: pstack-comment-sicko\n"));
  assert.ok(sicko.includes("extensions: true"));
  assert.ok(sicko.includes("skills: true"));
  assert.ok(sicko.includes("allowed_subagents: pstack-readonly, pstack-poteto-agent"));
  assert.ok(sicko.includes("prompt_mode: replace"));
  assert.ok(sicko.includes("description: A deranged comment-hater that savors deletion."));
  assert.equal(sicko.split(`${PI_AGENT_NOTE}\n\n`)[1], sickoUpstream, "agent body must equal upstream bytes");
  assert.ok(!/^readonly:/m.test(sicko.split("---")[1] ?? ""), "Cursor readonly field must not survive");
  assert.ok(!/is_background/.test(sicko.split("---")[1] ?? ""));

  const poteto = read(root, "harness/pi/pstack/agents/pstack-poteto-agent.md");
  const potetoUpstream = read(root, "pstack/agents/poteto-agent.md").replace(/^---\n[\s\S]*?\n---\n*/, "");
  assert.ok(poteto.startsWith("---\nname: pstack-poteto-agent\n"));
  assert.ok(poteto.includes("allowed_subagents: pstack-poteto-agent, pstack-readonly, pstack-comment-sicko"));
  assert.ok(poteto.includes("description: Upstream delegate."));
  assert.equal(poteto.split(`${PI_AGENT_NOTE}\n\n`)[1], potetoUpstream, "agent body must equal upstream bytes");
  assert.ok(poteto.includes(".cursor/projects/agent-transcripts"), "upstream Cursor path prose survives");
  assert.ok(poteto.includes("grok-9.9-fast"), "upstream model slug prose survives");

  assert.equal(
    read(root, "harness/pi/pstack/agents/pstack-readonly.md"),
    read(root, "pstack/docs/harness/pi/agents/pstack-readonly.md"),
  );

  assert.ok(!existsSync(join(root, "harness/pi/pstack/config")),
    "no config catalog or example snapshots may be emitted");

  const pkg = JSON.parse(read(root, "harness/pi/pstack/package.json"));
  assert.equal(pkg.name, "pstack-pi-harness");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "9.9.9");
  assert.deepEqual(pkg.pi, { skills: ["./skills"], subagents: { agents: ["./agents"] } });
  assert.ok(!("dependencies" in pkg) && !("scripts" in pkg) && !("bin" in pkg),
    "package.json must not declare an installable runner");
  assert.deepEqual(
    readdirSync(join(root, "harness/pi/pstack/agents")).sort(),
    ["pstack-comment-sicko.md", "pstack-poteto-agent.md", "pstack-readonly.md"],
    "the Pi agents dir must hold exactly the three agent definitions",
  );
  const rootPkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
  assert.deepEqual(rootPkg.pi, {
    skills: ["./harness/pi/pstack/skills"],
    subagents: { agents: ["./harness/pi/pstack/agents"] },
  });
  assert.ok(!("dependencies" in rootPkg) && !("scripts" in rootPkg));
  const emittedPkg = JSON.parse(readFileSync(join(REPO, "harness/pi/pstack/package.json"), "utf8"));
  const realPlugin = JSON.parse(readFileSync(join(REPO, "pstack/plugin.json"), "utf8"));
  assert.equal(emittedPkg.version, realPlugin.version, "generated package version tracks plugin.json");

  assert.equal(read(root, "harness/pi/pstack/docs/harness/pi.md"), PI_ADAPTER);
  const readme = read(root, "harness/pi/pstack/README.md");
  assert.ok(readme.includes("[the Pi adapter](docs/harness/pi.md)"));
  assert.ok(readme.includes(PI_README_NOTE));
  const guide = read(root, "harness/pi/pstack/docs/guide/01-start.md");
  assert.ok(guide.includes("[the Pi adapter](../harness/pi.md)"));
  assert.ok(guide.includes("[alpha](../../skills/pstack-alpha/SKILL.md)"), "guide link stays local and relative");
  assert.ok(read(root, "harness/pi/pstack/skills/pstack-alpha/SKILL.md").includes(PI_NOTICE));
});

test("every generated Pi SKILL.md carries the mapping notice", () => {
  const root = fixture();
  generateOrFail(root);
  for (const path of walk(join(root, "harness/pi/pstack/skills")).filter((p) => p.endsWith("SKILL.md"))) {
    assert.ok(readFileSync(path, "utf8").includes("read [the Pi adapter]("), `${path} lacks the Pi adapter notice`);
  }
});

test("no generated agent carries a model or thinking pin", () => {
  const root = fixture();
  generateOrFail(root);
  for (const name of readdirSync(join(root, "harness/pi/pstack/agents"))) {
    const text = read(root, `harness/pi/pstack/agents/${name}`);
    assert.ok(!/^(model|thinking):/m.test(text), `${name} pins model or thinking`);
  }
});

test("default run emits the tree and --check passes; fixture prose survives", () => {
  const root = fixture();
  generateOrFail(root);
  assert.ok(existsSync(join(root, "harness/pi/pstack/skills/pstack-alpha/SKILL.md")));
  const check = generate(root, ["--check"]);
  assert.equal(check.status, 0, `--check: ${check.stdout}${check.stderr}`);
  const piTdd = read(root, "harness/pi/pstack/skills/pstack-tdd/SKILL.md");
  assert.equal(piTdd, `---
name: pstack-tdd
description: Fixture tdd.
disable-model-invocation: true
---

# TDD

${PI_NOTICE}

Fixture tdd body.
`, "renamed skill must be frontmatter rename plus notice plus verbatim body");
  const betaRun = join(root, "harness/pi/pstack/skills/pstack-beta/scripts/run.sh");
  assert.ok((statSync(betaRun).mode & 0o111) !== 0, "executable bit must be preserved");
});

test("source trees are unmodified and regeneration is stable", () => {
  const root = fixture();
  const before = sha(join(root, "pstack"));
  const kitBefore = sha(join(root, "cursor-team-kit"));
  generateOrFail(root);
  const first = sha(join(root, "harness"));
  generateOrFail(root);
  const second = sha(join(root, "harness"));
  assert.deepEqual([...first.entries()].sort(), [...second.entries()].sort());
  assert.deepEqual([...sha(join(root, "pstack")).entries()].sort(), [...before.entries()].sort());
  assert.deepEqual([...sha(join(root, "cursor-team-kit")).entries()].sort(), [...kitBefore.entries()].sort());
});

test("--check fails after a Pi corruption or addition and writes nothing", () => {
  const root = fixture();
  generateOrFail(root);
  const victim = join(root, "harness/pi/pstack/skills/pstack-alpha/SKILL.md");
  const before = read(root, "harness/pi/pstack/skills/pstack-alpha/SKILL.md");
  writeFileSync(victim, "corrupted\n");
  const run = generate(root, ["--check"]);
  assert.notEqual(run.status, 0, "--check must fail on a corrupted Pi file");
  assert.equal(read(root, "harness/pi/pstack/skills/pstack-alpha/SKILL.md"), "corrupted\n",
    "--check must not rewrite files");

  writeFileSync(victim, before);
  generateOrFail(root);
  put(root, "harness/pi/pstack/skills/pstack-alpha/extra.txt", "stray\n");
  const stray = generate(root, ["--check"]);
  assert.notEqual(stray.status, 0, "--check must fail on an added Pi file");
  assert.ok(existsSync(join(root, "harness/pi/pstack/skills/pstack-alpha/extra.txt")));
});

test("Pi TERMS cover every upstream generator term key", () => {
  const upstream = readFileSync(join(REPO, "scripts", "generate-pstack-harness-trees.mjs"), "utf8");
  const upstreamKeys = [...upstream.matchAll(/key: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  assert.ok(upstreamKeys.length > 15, "expected to parse upstream term keys");
  const own = spawnSync(process.execPath, [join(REPO, "scripts", "generate-pi-harness.mjs"), "--print-terms"], { encoding: "utf8" });
  assert.equal(own.status, 0);
  const ownKeys = new Set(own.stdout.trim().split("\n"));
  for (const key of upstreamKeys) assert.ok(ownKeys.has(key), `Pi generator is missing upstream term key ${key}`);
});

test("Pi generation leaves harness/pstack byte-identical and upstream --check passes", () => {
  const root = fixture();
  generateOrFail(root);
  cpSync(join(REPO, "scripts", "generate-pstack-harness-trees.mjs"), join(root, "scripts", "generate-pstack-harness-trees.mjs"));
  const upstream = spawnSync(process.execPath, [join(root, "scripts", "generate-pstack-harness-trees.mjs")], { cwd: root, encoding: "utf8" });
  assert.equal(upstream.status, 0, `upstream generation: ${upstream.stdout}${upstream.stderr}`);
  const before = sha(join(root, "harness/pstack"));
  generateOrFail(root);
  const after = sha(join(root, "harness/pstack"));
  assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort());
  const check = spawnSync(process.execPath, [join(root, "scripts", "generate-pstack-harness-trees.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(check.status, 0, `upstream --check: ${check.stdout}${check.stderr}`);
});

test("upstream generation in a temp copy does not touch harness/pi/pstack", () => {
  const root = fixture();
  generateOrFail(root);
  const piTree = join(root, "harness/pi/pstack");
  const before = sha(piTree);
  mkdirSync(join(root, "harness/pstack"), { recursive: true });
  const upstreamScript = join(REPO, "scripts", "generate-pstack-harness-trees.mjs");
  cpSync(upstreamScript, join(root, "scripts", "generate-pstack-harness-trees.mjs"));
  const run = spawnSync(process.execPath, [join(root, "scripts", "generate-pstack-harness-trees.mjs")], { cwd: root, encoding: "utf8" });
  const after = sha(piTree);
  assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort(),
    "upstream generator must not delete or alter harness/pi/pstack");
});

test("missing mapping coverage fails before touching generated trees", () => {
  const brokenPi = PI_ADAPTER.replace("| todolist | checklist |\n", "");
  const root = fixture({ piAdapter: brokenPi });
  const run = generate(root);
  assert.notEqual(run.status, 0, "generation must reject a mapping missing coverage");
  assert.ok(!existsSync(join(root, "harness")), "no tree may be written when validation fails");

  const good = fixture();
  generateOrFail(good);
  const before = sha(join(good, "harness"));
  writeFileSync(join(good, "pstack/docs/harness/pi.md"), brokenPi);
  const bad = generate(good);
  assert.notEqual(bad.status, 0);
  assert.deepEqual([...sha(join(good, "harness")).entries()].sort(), [...before.entries()].sort(),
    "prior generated trees must remain untouched after failed validation");
});

test("invalid source skill metadata fails before touching generated trees", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/alpha/SKILL.md", "---\nname: not-alpha\ndescription: renamed.\n---\n\n# Alpha\n\nOpen a todolist.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0, "mismatched frontmatter name must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("skill without a heading still gets the notice with body intact", () => {
  const root = fixture();
  generateOrFail(root);
  const emitted = read(root, "harness/pi/pstack/skills/pstack-gamma/SKILL.md");
  assert.equal(emitted, `---
name: pstack-gamma
description: Fixture gamma without a heading.
---

${PI_NOTICE}

Fixture body survives without a heading.
`);
});

test("a link to a missing local file fails after a valid render", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/beta/SKILL.md", `---
name: beta
description: Fixture beta with executable helper.
---

# Beta

See [missing](references/missing.md).
`);
  const run = generate(root);
  assert.notEqual(run.status, 0, "a missing local .md link must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort(),
    "prior generated trees must remain unchanged");
});

test("an upstream name already prefixed emits with a second prefix", () => {
  const root = fixture();
  put(root, "pstack/skills/pstack-tdd/SKILL.md", "---\nname: pstack-tdd\ndescription: Already prefixed.\n---\n\n# Prefixed\n\nBody.\n");
  const run = generate(root);
  assert.equal(run.status, 0, `prefixed source must emit distinctly: ${run.stdout}${run.stderr}`);
  assert.ok(read(root, "harness/pi/pstack/skills/pstack-pstack-tdd/SKILL.md").includes("name: pstack-pstack-tdd"));
});

test("an emitted name over 64 characters fails before writes", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  const long = "a" + "-b".repeat(31);
  put(root, `pstack/skills/${long}/SKILL.md`, `---\nname: ${long}\ndescription: Too long.\n---\n\n# Long\n\nBody.\n`);
  const run = generate(root);
  assert.notEqual(run.status, 0, "emitted name over 64 chars must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("upstream agent body edits flow through without touching Pi sources", () => {
  const root = fixture();
  put(root, "pstack/skills/setup-pstack/SKILL.md", "---\nname: setup-pstack\ndescription: Fixture setup.\n---\n\n# Setup\n\nfuture reviewer: grok-9.9-xhigh-fast\n");
  generateOrFail(root);
  assert.ok(read(root, "harness/pi/pstack/skills/pstack-setup-pstack/SKILL.md").includes("future reviewer: grok-9.9-xhigh-fast"),
    "future role prose survives prefixing unchanged");
  put(root, "pstack/agents/poteto-agent.md", UPSTREAM_POTETO.replace("try grok-9.9-fast", "try opus-4.4-ultra"));
  const run = generate(root);
  assert.equal(run.status, 0);
  assert.ok(read(root, "harness/pi/pstack/agents/pstack-poteto-agent.md").includes("opus-4.4-ultra"),
    "edited upstream body must appear in generated agent");
});

test("a canonical skill colliding with a bundled kit skill fails before writes", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "pstack/skills/control-ui/SKILL.md", "---\nname: control-ui\ndescription: Canonical collider.\n---\n\n# Other\n\nBody.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0, "kit-name collision must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("invalid kit skill metadata fails", () => {
  const root = fixture();
  generateOrFail(root);
  const before = sha(join(root, "harness"));
  put(root, "cursor-team-kit/skills/deslop/SKILL.md", "---\nname: not-deslop\ndescription: renamed.\n---\n\n# Deslop\n\nKit body.\n");
  const run = generate(root);
  assert.notEqual(run.status, 0, "kit frontmatter name mismatch must fail");
  assert.deepEqual([...sha(join(root, "harness")).entries()].sort(), [...before.entries()].sort());
});

test("a kit-only Cursor term requires a Pi adapter row", () => {
  const asking = fixture();
  put(asking, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit control cli.\n---\n\n# Control CLI\n\nUse AskQuestion to confirm.\n");
  const missing = generate(asking);
  assert.notEqual(missing.status, 0, "missing Pi adapter row for a kit term must fail");
  assert.ok(!existsSync(join(asking, "harness")), "no tree may be written when validation fails");
  writeFileSync(join(asking, "pstack/docs/harness/pi.md"), `${PI_ADAPTER}| \`AskQuestion\` | optional ask tool |\n`);
  const covered = generate(asking);
  assert.equal(covered.status, 0, `added row must pass: ${covered.stdout}${covered.stderr}`);
});
