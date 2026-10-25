---
name: principle-guard-the-context-window
description: "Apply when context is filling up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents; keep summaries in the main thread, not raw payloads."
triggers: [user]
---

# Guard the Context Window

In Devin CLI, read [the Devin CLI adapter](../../docs/harness/devin-cli.md) before following this skill. It maps Cursor names and explicit model routing to this host.

**Why:** Context overflow degrades reasoning quality, creates compression artifacts, and halts progress.

**Pattern:**
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
