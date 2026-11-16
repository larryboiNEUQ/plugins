#!/usr/bin/env node

import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const PSTACK = join(ROOT, "pstack");
const SKILLS = join(PSTACK, "skills");
const KIT = join(ROOT, "cursor-team-kit");
const OUT = join(ROOT, "harness", "agy", "pstack");
const GUIDE = "docs/guide";
const ADAPTER = "docs/harness/agy.md";
const COMMAND = "node scripts/generate-agy-harness.mjs";
const GITHUB = "https://github.com/cursor/plugins";
const LINK = /\]\(<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;

const TERMS = [
  { key: "`Task`", re: /`Task`|\bTask (tool|subagent|call)/ },
  { key: "`AskQuestion`", re: /AskQuestion/ },
  { key: "todolist", re: /\btodo ?list\b/i },
  { key: "generalPurpose", re: /generalPurpose/ },
  { key: "poteto-agent", re: /poteto-agent/ },
  { key: "comment-sicko", re: /comment-sicko/ },
  { key: "`readonly: true`", re: /readonly: (true|false)|readonly\/Ask/ },
  { key: "`environment: \"cloud\"`", re: /environment: "(cloud|local)"/ },
  { key: "cloud_base_branch", re: /cloud_base_branch/ },
  { key: "`run_in_background: true`", re: /run_in_background/ },
  { key: "`resume`", re: /`resume`/ },
  { key: "`file_attachments`", re: /file_attachments/ },
  { key: "claude-", re: /\bclaude-[a-z]+-\d/ },
  { key: "grok-", re: /\bgrok-\d/ },
  { key: "gpt-", re: /\bgpt-\d/ },
  { key: "inherit-parent", re: /inherit-parent/ },
  { key: "pstack-models.mdc", re: /pstack-models\.mdc/ },
  { key: ".cursor/skills/", re: /\.cursor\/skills/ },
  { key: "~/.cursor/plugins/", re: /\.cursor\/plugins|\.cursor-plugin/ },
  { key: ".cursor/rules/", re: /\.cursor\/rules|always-applied rule/ },
  { key: "agent-transcripts", re: /agent-transcripts|\.cursor\/projects/ },
  { key: "Cursor-only features", re: /Bugbot|Cursor [Aa]utomation|cursor\.(sh|com)\/automations|[Cc]loud [Aa]gent|built-in PR tool/ },
];
const ROUTE_KEY = "Run another pstack skill";
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (process.argv.includes("--print-terms")) {
  console.log([...TERMS.map((term) => term.key), ROUTE_KEY].join("\n"));
  process.exit(0);
}

const EXCLUDE = new Set(["make-bot-ui"]);
const KIT_SKILLS = ["control-cli", "control-ui", "deslop"];
const SOURCE_KEYS = new Set(["name", "description", "argument-hint", "disable-model-invocation", "icon", "color", "paths"]);

const AGY_NOTICE = (href) =>
  `In Antigravity (AGY), read [the AGY adapter](${href}) before following this skill. ` +
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

function safeStat(path) {
  const local = relative(ROOT, path);
  if (isAbsolute(local) || local.split(/[\\/]/)[0] === "..") throw new Error(`Path escapes repository: ${path}`);
  let current = ROOT;
  let info = lstatSync(ROOT);
  for (const part of local.split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    try {
      info = lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${relative(ROOT, current)}`);
  }
  return info;
}

function walk(dir) {
  const info = safeStat(dir);
  if (!info?.isDirectory()) throw new Error(`Expected directory: ${relative(ROOT, dir)}`);
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    const entry = safeStat(path);
    if (entry.isDirectory()) return walk(path);
    if (!entry.isFile()) throw new Error(`Expected regular file: ${relative(ROOT, path)}`);
    return [path];
  });
}

function file(path) {
  const info = safeStat(path);
  if (!info?.isFile()) throw new Error(`Expected regular file: ${relative(ROOT, path)}`);
  return { bytes: readFileSync(path), executable: (info.mode & 0o111) !== 0 };
}

walk(PSTACK);
walk(KIT);
if (safeStat(OUT)) walk(OUT);

const skills = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));

function classify(skill, root = SKILLS, others = skills) {
  const dir = join(root, skill);
  const rest = others.filter((name) => name !== skill).join("|");
  const route = new RegExp(`the \\*\\*(?<bold>${rest})\\*\\* skill|\`/(?<command>${rest})\``, "g");
  const linksToSkill = (line, name) => line.includes(`(../${name}/`);
  const namesBareSkill = (line) =>
    [...line.matchAll(route)].some(({ groups }) => !linksToSkill(line, groups.bold ?? groups.command));
  const usesCursorNames = new Set();
  for (const path of walk(dir).filter((path) => path.endsWith(".md"))) {
    const text = readFileSync(path, "utf8");
    for (const term of TERMS) if (term.re.test(text)) usesCursorNames.add(term.key);
    if (text.split("\n").some(namesBareSkill)) usesCursorNames.add(ROUTE_KEY);
  }
  const text = readFileSync(join(dir, "SKILL.md"), "utf8");
  const wrap = usesCursorNames.size > 0 && /^# /m.test(text);
  return { usesCursorNames, wrap };
}

const classes = new Map(skills.map((skill) => [skill, classify(skill)]));
const kitClasses = new Map(
  KIT_SKILLS.map((skill) => [skill, classify(skill, join(KIT, "skills"), [...skills, ...KIT_SKILLS])]),
);

function insertAfterH1(text, paragraph) {
  if (/^# /m.test(text)) return text.replace(/^(# .*)\n+/m, `$1\n\n${paragraph}\n\n`);
  if (text.startsWith("---\n")) return text.replace(/^(---\n[\s\S]*?\n---)\n*/, `$1\n\n${paragraph}\n\n`);
  return `${paragraph}\n\n${text}`;
}

function frontmatterFields(frontmatter) {
  const fields = [];
  for (const line of frontmatter.split("\n")) {
    const key = line.match(/^([a-zA-Z0-9_-]+):/)?.[1];
    if (key) fields.push([key, line]);
    else if (fields.length > 0) fields[fields.length - 1][1] += `\n${line}`;
  }
  return fields;
}

function agyFrontmatter(text, label, problems, forceDisable = false) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    problems.push(`${label}/SKILL.md has no frontmatter`);
    return text;
  }
  const body = text.slice(match[0].length);
  const kept = [];
  const seen = new Set();
  let hasDescription = false;
  let hasDisable = false;
  for (const [key, block] of frontmatterFields(match[1])) {
    if (!SOURCE_KEYS.has(key)) {
      problems.push(`${label}/SKILL.md has unknown frontmatter key ${key}`);
      continue;
    }
    if (seen.has(key)) {
      problems.push(`${label}/SKILL.md repeats frontmatter key ${key}`);
      continue;
    }
    seen.add(key);
    if (key === "description") {
      const val = block.replace(/^description:\s*/, "").trim();
      if (val.length > 0) hasDescription = true;
    }
    if (key === "disable-model-invocation") {
      const val = block.replace(/^disable-model-invocation:\s*/, "").trim();
      if (!["true", "false"].includes(val)) {
        problems.push(`${label}/SKILL.md has non-boolean disable-model-invocation`);
      }
      hasDisable = true;
      kept.push(forceDisable ? "disable-model-invocation: true" : block);
      continue;
    }
    if (key === "icon" || key === "color" || key === "paths") continue;
    kept.push(block);
  }
  if (!hasDescription) problems.push(`${label}/SKILL.md has no description`);
  if (forceDisable && !hasDisable) kept.push("disable-model-invocation: true");
  return `---\n${kept.join("\n")}\n---${body}`;
}

function agyAgent(src, problems) {
  const fullPath = join(PSTACK, "agents", src);
  const text = readFileSync(fullPath, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    problems.push(`agents/${src} has no frontmatter`);
    return text;
  }
  const keep = {};
  for (const [key, block] of frontmatterFields(match[1])) {
    if (key === "name" || key === "description") keep[key] = block;
  }
  const expectedName = src.replace(/\.md$/, "");
  const actualName = keep.name?.replace(/^name:\s*/, "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (actualName !== expectedName) {
    problems.push(`agents/${src} has name ${JSON.stringify(actualName ?? "")}, expected ${expectedName}`);
  }
  if (!keep.description || !keep.description.replace(/^description:\s*/, "").trim()) {
    problems.push(`agents/${src} has no description`);
  }
  const body = text.replace(/^---\n[\s\S]*?\n---\n*/, "");
  const header = `---\n${keep.name ?? `name: ${expectedName}`}\n${keep.description ?? "description:"}\n---`;
  return insertAfterH1(`${header}\n\n${body}`, AGY_AGENT_NOTE);
}

const problems = [];
for (const [skill, { usesCursorNames, wrap }] of classes) {
  if (EXCLUDE.has(skill)) continue;
  if (usesCursorNames.size > 0 && !wrap) problems.push(`skills/${skill}/SKILL.md uses Cursor names but has no H1`);
  const frontmatter = readFileSync(join(SKILLS, skill, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  if (name !== skill) problems.push(`skills/${skill}/SKILL.md has name ${JSON.stringify(name ?? "")}, not its folder name ${skill}`);
  if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push(`skills/${skill} is not lowercase words joined by hyphens, at most 64 characters`);
}
for (const [skill, { usesCursorNames, wrap }] of kitClasses) {
  const label = `cursor-team-kit/skills/${skill}`;
  if (usesCursorNames.size > 0 && !wrap) problems.push(`${label}/SKILL.md uses Cursor names but has no H1`);
  const frontmatter = readFileSync(join(KIT, "skills", skill, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  if (name !== skill) problems.push(`${label}/SKILL.md has name ${JSON.stringify(name ?? "")}, not its folder name ${skill}`);
  if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push(`${label} is not lowercase words joined by hyphens, at most 64 characters`);
}
if (!safeStat(join(PSTACK, ADAPTER))?.isFile()) {
  problems.push(`Missing adapter file pstack/${ADAPTER}`);
} else {
  const adapter = readFileSync(join(PSTACK, ADAPTER), "utf8");
  const users = new Map();
  for (const [skill, { usesCursorNames }] of classes) {
    if (EXCLUDE.has(skill)) continue;
    for (const key of usesCursorNames) users.set(key, [...(users.get(key) ?? []), skill]);
  }
  for (const [skill, { usesCursorNames }] of kitClasses) {
    for (const key of usesCursorNames) users.set(key, [...(users.get(key) ?? []), `cursor-team-kit/${skill}`]);
  }
  for (const [key, using] of users) {
    if (!adapter.includes(key)) problems.push(`AGY adapter has no row for ${key}, used by ${using.join(", ")}`);
  }
}
for (const skill of [...skills.filter((name) => !EXCLUDE.has(name)), ...KIT_SKILLS]) {
  const isKit = KIT_SKILLS.includes(skill);
  const root = isKit ? join(KIT, "skills") : SKILLS;
  agyFrontmatter(readFileSync(join(root, skill, "SKILL.md"), "utf8"), `skills/${skill}`, problems, isKit);
}
for (const agentFile of ["poteto-agent.md", "comment-sicko.md"]) {
  agyAgent(agentFile, problems);
}
for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);

function resolve(from, href) {
  const target = href.replace(/[#?].*/, "");
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  const path = posix.join(posix.dirname(from), target).replace(/\/$/, "");
  if (path === ".." || path.startsWith("../")) return undefined;
  return safeStat(join(ROOT, path)) ? path : undefined;
}

function has(files, path) {
  return files.has(path) || [...files.keys()].some((key) => key.startsWith(`${path}/`));
}

const errors = [];
const files = new Map();
const placed = new Map();
function put(emitted, src, override) {
  if (files.has(emitted) && files.get(emitted).src !== src) {
    errors.push(`agy/${emitted} is emitted by both ${files.get(emitted).src} and ${src}`);
    return;
  }
  const entry = { ...file(join(ROOT, src)), src };
  if (typeof override === "function") override(entry);
  else if (override) Object.assign(entry, override);
  files.set(emitted, entry);
  let [s, e] = [src, emitted];
  placed.set(s, e);
  while (posix.dirname(s) !== "." && posix.dirname(e) !== ".") {
    [s, e] = [posix.dirname(s), posix.dirname(e)];
    placed.set(s, e);
  }
}

for (const skill of skills) {
  if (EXCLUDE.has(skill)) continue;
  for (const path of walk(join(SKILLS, skill))) {
    put(`skills/${skill}/${relative(join(SKILLS, skill), path)}`, relative(ROOT, path));
  }
}
for (const name of KIT_SKILLS) {
  for (const path of walk(join(KIT, "skills", name))) {
    put(`skills/${name}/${relative(join(KIT, "skills", name), path)}`, relative(ROOT, path));
  }
}
put("agents/poteto-agent.md", "pstack/agents/poteto-agent.md", {
  bytes: Buffer.from(agyAgent("poteto-agent.md", [])),
  executable: false,
});
put("agents/comment-sicko.md", "pstack/agents/comment-sicko.md", {
  bytes: Buffer.from(agyAgent("comment-sicko.md", [])),
  executable: false,
});
for (const path of walk(join(PSTACK, GUIDE))) {
  put(`${GUIDE}/${relative(join(PSTACK, GUIDE), path)}`, relative(ROOT, path));
}
put(ADAPTER, `pstack/${ADAPTER}`);
const extras = join(PSTACK, "docs/harness/agy");
if (safeStat(extras)?.isDirectory()) {
  for (const path of walk(extras)) put(relative(PSTACK, path), relative(ROOT, path));
}
const assetsDir = join(PSTACK, "assets");
const hasLogo = Boolean(safeStat(join(assetsDir, "logo.png"))?.isFile());
if (safeStat(assetsDir)?.isDirectory()) {
  for (const path of walk(assetsDir)) {
    put(`assets/${relative(assetsDir, path)}`, relative(ROOT, path));
  }
}
put("README.md", "pstack/README.md");
put("LICENSE", "pstack/LICENSE");
put("LICENSE-cursor-team-kit", "cursor-team-kit/LICENSE");

const plugin = JSON.parse(readFileSync(join(PSTACK, "plugin.json"), "utf8"));
const manifest = {
  name: "pstack",
  version: plugin.version,
  description: plugin.description ?? "pstack native Antigravity (AGY) edition",
  author: plugin.author ?? { name: "Lauren Tan" },
  homepage: plugin.homepage ?? "https://github.com/cursor/plugins/tree/main/pstack",
  repository: plugin.repository ?? "https://github.com/cursor/plugins",
  license: plugin.license ?? "MIT",
  ...(hasLogo ? { logo: "assets/logo.png" } : {}),
};
put("plugin.json", "pstack/plugin.json", {
  bytes: Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
  executable: false,
});

for (const skill of [...skills.filter((name) => !EXCLUDE.has(name)), ...KIT_SKILLS]) {
  const isKit = KIT_SKILLS.includes(skill);
  const emitted = `skills/${skill}/SKILL.md`;
  const entry = files.get(emitted);
  entry.bytes = Buffer.from(
    insertAfterH1(
      agyFrontmatter(entry.bytes.toString("utf8"), emitted, [], isKit),
      AGY_NOTICE(posix.relative(posix.dirname(emitted), ADAPTER)),
    ),
  );
}
for (const emitted of ["README.md", ...[...files.keys()].filter((key) => key.startsWith(`${GUIDE}/`) && key.endsWith(".md"))]) {
  const notice = AGY_NOTICE(posix.relative(posix.dirname(emitted), ADAPTER));
  const entry = files.get(emitted);
  entry.bytes = Buffer.from(
    insertAfterH1(entry.bytes.toString("utf8"), emitted === "README.md" ? `${notice}\n\n${AGY_README_NOTE}` : notice),
  );
}

for (const [emitted, entry] of files) {
  if (!emitted.endsWith(".md") || !entry.src) continue;
  entry.bytes = Buffer.from(entry.bytes.toString("utf8").replace(LINK, (link, href) => {
    const source = resolve(entry.src, href);
    if (!source || source.split("/")[0] === "..") return link;
    const suffix = href.slice(href.search(/[#?]|$/));
    const mapped = placed.get(source);
    if (mapped !== undefined) {
      const current = posix.join(posix.dirname(emitted), href.replace(/[#?].*/, "")).replace(/\/$/, "");
      if (current === mapped) return link;
      return link.replace(href, `${posix.relative(posix.dirname(emitted), mapped)}${suffix}`);
    }
    const kind = safeStat(join(ROOT, source)).isDirectory() ? "tree" : "blob";
    return link.replace(href, `${GITHUB}/${kind}/main/${source}${suffix}`);
  }));
}

const rendered = new Map();
const dangling = [];
for (const [path, entry] of files) {
  rendered.set(path, entry);
  if (!path.endsWith(".md")) continue;
  for (const [, href] of entry.bytes.toString("utf8").matchAll(LINK)) {
    const linkPath = href.replace(/[#?].*/, "");
    if (!linkPath || /^[a-z][a-z0-9+.-]*:/i.test(linkPath)) continue;
    const resolved = posix.join(posix.dirname(path), linkPath).replace(/\/$/, "");
    if (resolved.split("/")[0] === "..") {
      dangling.push(`harness/agy/pstack/${path} links to ${href}, which escapes the tree`);
    } else if (!has(files, resolved)) {
      const source = entry.src ? resolve(entry.src, href) : undefined;
      if (source) {
        dangling.push(`harness/agy/pstack/${path} links to ${href}, which is not in the tree`);
      } else if (/[./]/.test(linkPath)) {
        dangling.push(`harness/agy/pstack/${path} links to ${href}, which does not exist`);
      }
    }
  }
}
for (const problem of [...errors, ...dangling]) console.log(`FAIL ${problem}`);
if (errors.length + dangling.length > 0) process.exit(1);

if (safeStat(OUT)) walk(OUT);

if (process.argv.includes("--check")) {
  const onDisk = new Map(existsSync(OUT) ? walk(OUT).map((path) => [relative(OUT, path), file(path)]) : []);
  const drifted = [...new Set([...rendered.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [rendered.get(path), onDisk.get(path)];
    return !want || !have || !want.bytes.equals(have.bytes) || want.executable !== have.executable;
  });
  for (const path of drifted.slice(0, 20)) console.log(`harness/agy/pstack/${path}`);
  if (drifted.length > 0) {
    console.log(`harness/agy/pstack is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exit(1);
  }
  console.log("harness/agy/pstack is up to date.");
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of rendered) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  const noticed = skills.filter((name) => !EXCLUDE.has(name)).length + KIT_SKILLS.length;
  console.log(`${skills.length} skills, ${noticed} SKILL.md files with the adapter line`);
}
