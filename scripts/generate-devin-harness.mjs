#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PSTACK = join(ROOT, "pstack");
const SKILLS = join(PSTACK, "skills");
const KIT = join(ROOT, "cursor-team-kit");
const OUT = join(ROOT, "harness", "devin", "pstack");
const GUIDE = "docs/guide";
const ADAPTER = "docs/harness/devin-cli.md";
const COMMAND = "node scripts/generate-devin-harness.mjs";
const GITHUB = "https://github.com/cursor/plugins";
const LINK = /\]\(([^)\s]+)\)/g;

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

const DEVIN_NOTICE = (href) =>
  `In Devin CLI, read [the Devin CLI adapter](${href}) before following this skill. ` +
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

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function file(path) {
  return { bytes: readFileSync(path), executable: (statSync(path).mode & 0o111) !== 0 };
}

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

// Split a frontmatter block into [key, raw-lines] pairs bounded by top-level keys.
function frontmatterFields(frontmatter) {
  const fields = [];
  for (const line of frontmatter.split("\n")) {
    const key = line.match(/^([a-zA-Z0-9_-]+):/)?.[1];
    if (key) fields.push([key, line]);
    else if (fields.length > 0) fields[fields.length - 1][1] += `\n${line}`;
  }
  return fields;
}

// Translate a Cursor SKILL.md header into native Devin frontmatter, keeping scalar/block values verbatim.
function devinFrontmatter(text, label, problems) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    problems.push(`${label}/SKILL.md has no frontmatter`);
    return text;
  }
  const body = text.slice(match[0].length);
  const kept = [];
  let disabled = false;
  for (const [key, block] of frontmatterFields(match[1])) {
    if (!SOURCE_KEYS.has(key)) {
      problems.push(`${label}/SKILL.md has unknown frontmatter key ${key}`);
      continue;
    }
    if (key === "disable-model-invocation") {
      disabled = /:\s*true/.test(block);
      continue;
    }
    if (key === "icon" || key === "color" || key === "paths") continue;
    kept.push(block);
  }
  const header = `---\n${kept.join("\n")}\ntriggers: [${disabled ? "user" : "user, model"}]\n---`;
  return `${header}${body}`;
}

function devinAgent(src, readonly) {
  const text = readFileSync(join(PSTACK, "agents", src), "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const keep = { name: `name: ${src.replace(/\.md$/, "")}`, description: "description:" };
  for (const [key, block] of frontmatterFields(frontmatter)) {
    if (key === "name" || key === "description") keep[key] = block;
  }
  const body = text.replace(/^---\n[\s\S]*?\n---\n*/, "");
  const tools = readonly ? "allowed-tools: [read, grep, glob]\n" : "";
  const header = `---\n${keep.name}\n${keep.description}\n${tools}---`;
  return `${header}\n\n${DEVIN_AGENT_NOTE}\n\n${body}`;
}

const problems = [];
for (const [skill, { usesCursorNames, wrap }] of classes) {
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
  if (!adapter.includes(key)) problems.push(`Devin adapter has no row for ${key}, used by ${using.join(", ")}`);
}
for (const skill of [...skills.filter((name) => !EXCLUDE.has(name)), ...KIT_SKILLS]) {
  const root = KIT_SKILLS.includes(skill) ? join(KIT, "skills") : SKILLS;
  devinFrontmatter(readFileSync(join(root, skill, "SKILL.md"), "utf8"), `skills/${skill}`, problems);
}
for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);

// The repo-relative path that a relative link in `from` points at, if that path exists.
function resolve(from, href) {
  const target = href.replace(/[#?].*/, "");
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  const path = posix.join(posix.dirname(from), target).replace(/\/$/, "");
  return existsSync(join(ROOT, path)) ? path : undefined;
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
    errors.push(`devin/${emitted} is emitted by both ${files.get(emitted).src} and ${src}`);
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
put("agents/poteto-agent.md", "pstack/agents/poteto-agent.md", { bytes: Buffer.from(devinAgent("poteto-agent.md", false)), executable: false });
put("agents/comment-sicko.md", "pstack/agents/comment-sicko.md", { bytes: Buffer.from(devinAgent("comment-sicko.md", true)), executable: false });
for (const path of walk(join(PSTACK, GUIDE))) {
  put(`${GUIDE}/${relative(join(PSTACK, GUIDE), path)}`, relative(ROOT, path));
}
put(ADAPTER, `pstack/${ADAPTER}`);
put("docs/harness/devin-cli/profile-body.md", "pstack/docs/harness/devin-cli/profile-body.md");
put("README.md", "pstack/README.md");
put("LICENSE", "pstack/LICENSE");
put("LICENSE-cursor-team-kit", "cursor-team-kit/LICENSE");
const plugin = JSON.parse(readFileSync(join(PSTACK, "plugin.json"), "utf8"));
put(".devin-plugin/plugin.json", "pstack/plugin.json", {
  bytes: Buffer.from(
    JSON.stringify(
      {
        name: "pstack",
        version: plugin.version,
        description: "pstack native Devin CLI edition",
        platforms: ["local"],
        skills: ["skills"],
      },
      null,
      2,
    ) + "\n",
  ),
  executable: false,
});

for (const skill of [...skills.filter((name) => !EXCLUDE.has(name)), ...KIT_SKILLS]) {
  const emitted = `skills/${skill}/SKILL.md`;
  const entry = files.get(emitted);
  entry.bytes = Buffer.from(
    insertAfterH1(
      devinFrontmatter(entry.bytes.toString("utf8"), emitted, []),
      DEVIN_NOTICE(posix.relative(posix.dirname(emitted), ADAPTER)),
    ),
  );
}
for (const emitted of ["README.md", ...[...files.keys()].filter((key) => key.startsWith(`${GUIDE}/`) && key.endsWith(".md"))]) {
  const notice = DEVIN_NOTICE(posix.relative(posix.dirname(emitted), ADAPTER));
  const entry = files.get(emitted);
  entry.bytes = Buffer.from(insertAfterH1(entry.bytes.toString("utf8"), emitted === "README.md" ? `${notice}\n\n${DEVIN_README_NOTE}` : notice));
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
      return `](${posix.relative(posix.dirname(emitted), mapped)}${suffix})`;
    }
    const kind = statSync(join(ROOT, source)).isDirectory() ? "tree" : "blob";
    return `](${GITHUB}/${kind}/main/${source}${suffix})`;
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
      dangling.push(`harness/devin/pstack/${path} links to ${href}, which escapes the tree`);
    } else if (!has(files, resolved)) {
      const source = entry.src ? resolve(entry.src, href) : undefined;
      if (source) {
        dangling.push(`harness/devin/pstack/${path} links to ${href}, which is not in the tree`);
      } else if (/[./]/.test(linkPath)) {
        dangling.push(`harness/devin/pstack/${path} links to ${href}, which does not exist`);
      }
    }
  }
}
for (const problem of [...errors, ...dangling]) console.log(`FAIL ${problem}`);
if (errors.length + dangling.length > 0) process.exit(1);

if (process.argv.includes("--check")) {
  const onDisk = new Map(existsSync(OUT) ? walk(OUT).map((path) => [relative(OUT, path), file(path)]) : []);
  const drifted = [...new Set([...rendered.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [rendered.get(path), onDisk.get(path)];
    return !want || !have || !want.bytes.equals(have.bytes) || want.executable !== have.executable;
  });
  for (const path of drifted.slice(0, 20)) console.log(`harness/devin/pstack/${path}`);
  if (drifted.length > 0) {
    console.log(`harness/devin/pstack is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exit(1);
  }
  console.log("harness/devin/pstack is up to date.");
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
