#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, renameSync, lstatSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts/generate-codex-harness.mjs");
const TREE = "harness/codex/pstack";
const NOTICE = "In Codex, read [the Codex adapter](../../docs/harness/codex.md) before following this skill. It overrides Cursor tool names, paths, model selection, and unsupported features below.";
const terms = spawnSync(process.execPath, [SCRIPT, "--print-terms"], { encoding: "utf8" });
assert.equal(terms.status, 0);
const ADAPTER = `# Codex adapter\n\n${terms.stdout.split("\n").filter(Boolean).map((term) => `| ${term} | mapped |`).join("\n")}\n\nSee [example](codex/examples/models.md).\n`;
const temps = [];
process.once("exit", () => { for (const root of temps) rmSync(root, { recursive: true, force: true }); });

function put(root, path, text, mode = 0o644) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  chmodSync(file, mode);
}
function read(root, path) { return readFileSync(join(root, path), "utf8"); }
function walk(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
function snapshot(root) {
  if (!existsSync(root)) return [];
  return walk(root).map((path) => [relative(root, path), createHash("sha256").update(readFileSync(path)).digest("hex"), (statSync(path).mode & 0o111) !== 0]);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "codex-harness-test-"));
  temps.push(root);
  mkdirSync(join(root, "scripts"));
  cpSync(SCRIPT, join(root, "scripts/generate-codex-harness.mjs"));
  put(root, "pstack/plugin.json", JSON.stringify({ name: "pstack", version: "9.9.9", description: "Fixture plugin.", license: "MIT" }, null, 2) + "\n");
  put(root, "pstack/LICENSE", "Fixture license\n");
  put(root, "pstack/README.md", "# pstack\n\nRead [alpha](skills/alpha/SKILL.md) and [guide](docs/guide/start.md).\n");
  put(root, "pstack/docs/guide/start.md", "# Start\n\nRead [alpha](../../skills/alpha/SKILL.md) and [home](../../README.md).\n");
  put(root, "pstack/docs/harness/codex.md", ADAPTER);
  put(root, "pstack/docs/harness/claude-code.md", ADAPTER);
  put(root, "pstack/docs/harness/pi.md", ADAPTER);
  put(root, "pstack/docs/harness/codex/examples/models.md", "# Example\n\n[Adapter](../../codex.md)\n");
  put(root, "pstack/automations/only-cursor.md", "# Cursor-only automation\n");
  put(root, "cursor-team-kit/skills/control-ui/SKILL.md", "---\nname: control-ui\ndescription: Kit UI.\n---\n\n# Control UI\n");
  put(root, "cursor-team-kit/skills/control-cli/SKILL.md", "---\nname: control-cli\ndescription: Kit CLI.\n---\n\n# Control CLI\n");
  put(root, "cursor-team-kit/skills/deslop/SKILL.md", "---\nname: deslop\ndescription: Kit cleanup.\n---\n\n# Deslop\n");
  put(root, "cursor-team-kit/LICENSE", "Kit license\n");
  put(root, "pstack/docs/harness/pi/agents/pstack-readonly.md", "---\nname: pstack-readonly\ndescription: Fixture.\n---\n\nRead only.\n");
  put(root, "pstack/agents/poteto-agent.md", "---\nname: poteto-agent\ndescription: Delegate.\nis_background: true\n---\n\n# Poteto\n\nRead the supplied poteto-mode file.\n");
  put(root, "pstack/agents/comment-sicko.md", "---\nname: comment-sicko\ndescription: Comment reviewer.\n---\n\n# Comment Sicko\n\nReview only the supplied scope.\n");
  put(root, "pstack/skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha fixture.\ndisable-model-invocation: true\n---\n\n# Alpha\n\nUse `Task` and a todolist, then the **beta** skill. [Beta](../beta/SKILL.md) [agent](../../agents/comment-sicko.md) [external](../../automations/only-cursor.md#section) [kit](../../../cursor-team-kit/skills/control-ui/SKILL.md)\n");
  put(root, "pstack/skills/beta/SKILL.md", "---\nname: beta\ndescription: Beta fixture.\ndisable-model-invocation: false\n---\n\n# Beta\n\nUnchanged body, including model grok-9.9-high.\n");
  put(root, "pstack/skills/beta/scripts/run.sh", "#!/bin/sh\necho ok\n", 0o755);
  put(root, "pstack/skills/make-bot-ui/SKILL.md", "---\nname: make-bot-ui\ndescription: Cursor bot.\n---\n\n# Bot\n\nCursor Automations are required.\n");
  put(root, "pstack/skills/gamma/SKILL.md", "---\nname: gamma\ndescription: No heading.\n---\n\nPlain body.\n");
  put(root, "harness/pi/pstack/existing.txt", "Pi owned\n");
  put(root, "harness/pstack/existing.txt", "CC owned\n");
  return root;
}
function generate(root, ...args) {
  return spawnSync(process.execPath, [join(root, "scripts/generate-codex-harness.mjs"), ...args], { cwd: root, encoding: "utf8" });
}
function success(root, ...args) {
  const result = generate(root, ...args);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  return result;
}

