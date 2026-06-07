---
name: plugin-factory
description: Create or switch Figma plugin folders in this workspace (plugins/<slug>/). Use when the user wants a new plugin, plugin factory, duplicate template, many plugins, or asks where to point Figma manifest.
---

# Plugin factory (this workspace)

## When to load

- User wants many plugins, not just the comparison harness
- User asks to duplicate/scaffold a new plugin folder
- User asks which manifest to import in Figma
- Before generation when `plugins/.active` may point at a factory plugin

## Commands (repo root)

```bash
npm run new-plugin -- <slug> [--name "Display Name"] [--from scaffold|template]
npm run use-plugin -- <slug>
npm run use-plugin -- comparison
npm run list-plugins
npm run plugin-root
```

## Naming

- Folder: `plugins/<slug>/` (e.g. `plugins/org-chart/`)
- Slug: lowercase, hyphens, starts with letter (`org-chart`, `bento-grid`)
- Each plugin gets unique `manifest.json` `id` and `name`

## Active target

Read `plugins/.active` (one-line slug). If missing → write to `template/`. If set → write to `plugins/<slug>/`.

Do **not** edit `manifest.json` during tool generation. Re-import in Figma only when manifest changes in git.

## Full doc

**`docs/11-plugin-factory.md`**
