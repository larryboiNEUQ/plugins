#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_SKILLS = join(REPO, "harness", "pi", "pstack", "skills");

const SDK_PATH = process.env.PI_HARNESS_SDK;
assert.ok(
  SDK_PATH,
  "PI_HARNESS_SDK is not set. Point it at the absolute path of the @earendil-works/pi-coding-agent module entry point, " +
    "for example /path/to/node_modules/@earendil-works/pi-coding-agent/dist/index.js",
);
const pi = await import(pathToFileURL(SDK_PATH).href);
const sdkRequire = createRequire(SDK_PATH);
const piTui = await import(pathToFileURL(sdkRequire.resolve("@earendil-works/pi-tui")).href);

const temps = [];
const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
process.once("exit", () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const isUnder = (child, root) => {
  const real = realpathSync(child);
  const parent = realpathSync(root);
  return real === parent || real.startsWith(parent + sep);
};

const external = temp("pi-harness-external-");
const externalSkills = join(external, "skills");
for (const name of ["tdd", "teach", "poteto-mode", "how", "control-cli", "deslop"]) {
  const dir = join(externalSkills, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: External ${name} fixture skill.\n---\n\nIndependent ${name} fixture body.\n`,
  );
}

const fixture = temp("pi-harness-sdk-");
const agentDir = join(fixture, "agent");
writeFileSync(join(fixture, "auth.json"), "{}");

const { skills, diagnostics } = pi.loadSkills({
  cwd: fixture,
  agentDir,
  skillPaths: [GENERATED_SKILLS, externalSkills],
  includeDefaults: false,
});

const emitted = readdirSync(GENERATED_SKILLS)
  .filter((name) => {
    try {
      return readdirSync(join(GENERATED_SKILLS, name)).includes("SKILL.md");
    } catch {
      return false;
    }
  })
  .sort();

const modelRuntime = await pi.ModelRuntime.create({
  authPath: join(fixture, "auth.json"),
  modelsPath: null,
  allowModelNetwork: false,
  refreshOnCreate: false,
});
const settingsManager = pi.SettingsManager.inMemory();
const resourceLoader = new pi.DefaultResourceLoader({
  cwd: fixture,
  agentDir,
  settingsManager,
  noExtensions: true,
  noSkills: true,
  additionalSkillPaths: [GENERATED_SKILLS, externalSkills],
});
await resourceLoader.reload();

test("loader reports no generated errors or collisions", () => {
  const bad = diagnostics.filter((d) => {
    if (d.type === "collision") {
      return [d.collision?.winnerPath, d.collision?.loserPath].some(
        (p) => p && isUnder(p, GENERATED_SKILLS),
      );
    }
    return d.path && isUnder(d.path, GENERATED_SKILLS);
  });
  assert.deepEqual(bad, [], `diagnostics for generated skills: ${JSON.stringify(bad, null, 2)}`);
});

test("the loaded generated skill-name set equals the emitted pstack- set", () => {
  const loaded = skills
    .filter((s) => isUnder(s.baseDir, GENERATED_SKILLS))
    .map((s) => s.name)
    .sort();
  assert.deepEqual(loaded, emitted);
  assert.ok(emitted.every((n) => n.startsWith("pstack-")), "every emitted name is prefixed");
  for (const name of ["tdd", "teach", "poteto-mode", "how", "control-cli", "deslop"]) {
    const found = skills.filter((s) => s.name === name);
    assert.equal(found.length, 1, `${name} must resolve exactly once`);
    assert.ok(
      isUnder(found[0].baseDir, externalSkills),
      `external ${name} must resolve to the fixture, got ${found[0].baseDir}`,
    );
  }
});

async function expandSkill(name, arg) {
  const { session } = await pi.createAgentSession({
    cwd: fixture,
    agentDir,
    modelRuntime,
    settingsManager,
    sessionManager: pi.SessionManager.inMemory(fixture),
    resourceLoader,
    noTools: "all",
  });
  try {
    await session.steer(`/skill:${name} ${arg}`);
    const queued = session.getSteeringMessages();
    assert.equal(queued.length, 1, `/skill:${name} must queue exactly one expansion`);
    const skill = resourceLoader.getSkills().skills.find((item) => item.name === name);
    assert.ok(skill, `${name} is not visible to the session`);
    return { expanded: queued[0], skill };
  } finally {
    session.clearQueue();
    session.dispose();
  }
}

test("/skill:pstack-poteto-mode expands with identity, body, and argument", async () => {
  const arg = "literal-probe";
  const { expanded, skill } = await expandSkill("pstack-poteto-mode", arg);
  assert.equal(realpathSync(skill.filePath), realpathSync(join(GENERATED_SKILLS, "pstack-poteto-mode", "SKILL.md")));
  assert.match(expanded, /^<skill name="pstack-poteto-mode" location="[^"]+">/);
  assert.ok(
    expanded.includes("In Pi, read [the Pi adapter](../../docs/harness/pi.md) before following this skill."),
    "expanded body lost the Pi adapter notice",
  );
  assert.ok(expanded.includes("## Playbooks"), "expanded body lost the playbook section");
  assert.ok(expanded.includes(`References are relative to ${skill.baseDir}.`));
  assert.ok(expanded.endsWith(arg));
  assert.ok(!expanded.includes("/skill:pstack-poteto-mode"), "literal /skill: command must be expanded");
});

test("/skill:pstack-tdd expands with identity, body, and argument", async () => {
  const arg = "literal-probe";
  const { expanded, skill } = await expandSkill("pstack-tdd", arg);
  assert.equal(realpathSync(skill.filePath), realpathSync(join(GENERATED_SKILLS, "pstack-tdd", "SKILL.md")));
  assert.match(expanded, /^<skill name="pstack-tdd" location="[^"]+">/);
  assert.ok(expanded.includes(`References are relative to ${skill.baseDir}.`));
  assert.ok(expanded.includes("# TDD Bug Fix"), "expanded body lost the TDD heading");
  assert.ok(expanded.includes("## Workflow"), "expanded body lost the TDD workflow section");
  assert.ok(expanded.endsWith(arg));
  assert.ok(!expanded.includes("/skill:pstack-tdd"), "literal /skill: command must be expanded");
});

test("/skill:pstack-teach expands with identity, body, and argument", async () => {
  const arg = "literal-probe";
  const { expanded, skill } = await expandSkill("pstack-teach", arg);
  assert.equal(realpathSync(skill.filePath), realpathSync(join(GENERATED_SKILLS, "pstack-teach", "SKILL.md")));
  assert.match(expanded, /^<skill name="pstack-teach" location="[^"]+">/);
  assert.ok(expanded.includes("# Teach"), "expanded body lost the Teach heading");
  assert.ok(expanded.includes("Teach sits on top of"), "expanded body lost the Teach body");
  assert.ok(expanded.endsWith(arg));
  assert.ok(!expanded.includes("/skill:pstack-teach"), "literal /skill: command must be expanded");
});

test("/skill:pstack-setup-pstack expands with identity, body, and argument", async () => {
  const arg = "literal-probe";
  const { expanded, skill } = await expandSkill("pstack-setup-pstack", arg);
  assert.equal(realpathSync(skill.filePath), realpathSync(join(GENERATED_SKILLS, "pstack-setup-pstack", "SKILL.md")));
  assert.match(expanded, /^<skill name="pstack-setup-pstack" location="[^"]+">/);
  assert.ok(expanded.includes(`References are relative to ${skill.baseDir}.`));
  assert.ok(expanded.includes("# Setup pstack"), "expanded body lost the Setup heading");
  assert.ok(expanded.includes("### 1. Detect available models"), "expanded body lost the models section");
  assert.ok(expanded.includes("In Pi, read [the Pi adapter](../../docs/harness/pi.md)"), "expanded body lost the Pi notice");
  assert.ok(expanded.endsWith(arg));
  assert.ok(!expanded.includes("/skill:pstack-setup-pstack"), "literal /skill: command must be expanded");
});

test("the repository root resolves as a Pi package through settings packages", async () => {
  const pkgFixture = temp("pi-pkg-");
  const previousHome = process.env.HOME;
  process.env.HOME = pkgFixture;
  try {
    const pkgSettings = pi.SettingsManager.inMemory();
    pkgSettings.setPackages([REPO]);
    const loader = new pi.DefaultResourceLoader({
      cwd: pkgFixture,
      agentDir: join(pkgFixture, "agent"),
      settingsManager: pkgSettings,
      noExtensions: true,
    });
    await loader.reload();
    const { skills: pkgSkills, diagnostics: pkgDiagnostics } = loader.getSkills();
    assert.deepEqual(pkgDiagnostics.filter((d) => d.type === "collision"), []);
    assert.deepEqual(pkgSkills.map((s) => s.name).sort(), emitted);
    assert.ok(pkgSkills.every((s) => isUnder(s.baseDir, GENERATED_SKILLS)), "every skill loads from harness/pi/pstack/skills");
    const poteto = pkgSkills.find((s) => s.name === "pstack-poteto-mode");
    assert.ok(poteto, "pstack-poteto-mode must load from the package");
    const { createReadToolDefinition } = await import(
      pathToFileURL(join(dirname(SDK_PATH), "core/tools/read.js")).href
    );
    const res = await createReadToolDefinition(pkgFixture).execute("mapping-read", {
      path: `${poteto.baseDir}/../../docs/harness/pi.md`,
      offset: 1,
      limit: 8,
    });
    const text = typeof res === "string" ? res : res.content.map((c) => c.text ?? "").join("");
    assert.ok(text.includes("# pstack in Pi"), `mapping read failed: ${text.slice(0, 300)}`);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
  }
});

test("the real read tool resolves the Pi adapter from a prefixed skill", async () => {
  const poteto = skills.find((s) => s.name === "pstack-poteto-mode");
  assert.ok(poteto);
  const { createReadToolDefinition } = await import(
    pathToFileURL(join(dirname(SDK_PATH), "core/tools/read.js")).href
  );
  const readTool = createReadToolDefinition(fixture);
  const res = await readTool.execute("mapping-read", {
    path: `${poteto.baseDir}/../../docs/harness/pi.md`,
    offset: 1,
    limit: 8,
  });
  const text = typeof res === "string" ? res : (res?.content?.map?.((c) => c.text ?? "").join("") ?? JSON.stringify(res));
  assert.ok(text.includes("# pstack in Pi"), `mapping read failed: ${text.slice(0, 300)}`);
});

test("original-name completion offers the prefixed /skill: commands", async () => {
  const provider = new piTui.CombinedAutocompleteProvider(
    emitted.map((n) => ({ name: `skill:${n}`, description: "package skill" })),
    fixture,
  );
  for (const [query, want] of [
    ["/poteto", "skill:pstack-poteto-mode"],
    ["/setup-pstack", "skill:pstack-setup-pstack"],
    ["/tdd", "skill:pstack-tdd"],
  ]) {
    const suggestions = await provider.getSuggestions([query], 0, query.length, {});
    const items = suggestions?.items ?? [];
    const item = items.find((i) => (i.value ?? i.name) === want);
    assert.ok(item, `query ${query} must offer ${want}: ${JSON.stringify(items).slice(0, 400)}`);
    assert.ok(items.every((i) => !String(i.value ?? i.name).startsWith("skill:") || String(i.value ?? i.name).startsWith("skill:pstack-")),
      `query ${query} must not offer an unprefixed alias`);
    const applied = provider.applyCompletion([query], 0, query.length, item, suggestions.prefix);
    assert.equal(applied.lines[0], `/${want} `, `applied completion must insert the slash form`);
  }
});
