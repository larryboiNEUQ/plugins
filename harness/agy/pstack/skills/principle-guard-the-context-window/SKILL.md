---
name: principle-guard-the-context-window
description: "Apply when context is filling up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents; keep summaries in the main thread, not raw payloads."
disable-model-invocation: true
---

# Guard the Context Window

In Antigravity (AGY), read [the AGY adapter](../../docs/harness/agy.md) before following this skill. It maps Cursor tools, paths, two-tier subagent/swarm delegation, and unsupported features to this host.

**Why:** Context overflow degrades reasoning quality, creates compression artifacts, and halts progress.

**Pattern:**
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
