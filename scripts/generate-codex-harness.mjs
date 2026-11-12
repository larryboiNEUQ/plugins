#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, lstatSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const PSTACK = join(ROOT, "pstack");
const SKILLS = join(PSTACK, "skills");
const OUT = join(ROOT, "harness", "codex", "pstack");
const GUIDE = "docs/guide";
const ADAPTER = "docs/harness/codex.md";
const COMMAND = "node scripts/generate-codex-harness.mjs";
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

const CODEX_NOTICE = (href) =>
  `In Codex, read [the Codex adapter](${href}) before following this skill. ` +
  "It overrides Cursor tool names, paths, model selection, and unsupported features below.";
const CODEX_README_NOTE =
  "This is the generated Codex edition of pstack. Keep this directory together when installing it. " +
  "Its skills retain their upstream names under the pstack plugin namespace. " +
  "Personal model choices remain outside the package in ~/.codex/pstack-models.md; generation never writes user configuration. " +
  "Agent Markdown files are instruction bodies, not registered native Codex agent types.";
const CODEX_AGENT_NOTE =
  "In Codex, read [the Codex adapter](../docs/harness/codex.md) before following this agent. " +
  "This file is an instruction body, not a registered native Codex agent type. " +
  "Use the caller-supplied absolute path to this package's skills/poteto-mode/SKILL.md when that skill is required. " +
  "If it is missing, locate this installed package from the active skills catalog rather than a Cursor cache. " +
  "Report a missing package path before working. The adapter overrides Cursor-specific instructions below.";

