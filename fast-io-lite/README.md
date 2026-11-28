# fast-io-lite

Adapted from `oil-oil/agy-fast-io` for Antigravity CLI (`agy`) / Turbo (`always-proceed`) environments:

- Keeps parallel search + batch `read_file`, command chaining, targeted `edit_file`, and concise replies.
- Drops the desktop-only command whitelist restrictions (allows `rg`, `fd`, `&&`, etc. freely).

## Install

### agy

```bash
agy plugin install ./fast-io-lite
```

agy loads `rules/AGENTS.md`.

### Cursor

The Cursor port lives in `rules/fast-io-lite*.mdc` (main rules, pstack entry, turn receipt), listed in `.cursor-plugin/plugin.json`.

In the Cursor CLI (checked on 2026.11.22), plugin rules are not loaded, and `~/.cursor/rules` is only found when the workspace sits under the home directory. For every workspace, paste the bodies of the three `.mdc` files, without their frontmatter, into Cursor Settings > Rules > User Rules.
