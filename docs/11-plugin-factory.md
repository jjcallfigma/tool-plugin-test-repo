# Plugin factory workflow

Use this when you want **many real Figma plugins** side by side — not just the single comparison harness in `template/`.

The comparison harness (`template/`) is unchanged: one stable manifest, reset between tests. The factory adds **`plugins/<slug>/`** folders, each with its own manifest you import once in Figma.

---

## Naming convention

| Piece | Pattern | Example |
|---|---|---|
| Folder | `plugins/<slug>/` | `plugins/org-chart/` |
| Slug | lowercase, hyphens, starts with a letter | `org-chart`, `bento-grid`, `layer-renamer` |
| Manifest `id` | same as slug | `org-chart` |
| Manifest `name` | Title Case from slug (override with `--name`) | `Org Chart` |
| Active pointer | `plugins/.active` (one line: slug) | `org-chart` |

---

## Commands (repo root)

```bash
# Create a new plugin, install deps, build, and set it active
npm run new-plugin -- org-chart

# Optional display name and seed from current comparison src
npm run new-plugin -- org-chart --name "Org Chart"
npm run new-plugin -- org-chart --from template

# Switch which folder Cursor should write to
npm run use-plugin -- org-chart
npm run use-plugin -- comparison    # back to template/

# See all plugins and which is active
npm run list-plugins

# Print active plugin root path (for scripts)
npm run plugin-root
```

Each new plugin gets:

- `manifest.json` with a **unique** `id` and `name`
- `package.json`, `tsconfig.json`, `scripts/` copied from `template/`
- `src/` from `scaffold/` (empty) or `template/src/` (`--from template`)
- Its own `node_modules/` after `npm install`

---

## Figma setup (per plugin)

1. Run `npm run new-plugin -- <slug>` once.
2. In Figma Desktop: **Plugins → Development → Import plugin from manifest**
3. Pick `plugins/<slug>/manifest.json`
4. The plugin appears under **Plugins → Development** with its display name.
5. While editing: `cd plugins/<slug> && npm run dev`, then re-run the plugin in Figma after changes.

Re-import only if `manifest.json` changes in git.

---

## Cursor / agent target

Before generating, the agent checks **`plugins/.active`**:

| `plugins/.active` | Write target | Manifest |
|---|---|---|
| Missing or `comparison` | `template/src/` | `template/manifest.json` (GenTool Comparison) |
| `<slug>` | `plugins/<slug>/src/` | `plugins/<slug>/manifest.json` |

Same docs, rules, skills, and `scaffold/` apply to both modes. Only the output folder and manifest differ.

---

## Reset a plugin src

Inside a plugin folder (same as comparison reset):

```bash
cd plugins/<slug>
npm run reset
```

This copies `scaffold/src/` → `plugins/<slug>/src/` and rebuilds.

---

## Comparison vs factory

| Goal | Use |
|---|---|
| Fair Cursor vs Figma Assistant test | `template/` + `npm run reset` + `use-plugin comparison` |
| Ship many real tools | `npm run new-plugin` + import each manifest in Figma |
| Archive a comparison run into a real plugin | `npm run new-plugin -- <slug> --from template` |

---

## Do not

- Delete `template/` — it is the shared infrastructure source and comparison entry.
- Hand-edit `plugins/*/src/ui.html` — run `npm run build` in that plugin folder.
- Reuse the same manifest `id` across plugins — Figma needs unique ids per dev plugin.