function safeStat(path) {
  const local = relative(ROOT, path);
  if (isAbsolute(local) || local.split(/[\\/]/)[0] === "..") throw new Error(`Path escapes repository: ${path}`);
  let current = ROOT;
  let info = lstatSync(ROOT);
  for (const part of local.split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    try { info = lstatSync(current); }
    catch (error) {
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

// Validate every source and output component before any read or destructive write.
walk(PSTACK);
if (safeStat(OUT)) walk(OUT);

const skills = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));

function classify(skill) {
  const dir = join(SKILLS, skill);
  const rest = skills.filter((name) => name !== skill).join("|");
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

function insertAfterH1(text, paragraph) {
  if (/^# /m.test(text)) return text.replace(/^(# .*)\n+/m, `$1\n\n${paragraph}\n\n`);
  if (text.startsWith("---\n")) return text.replace(/^(---\n[\s\S]*?\n---)\n*/, `$1\n\n${paragraph}\n\n`);
  return `${paragraph}\n\n${text}`;
}


const problems = [];
const SKILL_FIELDS = new Set(["name", "description", "disable-model-invocation", "icon", "color", "paths"]);
function validateHeader(text, label, allowed) {
  const header = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  const fields = new Map();
  if (header === undefined) {
    problems.push(`${label} has no complete frontmatter`);
    return fields;
  }
  let continuation;
  for (const line of header.split("\n")) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\s/.test(line)) {
      if (continuation === "block") continue;
      if (continuation === "paths" && /^ +-[ \t]+\S/.test(line)) continue;
      problems.push(`${label} has unsupported indented frontmatter declaration ${line.trim()}`);
      continue;
    }
    continuation = undefined;
    const declaration = line.match(/^(?:([A-Za-z_][A-Za-z0-9_-]*)|"([^"\\]+)"|'([^']+)')[ \t]*:[ \t]*(.*)$/);
    if (!declaration) {
      problems.push(`${label} has unsupported frontmatter declaration ${line}`);
      continue;
    }
    const key = declaration[1] ?? declaration[2] ?? declaration[3];
    const value = declaration[4].trim();
    if (!allowed.has(key)) problems.push(`${label} has unmapped frontmatter field ${key}`);
    if (fields.has(key)) problems.push(`${label} repeats frontmatter field ${key}`);
    fields.set(key, value);
    if (key === "description" && /^[>|][+-]?$/.test(value)) continuation = "block";
    if (key === "paths" && value === "") continuation = "paths";
    if (key !== "paths" && value === "") problems.push(`${label} has empty frontmatter field ${key}`);
    if (/^[&*!{]/.test(value)) problems.push(`${label} has unsupported frontmatter value for ${key}`);
  }
  if (!fields.get("description")) problems.push(`${label} has no description`);
  for (const key of ["disable-model-invocation", "is_background"]) {
    if (fields.has(key) && !["true", "false"].includes(fields.get(key))) {
      problems.push(`${label} has non-boolean ${key}`);
    }
  }
  return fields;
}

for (const [skill, { usesCursorNames, wrap }] of classes) {
  if (usesCursorNames.size > 0 && !wrap) problems.push(`skills/${skill}/SKILL.md uses Cursor names but has no H1`);
  const frontmatter = validateHeader(readFileSync(join(SKILLS, skill, "SKILL.md"), "utf8"), `skills/${skill}/SKILL.md`, SKILL_FIELDS);
  const name = frontmatter.get("name")?.replace(/^(["'])(.*)\1$/, "$2");
  if (name !== skill) problems.push(`skills/${skill}/SKILL.md has name ${JSON.stringify(name ?? "")}, not its folder name ${skill}`);
  if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push(`skills/${skill} is not lowercase words joined by hyphens, at most 64 characters`);
}
for (const path of walk(join(PSTACK, "agents")).filter((path) => path.endsWith(".md"))) {
  validateHeader(readFileSync(path, "utf8"), relative(PSTACK, path), new Set(["name", "description", "is_background"]));
}
const adapter = readFileSync(join(PSTACK, ADAPTER), "utf8");
const users = new Map();
for (const [skill, { usesCursorNames }] of classes) {
  for (const key of usesCursorNames) users.set(key, [...(users.get(key) ?? []), skill]);
}
for (const [key, using] of users) {
  if (!adapter.includes(key)) problems.push(`Codex adapter has no row for ${key}, used by ${using.join(", ")}`);
}
for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);

// The repo-relative path that a relative link in `from` points at, if that path exists.
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

// Skills read the adapter, the guide, and the README at runtime, so generated hosts never fetch them.
const errors = [];
const files = new Map();
const placed = new Map();
function put(emitted, src, override) {
  if (files.has(emitted) && files.get(emitted).src !== src) {
    errors.push(`codex/${emitted} is emitted by both ${files.get(emitted).src} and ${src}`);
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
  for (const path of walk(join(SKILLS, skill))) {
    put(`skills/${skill}/${relative(join(SKILLS, skill), path)}`, relative(ROOT, path));
  }
}
for (const path of walk(join(PSTACK, "agents"))) {
  const src = relative(ROOT, path);
  const emitted = `agents/${relative(join(PSTACK, "agents"), path)}`;
  put(emitted, src, emitted.endsWith(".md")
    ? (entry) => { entry.bytes = Buffer.from(insertAfterH1(entry.bytes.toString("utf8"), CODEX_AGENT_NOTE)); }
    : undefined);
}
for (const path of walk(join(PSTACK, GUIDE))) {
  put(`${GUIDE}/${relative(join(PSTACK, GUIDE), path)}`, relative(ROOT, path));
}
put(ADAPTER, `pstack/${ADAPTER}`);
put("README.md", "pstack/README.md");
put("LICENSE", "pstack/LICENSE");
const extras = join(PSTACK, "docs/harness/codex");
if (existsSync(extras)) {
  for (const path of walk(extras)) put(relative(PSTACK, path), relative(ROOT, path));
}
const plugin = JSON.parse(readFileSync(join(PSTACK, "plugin.json"), "utf8"));
const manifest = {
  name: plugin.name,
  version: plugin.version,
  description: plugin.description ?? "pstack workflows adapted for Codex.",
  skills: "./skills/",
};
put(".codex-plugin/plugin.json", "pstack/plugin.json", {
  bytes: Buffer.from(JSON.stringify(manifest, null, 2) + "\n"), executable: false,
});
put("plugin.json", "pstack/plugin.json");

for (const skill of skills) {
  const emitted = `skills/${skill}/SKILL.md`;
  const entry = files.get(emitted);
  entry.bytes = Buffer.from(insertAfterH1(entry.bytes.toString("utf8"),
    CODEX_NOTICE(posix.relative(posix.dirname(emitted), ADAPTER))));
}
for (const emitted of ["README.md", ...[...files.keys()].filter((key) => key.startsWith(`${GUIDE}/`) && key.endsWith(".md"))]) {
  const notice = CODEX_NOTICE(posix.relative(posix.dirname(emitted), ADAPTER));
  const entry = files.get(emitted);
  entry.bytes = Buffer.from(insertAfterH1(entry.bytes.toString("utf8"), emitted === "README.md" ? `${notice}\n\n${CODEX_README_NOTE}` : notice));
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

// The tree installs only itself, so a relative link that works from its source has to work inside the tree too.
// Links to source files that the tree leaves out already point at GitHub, so a failure here is a link that escapes the tree.
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
      dangling.push(`harness/codex/pstack/${path} links to ${href}, which escapes the tree`);
    } else if (!has(files, resolved)) {
      const source = entry.src ? resolve(entry.src, href) : undefined;
      if (source) {
        dangling.push(`harness/codex/pstack/${path} links to ${href}, which is not in the tree`);
      } else if (/[./]/.test(linkPath)) {
        dangling.push(`harness/codex/pstack/${path} links to ${href}, which does not exist`);
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
  for (const path of drifted.slice(0, 20)) console.log(`harness/codex/pstack/${path}`);
  if (drifted.length > 0) {
    console.log(`harness/codex/pstack is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exit(1);
  }
  console.log("harness/codex/pstack is up to date.");
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of rendered) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  const noticed = skills.length;
  console.log(`${skills.length} skills, ${noticed} SKILL.md files with the adapter line`);
}
