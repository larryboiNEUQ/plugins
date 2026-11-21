# Optional GPT model choices

This is an example, not an installed default or an entitlement list. The listed IDs were available in a reference Codex collaboration session on 2026-11-13. Run setup-pstack, detect current support, and accept the table before writing your user-owned ~/.codex/pstack-models.md. A different account or host may expose different models.

```text
# defaults: 3
# budget: medium (high starting level; dynamic)
opus: gpt-6.1-sol
fable: gpt-6-astra
gemini: gpt-6.1-terra
arena runners: gpt-6.1-sol, gpt-6.1-terra
interrogate reviewers: gpt-6.1-sol, gpt-6.1-terra
arena cross-judge pool: gpt-6-astra
```

Family mappings preserve current upstream role assignments (`claude-opus-*`, `claude-fable-*`, `gemini-*`). Exact panel overrides provide separate GPT variants. They remain one GPT family, so a GPT parent cannot obtain an Arena cross-family judge from this pool and must disclose that skip. Each panel entry still starts a separate agent.

With this budget, high is the starting effort, not a fixed level. Difficult work raises it to xhigh, ordinary judgment lowers it to medium, and mechanical work lowers it to low, subject to actual support and explicit task instructions. Pass effort separately from model identity.

An existing table with legacy 13- or 17-role upstream overrides is also valid. Keep those choices unless the user approves migrating them. This file does not change the main conversation's model, global instructions, or plugin installation.
