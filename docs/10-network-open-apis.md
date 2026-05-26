# Public open APIs (network access)

The comparison template manifest allows outbound network requests so tools can call **public open APIs** — endpoints that work without API keys, OAuth, or user login.

**Not allowed (V1 policy):** API keys in the UI, Bearer tokens, `clientStorage` for secrets, “paste your key” fields, or authenticated/private endpoints.

---

## Manifest (pre-wired — do not edit per generation)

`template/manifest.json` ships with:

```json
"networkAccess": {
  "allowedDomains": ["*"],
  "reasoning": "Generated tools may call public open HTTP APIs that do not require API keys or user authentication."
}
```

- **`["*"]`** is Figma’s wildcard for any HTTPS/HTTP domain (required `reasoning` field).
- Generation runs still **must not modify** `manifest.json` — network is part of the stable harness.
- After this changes in git, **re-import** the dev plugin once in Figma (Plugins → Development → Import manifest) so Figma picks up the new `networkAccess`.

Tools that do not need the network should simply not call `fetch`.

---

## Where to call APIs

Prefer **`code.ts` (plugin sandbox)** only:

1. UI posts `generate` / `regenerate` / `apply` with parameters.
2. Sandbox `await fetch(url)` → parse JSON or bytes.
3. Build Figma nodes from the response.
4. On failure: `figma.notify('…')` inside existing `try/catch`.

Avoid `fetch` in `ui.html` unless unavoidable — keeps secrets out of the iframe and matches GenTool patterns.

`figma.createImageAsync` and other APIs that load remote assets also require an allowed domain; `["*"]` covers them.

---

## Implementation pattern

```ts
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function regenerate(state: State): Promise<void> {
  try {
    const data = await fetchJson<PublicPayload>(
      'https://api.example.com/public/data.json',
    );
    // ... build output from data ...
  } catch (err) {
    figma.notify(`Could not regenerate: ${(err as Error).message}`);
  }
}
```

### Practices

| Do | Don't |
|---|---|
| Use **HTTPS** public endpoints | Hard-code API keys or tokens |
| Document the API URL in a top-of-file comment in `code.ts` | Ask users to paste secrets |
| Handle non-OK status and JSON parse errors | Block the UI with modals |
| Keep requests tied to **Generate** / **Apply** (or explicit footer action) | Poll in the background forever |
| Note rate limits / offline in `figma.notify` when fetch fails | Assume auth headers will work |

### Good API examples (no keys)

- Government / open data JSON endpoints
- Public weather or geo APIs with open tiers and no auth
- Static JSON hosted on CDNs (e.g. curated color lists)
- `https://api.github.com/...` only for **unauthenticated** public resources (respect rate limits)

### Bad fits for V1

- OpenAI, Stripe, or any “sign up for a key” service
- OAuth / login redirects
- User-specific private data

---

## Checklist (when the prompt needs live data)

- [ ] `fetch` runs in `code.ts`, inside `try/catch` with `figma.notify` on error
- [ ] No API key / token fields in the UI
- [ ] URL(s) documented in a comment at top of `code.ts`
- [ ] First network call happens on **Generate** / **Apply**, not on plugin open (Generators)
- [ ] Tool still works offline-ish: clear error if fetch fails (no silent failure)

---

## Comparison harness note

| Held constant | Variable |
|---|---|
| `networkAccess: ["*"]` in manifest | Whether a given tool calls `fetch` |
| Same plugin id / import | Which public API a prompt targets |

You are testing whether the model wires fetch + canvas output correctly, not whether it can edit the manifest.