test("preserves skill names, complete bodies and boolean invocation flags", () => {
  const root = fixture(); success(root);
  assert.deepEqual(readdirSync(join(root, TREE, "skills")).sort(), ["alpha", "beta", "gamma", "make-bot-ui"]);
  const original = read(root, "pstack/skills/beta/SKILL.md");
  assert.equal(read(root, `${TREE}/skills/beta/SKILL.md`), original.replace("# Beta\n\n", `# Beta\n\n${NOTICE}\n\n`));
  for (const path of walk(join(root, TREE, "skills")).filter((path) => path.endsWith("SKILL.md"))) {
    assert.ok(readFileSync(path, "utf8").includes(NOTICE), `${path} missing adapter notice`);
  }
  assert.match(read(root, `${TREE}/skills/gamma/SKILL.md`), /---\n\nIn Codex,[\s\S]*Plain body/);
});

test("packages portable and compatibility manifests, guides, license and examples", () => {
  const root = fixture(); success(root);
  assert.equal(read(root, `${TREE}/plugin.json`), read(root, "pstack/plugin.json"));
  assert.deepEqual(JSON.parse(read(root, `${TREE}/.codex-plugin/plugin.json`)), {
    name: "pstack", version: "9.9.9", description: "Fixture plugin.", skills: "./skills/",
  });
  assert.equal(read(root, `${TREE}/LICENSE`), "Fixture license\n");
  assert.equal(read(root, `${TREE}/docs/harness/codex/examples/models.md`), read(root, "pstack/docs/harness/codex/examples/models.md"));
  assert.match(read(root, `${TREE}/README.md`), /\[the Codex adapter\]\(docs\/harness\/codex.md\)/);
  assert.match(read(root, `${TREE}/docs/guide/start.md`), /\[the Codex adapter\]\(\.\.\/harness\/codex.md\)/);
});

