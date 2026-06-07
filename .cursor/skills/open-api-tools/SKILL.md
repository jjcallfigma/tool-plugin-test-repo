---
name: open-api-tools
description: Build or review GenTool-style plugins (template/ or plugins/<slug>/) that call public open HTTP APIs (no API keys). Use when a tool prompt needs live JSON/data from the internet, fetch in code.ts, or network errors in Figma dev plugins.
---

# Open API tools (this workspace)

## Manifest

Each plugin manifest (`template/manifest.json` or `plugins/<slug>/manifest.json`) already sets `networkAccess.allowedDomains` to `["*"]`. **Do not edit the manifest** during generation. Re-import the dev plugin in Figma after manifest changes land in git.

## Policy (V1)

**Allowed:** `fetch` to public endpoints with no authentication.

**Forbidden:** API key fields, Bearer tokens, OAuth, `clientStorage` for secrets, private/authenticated APIs.

## Implementation

1. Read `docs/10-network-open-apis.md`.
2. `await fetch(url)` in **`code.ts`** inside `regenerate` / apply handlers — not on plugin open for Generators.
3. Wrap in existing `try/catch`; failures → `figma.notify`.
4. Comment the API URL(s) at the top of `code.ts`.

```ts
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}
```

## With other practices

- **`regenerate(state, 'create' | 'update')` + output targeting** — Generate adds without deleting other tool outputs; control changes update selected frame only (`docs/07-plugin-practices.md > Output targeting`).
- `await figma.getNodeByIdAsync` when resolving stored node ids (`documentAccess: dynamic-page`).
- FigUI3 UI, commit-fire, no forbidden user-facing words (`docs/04-glossary.md`).
