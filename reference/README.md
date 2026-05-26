# Reference examples

Two fully-worked GenTool-style plugins. Cursor reads these as **study material** to learn sandbox practices, not as code to copy into the template.

| Example | Archetype | Practices demonstrated |
|---|---|---|
| `01-generator-color-swatch/` | Generator | State on node, relaunch data, output targeting (create vs update), selection rehydration, commit-fire, explicit Generate |
| `02-action-layer-renamer/` | Action | Selection-based action, no persistent state, single-button UI, `figma.notify` feedback, relaunch data |

## How to read these

When Cursor processes a new prompt, it should:

1. Identify the archetype from the prompt (Generator vs. Action).
2. Read the matching reference **`code.ts`** end to end.
3. Use the example as a structural template for sandbox logic — same patterns, same shape — but write the tool-specific logic from the prompt.
4. For **UI**, follow `template/src/ui.template.html` and **`docs/08-figui3-ui.md`** (FigUI3 web components, panel spacing, bundling).

Reference `ui.html` files use **legacy inline PropsKit CSS classes** for illustration. **New tools must use FigUI3 web components**, not copy those HTML files.

## What NOT to do

- Don't copy a reference example wholesale into `template/`. Use it as the pattern; write the actual tool for the prompt.
- Don't import from `reference/` at runtime. These are studied, not linked.
- Don't modify reference examples while building a new tool. They are read-only training material.
