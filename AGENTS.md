# Cursor briefing

You are inside a workspace built to fairly compare **Cursor + Claude building a Figma plugin** vs **Figma's Assistant building a GenTool**. Same prompt intent, two environments, side by side.

## Trigger phrase

When the user message **starts with** `Create a custom tool` (any casing), you are in **tool-generation mode**. Build a real Figma plugin in `template/` that mimics the shape and feel of a GenTool. Follow everything below — do not ask clarifying questions unless the prompt contradicts itself.

This mirrors how the user starts prompts in the Figma Assistant environment. The opener is part of the test; the rest of the prompt describes the tool.

## Read these BEFORE writing any code

In this order:

1. **`.cursor/rules/00-philosophy.mdc`** — always-on rules
2. **`docs/07-plugin-practices.md`** — the complete practices checklist (state, relaunch, message passing, all of it)
3. **`docs/09-plugin-structure-and-reset.md`** — **required structure, reset workflow for generation tests**
4. **`docs/08-figui3-ui.md`** — FigUI3 setup, bundling, panel layout, spacing, **color picker** (`> Color picker` if the tool has colors)
5. **`docs/02-propskit-reference.md`** — the allowed control catalog (FigUI3 web components)
6. **`reference/`** — two fully-worked example tools:
   - `01-generator-color-swatch/` — Generator archetype with all practices
   - `02-action-layer-renamer/` — Action archetype with all practices
7. **`docs/01-what-is-a-good-tool.md`** — the GenTool bar
8. **`docs/03-figma-plugin-basics.md`** — Plugin API quickstart
9. **`docs/10-network-open-apis.md`** — public `fetch` in `code.ts` (no API keys; manifest pre-wired)
10. **`docs/04-glossary.md`** — forbidden words

The reference examples are the most important for **sandbox logic** (`code.ts`). For **UI shell** (placeholders, spacing CSS), start from **`scaffold/src/ui.template.html`** and `docs/08-figui3-ui.md`.

## Generation test workflow (human)

Before each fair comparison run:

```bash
cd template && npm run reset
```

Then open a **fresh chat** and paste the prompt. See **`docs/09-plugin-structure-and-reset.md`**. Do **not** delete `template/` or `node_modules/`.

## The template structure

```
template/
├── manifest.json           ← DO NOT TOUCH
├── package.json            ← DO NOT TOUCH (FigUI3 + build/reset scripts)
├── tsconfig.json           ← DO NOT TOUCH
├── scripts/
│   ├── bundle-ui.mjs       ← DO NOT TOUCH
│   └── reset-template.mjs  ← DO NOT TOUCH
└── src/
    ├── code.ts             ← OVERWRITE each run
    ├── ui.template.html    ← OVERWRITE each run (UI source)
    ├── ui.html             ← GENERATED — do not edit by hand
    └── vendor/             ← FigUI3 copies (from npm install)

scaffold/src/               ← committed empty starting point; copied by npm run reset
    ├── code.ts
    └── ui.template.html
```

`code.ts` ships near-empty except `figma.showUI` and an empty message handler. `ui.template.html` ships with FigUI3 placeholders and the canonical panel spacing CSS. You write the tool UI and logic from there.

## What you DO

1. **Identify the archetype** from the prompt:
   - Generator: produces output, has persistent controls, regenerates on every control change
   - Action: operates on selection, one-shot, no persistent state
2. **Read the matching reference `code.ts`** end to end. Note every practice.
3. **Read `scaffold/src/ui.template.html` and `docs/08-figui3-ui.md`** for UI shell patterns.
4. **Overwrite `template/src/code.ts`** following the same pattern. Include every applicable practice from `docs/07-plugin-practices.md` (especially **Output targeting** — read `reference/01-generator-color-swatch/code.ts`):
   - For Generators: state types, `regenerate(state, 'create' | 'update')`, output targeting (`getSelectedToolFrame`, `outputSelected`, **create must not remove other outputs**), setPluginData, setRelaunchData, selectionchange, figma.command handling, try/catch — see `docs/07-plugin-practices.md > Output targeting` and `reference/01-generator-color-swatch/code.ts`
   - If `toolState` stores node ids: `await figma.getNodeByIdAsync` only (`getNodeById` throws with template `documentAccess: "dynamic-page"`)
   - For Actions: selection handling, figma.notify, setRelaunchData, no persistent state
   - If the prompt needs live public data: `fetch` in `code.ts` per `docs/10-network-open-apis.md` (no API keys; do not edit manifest)
