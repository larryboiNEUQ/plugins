# fast-io-lite

Adapted from `oil-oil/agy-fast-io` for Antigravity CLI (`agy`) / Turbo (`always-proceed`) environments:

- Keeps parallel search + batch `read_file`, command chaining, targeted `edit_file`, and concise replies.
- Drops the desktop-only command whitelist restrictions (allows `rg`, `fd`, `&&`, etc. freely).

## Install

```bash
agy plugin install ./fast-io-lite
```