test("agent instruction bodies are preserved and are not registered as native types", () => {
  const root = fixture(); success(root);
  for (const name of ["poteto-agent", "comment-sicko"]) {
    const src = read(root, `pstack/agents/${name}.md`);
    const emitted = read(root, `${TREE}/agents/${name}.md`);
    assert.ok(emitted.startsWith(src.split("# ")[0]), "original agent header survives");
    assert.ok(emitted.endsWith(src.split(/# [^\n]+\n\n/)[1]), "original agent body survives");
    assert.ok(emitted.includes("not a registered native Codex agent type"));
    assert.ok(emitted.includes("caller-supplied absolute path"));
  }
  assert.ok(!("agents" in JSON.parse(read(root, `${TREE}/.codex-plugin/plugin.json`))));
});

test("keeps packaged links local and rewrites omitted source links to GitHub", () => {
  const root = fixture(); success(root);
  const alpha = read(root, `${TREE}/skills/alpha/SKILL.md`);
  assert.ok(alpha.includes("[Beta](../beta/SKILL.md)"));
  assert.ok(alpha.includes("[agent](../../agents/comment-sicko.md)"));
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/pstack/automations/only-cursor.md#section"));
  assert.ok(alpha.includes("https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/control-ui/SKILL.md"));
  assert.ok(!existsSync(join(root, TREE, "skills/control-ui")));
});

test("regeneration is stable, preserves executable bits, and leaves source and other hosts untouched", () => {
  const root = fixture();
  const source = snapshot(join(root, "pstack"));
  const cc = snapshot(join(root, "harness/pstack"));
  const pi = snapshot(join(root, "harness/pi"));
  success(root);
  const first = snapshot(join(root, TREE));
  success(root); success(root, "--check");
  assert.deepEqual(snapshot(join(root, TREE)), first);
  assert.deepEqual(snapshot(join(root, "pstack")), source);
  assert.deepEqual(snapshot(join(root, "harness/pstack")), cc);
  assert.deepEqual(snapshot(join(root, "harness/pi")), pi);
  assert.ok(statSync(join(root, TREE, "skills/beta/scripts/run.sh")).mode & 0o111);
});

test("--check with missing output fails without creating directories or files", () => {
  const root = fixture(); const before = snapshot(root);
  assert.notEqual(generate(root, "--check").status, 0);
  assert.deepEqual(snapshot(root), before);
  assert.ok(!existsSync(join(root, "harness/codex")));
});

for (const [name, corrupt] of [
  ["content corruption", (root) => put(root, `${TREE}/skills/alpha/SKILL.md`, "corrupt\n")],
  ["stray file", (root) => put(root, `${TREE}/extra.txt`, "stray\n")],
  ["missing file", (root) => rmSync(join(root, TREE, "LICENSE"))],
  ["executable bit drift", (root) => chmodSync(join(root, TREE, "skills/beta/scripts/run.sh"), 0o644)],
]) {
  test(`--check detects ${name} without writing`, () => {
    const root = fixture(); success(root); corrupt(root); const before = snapshot(root);
    assert.notEqual(generate(root, "--check").status, 0);
    assert.deepEqual(snapshot(root), before);
    success(root); success(root, "--check");
  });
}

for (const [name, bad] of [
  ["mismatched name", (s) => s.replace("name: beta", "name: other")],
  ["missing frontmatter", (s) => s.replace(/^---[\s\S]*?---\n/, "")],
  ["unknown field", (s) => s.replace("name: beta", "name: beta\nnew-host-tool: enabled")],
  ["duplicate field", (s) => s.replace("name: beta", "name: beta\nname: beta")],
  ["invalid invocation boolean", (s) => s.replace("disable-model-invocation: false", "disable-model-invocation: maybe")],
]) {
  test(`rejects ${name} before changing output`, () => {
    const root = fixture(); success(root);
    put(root, "pstack/skills/beta/SKILL.md", bad(read(root, "pstack/skills/beta/SKILL.md")));
    const before = snapshot(root);
    assert.notEqual(generate(root).status, 0);
    assert.deepEqual(snapshot(root), before);
  });
}

test("missing adapter mapping blocks generation without altering output", () => {
  const root = fixture(); success(root);
  put(root, "pstack/docs/harness/codex.md", ADAPTER.replace("| todolist | mapped |\n", ""));
  const before = snapshot(root); const result = generate(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /no row for todolist/);
  assert.deepEqual(snapshot(root), before);
});

test("dangling and escaping relative links block output writes", () => {
  for (const href of ["missing.md", "../../../../outside.md", '<missing.md> "title"', '<../../../../outside.md> "title"']) {
    const root = fixture(); success(root);
    put(root, "pstack/skills/beta/SKILL.md", `${read(root, "pstack/skills/beta/SKILL.md")}\n[bad](${href})\n`);
    const before = snapshot(root);
    assert.notEqual(generate(root).status, 0);
    assert.deepEqual(snapshot(root), before);
  }
});

test("Codex coverage keys include every upstream CC generator mapping key", () => {
  const source = readFileSync(join(REPO, "scripts/generate-pstack-harness-trees.mjs"), "utf8");
  const upstreamKeys = [...source.matchAll(/key: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  assert.ok(upstreamKeys.length > 15);
  const own = new Set(terms.stdout.trim().split("\n"));
  for (const key of upstreamKeys) assert.ok(own.has(key), `missing upstream term ${key}`);
});

test("successful CC and Pi generation leaves the Codex tree untouched", () => {
  const root = fixture();
  put(root, "pstack/skills/alpha/SKILL.md", read(root, "pstack/skills/alpha/SKILL.md").replace(" [kit](../../../cursor-team-kit/skills/control-ui/SKILL.md)", ""));
  for (const host of ["claude-code", "pi"]) {
    put(root, `pstack/docs/harness/${host}.md`, ADAPTER.replace("\nSee [example](codex/examples/models.md).\n", ""));
  }
  success(root);
  const before = snapshot(join(root, TREE));
  for (const script of ["generate-pstack-harness-trees.mjs", "generate-pi-harness.mjs"]) {
    cpSync(join(REPO, "scripts", script), join(root, "scripts", script));
    const result = spawnSync(process.execPath, [join(root, "scripts", script)], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, `${script}: ${result.stdout}${result.stderr}`);
    assert.deepEqual(snapshot(join(root, TREE)), before);
  }
  const cc = snapshot(join(root, "harness/pstack"));
  const pi = snapshot(join(root, "harness/pi"));
  success(root);
  assert.deepEqual(snapshot(join(root, "harness/pstack")), cc);
  assert.deepEqual(snapshot(join(root, "harness/pi")), pi);
});


test("rewrites titled and angle-wrapped links without losing link presentation", () => {
  const root = fixture();
  put(root, "pstack/skills/beta/SKILL.md", `${read(root, "pstack/skills/beta/SKILL.md")}\n[one](<../../automations/only-cursor.md#anchor> "A title")\n[two](../../automations/only-cursor.md 'Another title')\n`);
  success(root);
  const beta = read(root, `${TREE}/skills/beta/SKILL.md`);
  assert.ok(beta.includes('[one](<https://github.com/cursor/plugins/blob/main/pstack/automations/only-cursor.md#anchor> "A title")'));
  assert.ok(beta.includes("[two](https://github.com/cursor/plugins/blob/main/pstack/automations/only-cursor.md 'Another title')"));
});

test("Codex marketplace selects the generated plugin and both manifests agree", () => {
  const marketplace = JSON.parse(read(REPO, ".agents/plugins/marketplace.json"));
  const entry = marketplace.plugins.find((plugin) => plugin.name === "pstack");
  assert.ok(entry, "pstack marketplace entry must exist");
  assert.deepEqual(entry.source, { source: "local", path: `./${TREE}` });
  const portable = JSON.parse(read(REPO, `${TREE}/plugin.json`));
  const compatibility = JSON.parse(read(REPO, `${TREE}/.codex-plugin/plugin.json`));
  assert.equal(portable.name, entry.name);
  assert.equal(compatibility.name, entry.name);
  assert.equal(portable.version, JSON.parse(read(REPO, "pstack/plugin.json")).version);
  assert.equal(compatibility.version, portable.version);
  assert.equal(compatibility.skills, "./skills/");
  assert.ok(existsSync(join(REPO, TREE, compatibility.skills)));
  assert.ok(!("skills" in portable), "portable manifest uses fixed skills/ discovery");
});


test("rejects source symlinks before reading or changing output", () => {
  for (const target of ["pstack", "pstack/skills", "pstack/skills/beta", "pstack/skills/beta/SKILL.md", "pstack/README.md", "pstack/plugin.json", "pstack/docs/harness/codex.md", "pstack/docs/harness/codex"]) {
    const root = fixture(); success(root);
    const before = snapshot(join(root, TREE));
    const outside = mkdtempSync(join(tmpdir(), "codex-harness-outside-")); temps.push(outside);
    renameSync(join(root, target), join(outside, "source"));
    symlinkSync(join(outside, "source"), join(root, target));
    const sourceBefore = snapshot(outside);
    for (const args of [[], ["--check"]]) {
      const result = generate(root, ...args);
      assert.notEqual(result.status, 0, `accepted source symlink ${target}`);
      assert.match(result.stdout + result.stderr, /symbolic link/);
      assert.deepEqual(snapshot(join(root, TREE)), before);
      assert.deepEqual(snapshot(outside), sourceBefore);
    }
  }
});

test("rejects dangling source symlinks instead of silently omitting them", () => {
  const root = fixture(); success(root);
  const before = snapshot(join(root, TREE));
  symlinkSync(join(root, "absent"), join(root, "pstack/skills/dangling"));
  assert.notEqual(generate(root).status, 0);
  assert.deepEqual(snapshot(join(root, TREE)), before);
});

test("rejects output symlinks and their ancestors without deleting external files", () => {
  for (const target of ["harness", "harness/codex", TREE, `${TREE}/docs`]) {
    const root = fixture(); success(root);
    const outside = mkdtempSync(join(tmpdir(), "codex-harness-output-outside-")); temps.push(outside);
    const rest = relative(target, TREE);
    const sentinel = rest.startsWith("..") ? "sentinel.txt" : join(rest, "sentinel.txt");
    put(outside, sentinel, "must survive\n");
    rmSync(join(root, target), { recursive: true, force: true });
    symlinkSync(outside, join(root, target));
    const before = snapshot(outside);
    for (const args of [[], ["--check"]]) {
      const result = generate(root, ...args);
      assert.notEqual(result.status, 0, `accepted output symlink ${target}`);
      assert.match(result.stdout + result.stderr, /symbolic link/);
      assert.deepEqual(snapshot(outside), before);
      assert.ok(lstatSync(join(root, target)).isSymbolicLink());
    }
  }
});

test("rejects a dangling output ancestor even when OUT does not exist", () => {
  const root = fixture();
  const missing = join(root, "missing-output");
  symlinkSync(missing, join(root, "harness/codex"));
  for (const args of [[], ["--check"]]) {
    const result = generate(root, ...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /symbolic link/);
    assert.ok(!existsSync(missing));
    assert.ok(lstatSync(join(root, "harness/codex")).isSymbolicLink());
  }
});

for (const declaration of ["allowed_tools: [Shell]", "AllowedTools: [Shell]", '"allowed_tools": [Shell]', "'allowed_tools': [Shell]", '"name": beta', "name beta", "? complex-key", "  hidden_key: true"]) {
  test(`rejects unsupported or duplicate YAML declaration ${declaration}`, () => {
    const root = fixture(); success(root);
    const src = "pstack/skills/beta/SKILL.md";
    put(root, src, read(root, src).replace("name: beta", `name: beta\n${declaration}`));
    const before = snapshot(join(root, TREE));
    assert.notEqual(generate(root).status, 0);
    assert.deepEqual(snapshot(join(root, TREE)), before);
  });
}

test("validates agent underscore fields and accepts supported quoted keys and multiline values", () => {
  const root = fixture(); success(root);
  const agent = "pstack/agents/poteto-agent.md";
  put(root, agent, read(root, agent).replace("is_background: true", "is_background: maybe"));
  assert.notEqual(generate(root).status, 0);
  put(root, agent, read(root, agent).replace("is_background: maybe", '"is_background": false'));
  const skill = "pstack/skills/beta/SKILL.md";
  put(root, skill, read(root, skill).replace("name: beta", '"name": beta').replace("description: Beta fixture.", 'description: >-\n  Beta fixture spans\n  several lines.\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"'));
  success(root); success(root, "--check");
  assert.ok(read(root, `${TREE}/skills/beta/SKILL.md`).includes('paths:\n  - "**/*.ts"'));
});