5. **Overwrite `template/src/ui.template.html`** — preserve the FigUI3 placeholders (`<!-- FIGUI3_CSS -->`, `<!-- FIGUI3_JS -->`) and the **full panel spacing + color-picker CSS block** from `scaffold/src/ui.template.html` (or `docs/08-figui3-ui.md`). Preserve **`measurePanelHeight` / `watchColorPickerDialog`** in the UI script. Use **only** FigUI3 web components from `docs/02-propskit-reference.md`. If the tool uses `<fig-input-color>`, read **`docs/08-figui3-ui.md > Color picker`** and use `text="true" alpha="true" picker="figma"`.
6. **Run `npm run bundle-ui`** (or `npm run build`) to regenerate `ui.html`.
7. **Tell the user** to re-run the plugin in Figma.

## What you DO NOT

- Do **not** touch `manifest.json`, `package.json`, `tsconfig.json`, or `scripts/bundle-ui.mjs`.
- Do **not** hand-edit `ui.html` — it is build output.
- Do **not** link external FigUI3 CSS/JS files — they must be inlined (the bundle step does this).
- Do **not** use ES module `import` for FigUI3 — use inlined `<script>` + `customElements.whenDefined`.
- Do **not** copy reference `ui.html` files wholesale — they use legacy PropsKit classes.
- Do **not** import from `reference/` at runtime. Reference files are studied, not linked.
- Do **not** introduce React, Tailwind, shadcn, or any UI library beyond FigUI3.
- Do **not** use forbidden words in any user-facing UI string (see `docs/04-glossary.md`).
- Do **not** ask the user to clarify the prompt unless it's internally contradictory. Make the call, note your assumption at the top of `code.ts` in a comment.

## The bar

- Plugin opens to controls only; **Generate** creates first output (Generators). Output within 2 seconds of that click.
- All controls are FigUI3 / PropsKit web components with correct panel spacing (240px, tight section headers).
- **Panel hugs content.** Auto-resize wired in both directions: `resize` message handled in `code.ts`, ResizeObserver + `scrollHeight` measurement in UI. No fixed heights. See `docs/08-figui3-ui.md > Auto-resize`.
- FigUI3 controls actually render (inlined bundle + `customElements.whenDefined` init).
- Commit-fire only. No live-drag updates. Control changes update the **selected tool output** only — do not stack new frames on every change.
- **Generate** adds a new output when no tool frame is selected; **never deletes** previous tool outputs on create. Update selected frame in place when one is selected.
- Default Generator footer: **Generate only**. No secondary footer buttons unless the prompt explicitly requests one and names its behavior.
- State persists on the output node via `setPluginData` (Generators).
- Stored node ids resolved with `getNodeByIdAsync`, not `getNodeById` (template uses `dynamic-page` access).
- Public open APIs allowed via pre-wired `networkAccess: ["*"]`; no API keys in UI (`docs/10-network-open-apis.md`).
- Relaunch buttons attached via `setRelaunchData` (both archetypes).
- `figma.command` handled at startup (both archetypes).
- Output looks intentional, not wireframe grey placeholder.
- No forbidden words anywhere a user can see.
- If the tool uses `<fig-input-color>`: `text="true" alpha="true" picker="figma"`, color-picker CSS block preserved, popover resize JS preserved (see `docs/08-figui3-ui.md > Color picker`).

## Figma MCP

If the user has Figma's MCP connected in Cursor, you can call it for reference designs or design system tokens. Use sparingly. The GenTool panel layout reference is [Generative tools effects](https://staging.figma.com/design/ChG6473qlBtfrv8VYx1jaR/Generative-tools-effects?node-id=17850-75051).
