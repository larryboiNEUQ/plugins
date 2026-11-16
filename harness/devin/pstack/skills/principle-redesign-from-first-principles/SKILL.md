---
name: principle-redesign-from-first-principles
description: "Apply when integrating a new requirement into an existing design."
triggers: [user]
---

# Redesign From First Principles

In Devin CLI, read [the Devin CLI adapter](../../docs/harness/devin-cli.md) before following this skill. It maps Cursor names and explicit model routing to this host.

When integrating a change, don't bolt it onto the existing design. Redesign as if the requirement had been a foundational assumption from the start.

- Read all affected files and understand the current design
- Ask: "if we were writing this from scratch with this new requirement, what would we build?"
- Propagate the change through every reference: types, docs, examples, rationale sections
- Think about the whole redesign, then deliver it incrementally

This is the method for preserving option value when integrating changes into an existing design.
