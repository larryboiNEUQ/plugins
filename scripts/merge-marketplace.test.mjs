#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeMarketplace } from "./merge-marketplace.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts/merge-marketplace.mjs");
const temps = [];
process.once("exit", () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "merge-marketplace-test-"));
  temps.push(dir);
  return dir;
}

test("prepends fork-only entries ahead of new upstream entries, deduplicates ours repeats, and preserves theirs top-level fields", () => {
  const base = {
    name: "cursor-plugins",
    plugins: [
      { name: "teaching", source: "teaching", description: "Base upstream description" },
    ],
  };
  const ours = {
    name: "cursor-plugins",
    metadata: { description: "Old description" },
    plugins: [
      { name: "fast-io-lite", source: "fast-io-lite", description: "Fork plugin" },
      { name: "extra-fork", source: "extra-fork", description: "Second fork plugin" },
      { name: "fast-io-lite", source: "fast-io-lite", description: "Duplicate fork plugin" },
      { name: "teaching", source: "teaching", description: "Old upstream description" },
    ],
  };
  const theirs = {
    name: "cursor-plugins",
    owner: { name: "Cursor", email: "plugins@cursor.com" },
    metadata: { description: "New description" },
    plugins: [
      { name: "teaching", source: "teaching", description: "Updated upstream description" },
      { name: "new-upstream", source: "third_party/new-upstream", description: "Added upstream" },
    ],
  };

  const merged = mergeMarketplace(base, ours, theirs);
  assert.deepEqual(merged, {
    name: "cursor-plugins",
    owner: { name: "Cursor", email: "plugins@cursor.com" },
    metadata: { description: "New description" },
    plugins: [
      { name: "fast-io-lite", source: "fast-io-lite", description: "Fork plugin" },
      { name: "extra-fork", source: "extra-fork", description: "Second fork plugin" },
      { name: "teaching", source: "teaching", description: "Updated upstream description" },
      { name: "new-upstream", source: "third_party/new-upstream", description: "Added upstream" },
    ],
  });
});

test("keeps upstream-deleted plugins deleted while retaining fork-only additions", () => {
  const base = {
    plugins: [
      { name: "teaching", source: "teaching", description: "Existing" },
      { name: "retired-upstream", source: "retired-upstream", description: "Removed upstream" },
    ],
  };
  const ours = {
    plugins: [
      { name: "fast-io-lite", source: "fast-io-lite", description: "Fork plugin" },
      { name: "teaching", source: "teaching", description: "Existing" },
      { name: "retired-upstream", source: "retired-upstream", description: "Removed upstream" },
    ],
  };
  const theirs = {
    plugins: [
      { name: "teaching", source: "teaching", description: "Existing" },
      { name: "new-upstream", source: "third_party/new-upstream", description: "New" },
    ],
  };

  const merged = mergeMarketplace(base, ours, theirs);
  assert.deepEqual(merged.plugins.map((entry) => entry.name), [
    "fast-io-lite",
    "teaching",
    "new-upstream",
  ]);
});

test("deduplicates by name when upstream adopts an entry", () => {
  const base = {
    plugins: [
      { name: "pstack", source: "pstack", description: "Base" },
    ],
  };
  const ours = {
    plugins: [
      { name: "fast-io-lite", source: "fast-io-lite", description: "Fork copy" },
      { name: "pstack", source: "pstack", description: "Existing" },
    ],
  };
  const theirs = {
    plugins: [
      { name: "pstack", source: "pstack", description: "Upstream" },
      { name: "fast-io-lite", source: "third_party/fast-io-lite", description: "Adopted upstream" },
    ],
  };

  const merged = mergeMarketplace(base, ours, theirs);
  assert.deepEqual(merged.plugins, [
    { name: "pstack", source: "pstack", description: "Upstream" },
    { name: "fast-io-lite", source: "third_party/fast-io-lite", description: "Adopted upstream" },
  ]);
});

