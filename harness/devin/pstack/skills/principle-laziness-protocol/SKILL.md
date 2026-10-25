---
name: principle-laziness-protocol
description: "Apply when refactoring, evaluating diff size, or tempted to add abstractions, layers, or signal threading. Bias toward deletion and the smallest change that solves the problem."
triggers: [user]
---

# Laziness Protocol

In Devin CLI, read [the Devin CLI adapter](../../docs/harness/devin-cli.md) before following this skill. It maps Cursor names and explicit model routing to this host.

- **Consolidate decisions.** Do not repeat the same choice in several places. Put it behind one source of truth and pass the result as a simple flag.
- **Minimize the diff.** Make the smallest change that solves the problem. Fewer lines beat "elegant" boilerplate.
