# Figma plugin basics

This is the minimum you need to know to build a Figma plugin. If you have ever written one, skim and skip. The template already has the boilerplate set up.

## Architecture

A Figma plugin runs in two sandboxes:

1. **The plugin code (`code.ts`)** runs in Figma's plugin sandbox. It has access to the `figma` global, can read/write nodes, and can call most of the Plugin API. It has no DOM, no `window`, no `fetch` (unless `networkAccess` is configured).
2. **The UI (`ui.html`)** runs in a normal iframe with a full DOM. It cannot touch nodes directly. It communicates with the plugin code via `parent.postMessage`.

They talk through messages:

```ts
// In code.ts
figma.ui.postMessage({ type: 'something', payload: { x: 1 } });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'doThing') { ... }
};
```

```js
// In ui.html
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (msg.type === 'something') { ... }
};

parent.postMessage({ pluginMessage: { type: 'doThing', payload: { ... } } }, '*');
```

## Manifest essentials

```json
{
  "name": "Tool name (user-facing)",
  "id": "unique-id-string",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["*"],
    "reasoning": "Public open HTTP APIs only."
  }
}
```

- `name`: shown in the menu, in notifications. User-facing.
- `id`: any unique string. Internal.
- `main`: the compiled JS from `code.ts`.
- `ui`: the single HTML file (`ui.html`, generated from `ui.template.html`).
- `networkAccess`: the comparison template uses `["*"]` for public open APIs (no keys). See `docs/10-network-open-apis.md`. Do not edit the manifest per generation run.

## The Plugin API methods you will use most

- `figma.currentPage` — current page
- `figma.currentPage.selection` — array of selected nodes
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createText()`, `figma.createEllipse()`, `figma.createComponent()`
- `figma.viewport.scrollAndZoomIntoView([node])` — center on the output
- `figma.loadFontAsync({ family: 'Inter', style: 'Regular' })` — required before setting text
- `node.x`, `node.y`, `node.resize(w, h)`, `node.fills`, `node.strokes`, `node.cornerRadius`, `node.effects`
- `node.appendChild(child)` — for nesting
- `node.layoutMode`, `node.primaryAxisSizingMode`, `node.counterAxisSizingMode` — auto layout
- `node.setPluginData(key, value)` and `node.getPluginData(key)` — persist tool state on the node
- `figma.getNodeByIdAsync(id)` — resolve a node from a stored id (required in this workspace; see below)
- `figma.notify('message')` — tiny notification toast
- `figma.closePlugin('optional final message')` — close

## Common patterns

### Open the plugin with a UI

```ts
figma.showUI(__html__, { width: 240, height: 480, themeColors: true });
```

`themeColors: true` makes the UI respect Figma's light/dark theme via CSS variables. Use **240px width** for GenTool panels. See `docs/08-figui3-ui.md` for height guidance.

### Load a font before creating text

```ts
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
const text = figma.createText();
text.characters = 'Hello';
```

### Auto-layout frame

```ts
const frame = figma.createFrame();
frame.layoutMode = 'VERTICAL';
frame.primaryAxisSizingMode = 'AUTO';
frame.counterAxisSizingMode = 'AUTO';
frame.itemSpacing = 8;
frame.paddingTop = 16;
frame.paddingBottom = 16;
frame.paddingLeft = 16;
frame.paddingRight = 16;
```

### Set a solid fill

```ts
node.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97 } }];
```

Colors in the Plugin API are 0-1 floats. Convert from hex like:

```ts
const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
};
```

### Persist tool state

```ts
// Save
node.setPluginData('toolState', JSON.stringify(state));

// Load
const raw = node.getPluginData('toolState');
const state = raw ? JSON.parse(raw) : defaultState;
```

### Resolve a stored node id

The comparison template uses `"documentAccess": "dynamic-page"`. Do **not** call `figma.getNodeById` — it throws. When `toolState` stores a node id (source frame, target layer, etc.):

```ts
const node = await figma.getNodeByIdAsync(state.sourceFrameId);
if (!node || node.removed) {
  figma.notify('Source frame was deleted.');
  return;
}
```

Use inside `async` handlers (`regenerate`, `onmessage`, relaunch startup). Full detail: `docs/07-plugin-practices.md`.

### Listen for selection change

```ts
figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection[0];
  if (sel) {
    const raw = sel.getPluginData('toolState');
    if (raw) {
      figma.ui.postMessage({ type: 'loadState', state: JSON.parse(raw) });
    }
  }
});
```

## Compiling and bundling the UI

The plugin has two build steps:

1. **UI:** `ui.template.html` → `ui.html` (inlines FigUI3 CSS/JS)
2. **Sandbox:** `code.ts` → `code.js` (TypeScript)

```bash
cd template
npm install          # installs @rogieking/figui3, copies vendor files, runs bundle-ui
npm run build        # bundle-ui + tsc
npm run bundle-ui    # regenerate ui.html after UI edits only
npm run watch        # tsc --watch (re-run bundle-ui manually when UI changes)
```

**Always run `bundle-ui` after editing `ui.template.html`.** Figma loads `ui.html`, not the template. See `docs/08-figui3-ui.md` for why FigUI3 must be inlined.

## Loading in Figma

1. Build (`npm run build`) or at minimum `npm run bundle-ui && npx tsc`.
2. Open Figma desktop. Plugins → Development → Import plugin from manifest.
3. Pick the `manifest.json`.
4. Plugins → Development → [Your tool name] to run.

If controls appear missing, right-click the plugin panel → **Inspect** (iframe DevTools). The main Figma console does not show UI errors.

## Gotchas

- **Text fonts must be loaded before set.** `loadFontAsync` is async — use `await` or `.then()`.
- **You cannot directly assign to `node.fills`** — assign a new array. Same for `strokes`, `effects`, `children`.
- **Color values are 0-1 floats**, not 0-255.
- **`figma.viewport.center` and `zoom`** are read-write — useful for centering on the output.
- **`networkAccess`** must be declared in the manifest. This repo’s template allows public open APIs (`["*"]`); see `docs/10-network-open-apis.md`.
- **UI height/width** must be set explicitly in `figma.showUI`. Default is 300×200.
