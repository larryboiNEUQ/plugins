#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function assertMarketplace(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} marketplace must be a JSON object`);
  }
  if (!Array.isArray(value.plugins)) {
    throw new Error(`${label} marketplace must have a plugins array`);
  }
  for (const [index, entry] of value.plugins.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string" || entry.name.length === 0) {
      throw new Error(`${label} marketplace plugins[${index}] must have a non-empty string name`);
    }
  }
}

export function mergeMarketplace(base, ours, theirs) {
  assertMarketplace(base, "base");
  assertMarketplace(ours, "ours");
  assertMarketplace(theirs, "theirs");

  const known = new Set([
    ...base.plugins.map((entry) => entry.name),
    ...theirs.plugins.map((entry) => entry.name),
  ]);
  const forkOnly = [];
  for (const entry of ours.plugins) {
    if (known.has(entry.name)) continue;
    known.add(entry.name);
    forkOnly.push(entry);
  }

  return {
    ...theirs,
    plugins: [...forkOnly, ...theirs.plugins],
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4) {
    console.error("Usage: node scripts/merge-marketplace.mjs <basePath> <oursPath> <theirsPath> <outPath>");
    process.exit(1);
  }

  const [basePath, oursPath, theirsPath, outPath] = args;
  try {
    const base = JSON.parse(readFileSync(basePath, "utf8"));
    const ours = JSON.parse(readFileSync(oursPath, "utf8"));
    const theirs = JSON.parse(readFileSync(theirsPath, "utf8"));
    const merged = mergeMarketplace(base, ours, theirs);
    writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
