# Dry-run test protocol

Use this when the Cursor kit starts failing or you intentionally want to tune the rules. It is not required for the lightweight live comparison against Assistant.

Goal: pressure-test Cursor a few times against the Bento Grid prompt. If the same thing fails across multiple runs, fix the rules. If different things fail each run, that's variance, accept it and move on.

## The drill (per run)

1. Run `cd template && npm run reset`.
2. Open a fresh chat in Cursor (don't carry context from previous runs).
3. Paste the Bento Grid prompt from `docs/05-test-prompts.md` verbatim (`Create a custom tool that…`). Say nothing else.
4. Let Cursor write the files. Don't intervene.
5. Run `cd template && npm run dev` (or rely on `npm run build` after agent generation).
6. In Figma Desktop: Plugins → Development → GenTool Comparison.
7. Run the 5-point check below.
8. Log the result.

## The 5-point check

Score each pass / fail. One sentence why if it failed.

**1. FigUI3 / PropsKit UI intact**
   - Controls are FigUI3 web components (`fig-field`, `fig-dropdown`, `fig-slider`, etc.) — not empty rows
   - Panel uses `<fig-group>` / `<fig-header borderless>` structure with spacing overrides from `docs/08-figui3-ui.md`
   - 240px width, tight section headers, titles flush above controls
   - FigUI3 inlined in `ui.html` (no external script/link tags); init waits on `customElements.whenDefined`

**2. Explicit first run + output targeting**
   - Opening the plugin does **not** create canvas output
   - Primary **Generate** footer button creates the first frame within 2 seconds of click
   - Click **Generate** again with nothing selected → **second frame appears; first remains**
   - Control changes regenerate **only when a tool output frame is selected** — not when nothing is selected
   - **Generate** with a tool output selected updates that frame in place

**3. Commit-fire only**
   - Sliders update output on release, not on drag
   - Number inputs update on blur/Enter, not on every keystroke
   - No live re-rendering during interaction

**4. Output looks intentional**
   - Default 6-card asymmetric layout, not 6 identical squares
   - Real placeholder content, not "lorem" or empty grey
   - Cards have visual hierarchy (some bigger, some smaller, varied)

**5. State persists**
   - Close the plugin
   - Click off and back onto the output frame
   - Re-open the plugin from Plugins → Development → GenTool Comparison
   - Controls show the same values as when you closed

## Reset (between runs)

```bash
cd template && npm run reset
```

This copies `scaffold/src/code.ts` and `scaffold/src/ui.template.html` into `template/src/`, then runs `npm run build`. See **`docs/09-plugin-structure-and-reset.md`** for the full structure and why you must not wipe the whole `template/` folder.

After reset, the plugin panel is empty — ready for a fresh generation prompt.

## How to iterate on the rules

If a check **fails on the same point across 2+ runs**, that's a rules issue. Open the relevant rule file and tighten the language:

| Check that failed | Rule to tighten |
|---|---|
| FigUI3 / PropsKit UI intact | `docs/08-figui3-ui.md`, `.cursor/rules/20-ui-html.mdc` |
| Explicit first run / output targeting | `.cursor/rules/20-ui-html.mdc`, `docs/07-plugin-practices.md > Output targeting`, `docs/08-figui3-ui.md` — Generate footer button, no init `generate`, `outputSelected` gate, create must not remove other outputs |
| Commit-fire only | `.cursor/rules/20-ui-html.mdc` — bold "change, not input" and the gotcha |
| Output looks intentional | `.cursor/rules/00-philosophy.mdc` — strengthen the "default state must look intentional" bar |
| State persists | `.cursor/rules/10-plugin-code.mdc` — emphasize `setPluginData` and `selectionchange` |

If a check **fails inconsistently across runs**, that's model variance. Accept it as the floor of what Cursor produces. Note it in the demo as a known limitation if it matters.

## Log

Fill in as you go. Three runs is usually enough to spot patterns.

### Run 1 — date: ____ time: ____

| Check | Pass / Fail | Notes |
|---|---|---|
| 1. FigUI3 / PropsKit UI | | |
| 2. Explicit first run | | |
| 3. Commit-fire | | |
| 4. Intentional output | | |
| 5. State persists | | |

Time to T2 (usable): ___s
Overall impression: ___

### Run 2 — date: ____ time: ____

| Check | Pass / Fail | Notes |
|---|---|---|
| 1. FigUI3 / PropsKit UI | | |
| 2. Explicit first run | | |
| 3. Commit-fire | | |
| 4. Intentional output | | |
| 5. State persists | | |

Time to T2 (usable): ___s
Overall impression: ___

### Run 3 — date: ____ time: ____

| Check | Pass / Fail | Notes |
|---|---|---|
| 1. FigUI3 / PropsKit UI | | |
| 2. Explicit first run | | |
| 3. Commit-fire | | |
| 4. Intentional output | | |
| 5. State persists | | |

Time to T2 (usable): ___s
Overall impression: ___

## After the dry runs

- **All 5 checks passing across 3 runs?** Skill is dialed in. Run the live comparison.
- **One check failing consistently?** Tighten that rule, re-run.
- **Multiple checks failing?** Step back. The rules or the docs need a bigger pass. Easiest path: paste the failing run's output back here and we'll spot the gap together.
