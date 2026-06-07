---
name: color-picker-ui
description: Build or review fig-input-color in GenTool-style plugins (template/ or plugins/<slug>/). Use when a tool prompt needs a color control, fig-input-color markup, fill-picker popover layout, or color picker CSS/resize fixes in ui.template.html.
---

# Color picker UI (this workspace)

## When to load

Any tool that uses `<fig-input-color>` — bar color, accent, fill, stroke, etc.

## Required markup

```html
<fig-input-color id="accent" value="#0D99FF" text="true" alpha="true" picker="figma"></fig-input-color>
```

All three attrs are mandatory. FigUI3 defaults break the popover in GenTools.

## Preserve from scaffold (do not rewrite)

After `npm run reset`, `scaffold/src/ui.template.html` ships:

1. **CSS block** — all `dialog.fig-fill-picker-dialog …` rules in the second `<style>` section
2. **JS** — `measurePanelHeight()`, `reportPanelHeight()`, `watchColorPickerDialog()`

Copy these into every generated `{pluginRoot}/src/ui.template.html`. Read **`docs/08-figui3-ui.md > Color picker`** for why each rule exists.

## Init

Add to `customElements.whenDefined`:

- `fig-input-color`
- `fig-fill-picker`
- `fig-chit`

Bind **`change`** on `fig-input-color` for regenerate (not `input`). Use the same `fireRegenerate()` helper as other controls — gated on `outputSelected` (`docs/07-plugin-practices.md > Output targeting`).

## Do NOT

- Remove the color-picker CSS when the tool has colors
- Add `min-width` on `.fig-fill-picker-input-mode`
- Set `width: 100%` on the mode dropdown
- Replace footer layout with custom grid — use the `--fig-field-*` variables from the scaffold block
- Omit `text` / `alpha` / `picker="figma"`

## Verify

- [ ] Panel row shows swatch + hex + opacity %
- [ ] Popover hue/opacity sliders render full width at 240px
- [ ] Hex and HSB footer inputs align with slider track
- [ ] Popover bottom not clipped when open