test("is idempotent across repeated merges", () => {
  const base = {
    plugins: [
      { name: "teaching", source: "teaching", description: "Base" },
    ],
  };
  const ours = {
    plugins: [
      { name: "fast-io-lite", source: "fast-io-lite", description: "Fork plugin" },
      { name: "teaching", source: "teaching", description: "Upstream" },
    ],
  };
  const theirs = {
    plugins: [
      { name: "teaching", source: "teaching", description: "Upstream" },
      { name: "runta", source: "third_party/runta", description: "New" },
    ],
  };

  const first = mergeMarketplace(base, ours, theirs);
  assert.deepEqual(mergeMarketplace(base, first, theirs), first);
  assert.deepEqual(mergeMarketplace(base, ours, first), first);
});

test("rejects invalid base, ours, and theirs marketplace shapes", () => {
  const valid = { plugins: [{ name: "teaching", source: "teaching" }] };
  const invalidCases = [
    ["non-object null", null],
    ["non-object array", []],
    ["missing plugins", { name: "missing-plugins" }],
    ["empty plugin name", { plugins: [{ name: "" }] }],
    ["non-string plugin name", { plugins: [{ name: 42 }] }],
  ];

  for (const [label, invalid] of invalidCases) {
    assert.throws(() => mergeMarketplace(invalid, valid, valid), /base marketplace/, `base ${label}`);
    assert.throws(() => mergeMarketplace(valid, invalid, valid), /ours marketplace/, `ours ${label}`);
    assert.throws(() => mergeMarketplace(valid, valid, invalid), /theirs marketplace/, `theirs ${label}`);
  }
});

test("CLI writes formatted JSON and exits non-zero on invalid args, JSON, or marketplace shapes", () => {
  const dir = tempDir();
  const basePath = join(dir, "base.json");
  const oursPath = join(dir, "ours.json");
  const theirsPath = join(dir, "theirs.json");
  const outPath = join(dir, "out.json");

  const basePayload = {
    plugins: [
      { name: "teaching", source: "teaching", description: "Base" },
      { name: "retired", source: "retired", description: "Retired" },
    ],
  };
  const oursPayload = {
    plugins: [
      { name: "fast-io-lite", source: "fast-io-lite", description: "Fork" },
      { name: "teaching", source: "teaching", description: "Old" },
      { name: "retired", source: "retired", description: "Retired" },
    ],
  };
  const theirsPayload = {
    name: "cursor-plugins",
    plugins: [
      { name: "teaching", source: "teaching", description: "New" },
    ],
  };

  const resetInputs = () => {
    writeFileSync(basePath, JSON.stringify(basePayload));
    writeFileSync(oursPath, JSON.stringify(oursPayload));
    writeFileSync(theirsPath, JSON.stringify(theirsPayload));
  };

  resetInputs();
  const ok = spawnSync(process.execPath, [SCRIPT, basePath, oursPath, theirsPath, outPath], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const written = readFileSync(outPath, "utf8");
  assert.ok(written.endsWith("\n"));
  assert.deepEqual(JSON.parse(written).plugins.map((p) => p.name), ["fast-io-lite", "teaching"]);

  for (const [role, targetPath] of [
    ["base", basePath],
    ["ours", oursPath],
    ["theirs", theirsPath],
  ]) {
    resetInputs();
    writeFileSync(targetPath, "{not valid json");
    const badJson = spawnSync(process.execPath, [SCRIPT, basePath, oursPath, theirsPath, outPath], { encoding: "utf8" });
    assert.notEqual(badJson.status, 0, `${role} invalid JSON should fail`);

    for (const invalid of ["null", JSON.stringify({ name: "missing-plugins" }), JSON.stringify({ plugins: [{ name: "" }] })]) {
      resetInputs();
      writeFileSync(targetPath, invalid);
      const badShape = spawnSync(process.execPath, [SCRIPT, basePath, oursPath, theirsPath, outPath], { encoding: "utf8" });
      assert.notEqual(badShape.status, 0, `${role} invalid shape ${invalid} should fail`);
    }
  }

  resetInputs();
  const tooFewArgs = spawnSync(process.execPath, [SCRIPT, oursPath, theirsPath, outPath], { encoding: "utf8" });
  assert.notEqual(tooFewArgs.status, 0);

  const tooManyArgs = spawnSync(process.execPath, [SCRIPT, basePath, oursPath, theirsPath, outPath, "extra"], { encoding: "utf8" });
  assert.notEqual(tooManyArgs.status, 0);
});
