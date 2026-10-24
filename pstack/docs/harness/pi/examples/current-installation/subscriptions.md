# pstack Subscription Profile

| Provider/model family | Quota | Default policy |
|---|---|---|
| openai GPT | primary | Preserve configured GPT roles |
| xai Grok | secondary | Preserve configured Grok roles |
| devin Claude | scarce | Preserve upstream Claude roles; fallback on failure |
| devin SWE-2 | unlimited | Mechanical slice tasks, not automatic replacement for judgment roles |

Quota information is user-provided, not measured remaining balance.
Keep the approved default role models unless the user accepts a new table.
If a model is unavailable or rate/quota limited, retry that seat once with the current main conversation model. Do not automatically downgrade to Sonnet or persist the retry model.
