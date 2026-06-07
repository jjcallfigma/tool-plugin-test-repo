# Plugin practices

The complete list of techniques every GenTool-style plugin must use. Treat as a checklist. Cross-reference with the worked examples in `reference/`.

## The two archetypes

| Archetype | When | Has UI? | Persists state? | Has regenerate? | First run |
|---|---|---|---|---|---|
| **Generator** | Produces output + persistent controls | Yes (PropsKit panel) | Yes, on the output node | Yes, after Generate + on control change | **Generate** button |
| **Action** | Operates on existing content, one-shot | **Yes** (one-button or multi-button panel) | No | No | **Apply** button |

> **Every tool has a UI.** This is GenTools-specific (decision 2026-05-19). Differs from typical Figma plugins where actions can be headless menu commands. Single-action utilities are a parameter form + Apply button. Multi-action utilities are one button per action. No headless tools.

## Manifest practices

### Always set `themeColors` via `figma.showUI`

```ts
figma.showUI(__html__, { width: 240, height: 320, themeColors: true });
```

- **`width: 240`** — GenTool panel spec (see `docs/08-figui3-ui.md`).
- **`height`** — initial splash height only. The UI must auto-resize to its real content (see **Auto-resize** in `docs/08-figui3-ui.md`). 320 is a safe starting value.
- **`themeColors: true`** exposes `--figma-color-*` and `--spacer-*` CSS variables for FigUI3 light/dark theme.

### Always handle the `resize` message

Every GenTool panel hugs its content (initial paint + collapsible row transitions). Wire this in `code.ts`:

```ts
type UiToCodeMessage = /* ... */ | { type: 'resize'; height: number };

figma.ui.onmessage = async (msg: UiToCodeMessage) => {
  if (msg.type === 'resize') {
    const h = Math.max(120, Math.min(900, Math.round(msg.height)));
    figma.ui.resize(240, h);
    return;
  }
  // ... other handlers ...
};
```

The scaffold ships this. The UI side (ResizeObserver on `#plugin-root` reading `entry.contentRect.height`, plus a `html, body, #plugin-root { height: auto }` override of FigUI3's `height: 100%`) is documented in `docs/08-figui3-ui.md > Auto-resize`. Do not skip it — fixed heights produce wasted whitespace or scrollbars.

### Declare `relaunchButtons` in the manifest

The manifest's `relaunchButtons` array declares which command names are valid for `setRelaunchData`. The template ships with two pre-declared:

```json
"relaunchButtons": [
  { "command": "regenerate", "name": "Regenerate", "multipleSelection": false },
  { "command": "edit", "name": "Edit", "multipleSelection": false }
]
```

Cursor: don't touch the manifest. Use the two commands that are already there (`regenerate`, `edit`).

### Always set `documentAccess: "dynamic-page"`

Pre-set in the template manifest. Allows the plugin to walk pages other than the current one.

With `dynamic-page`, **`figma.getNodeById()` is not allowed** — it throws at runtime. Any time you resolve a node from an id stored in `toolState` (source frame, linked layer, etc.), use the async API inside an `async` handler:

```ts
async function resolveNode(id: string): Promise<FrameNode | null> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.removed || node.type !== 'FRAME') return null;
  return node;
}

// Inside regenerate, onmessage, or relaunch startup:
const source = await resolveNode(state.sourceFrameId);
```

| Situation | API |
|---|---|
| Id from persisted `toolState` / `setPluginData` | `await figma.getNodeByIdAsync(id)` |
| Node you just created, or `figma.currentPage.selection` | Use the reference directly — no id lookup |

Tools that never store foreign node ids (only `currentOutput` in memory) may never call `getNodeByIdAsync`. As soon as `toolState` includes a node id, this is mandatory — not optional.

### Public open APIs (`networkAccess`)

The template manifest allows `fetch` via `allowedDomains: ["*"]` (see **`docs/10-network-open-apis.md`**). Do **not** edit `manifest.json` per tool — network is pre-wired.

| Allowed (V1) | Not allowed (V1) |
|---|---|
| Public HTTPS endpoints with no API key | Key/token fields in the UI |
| `fetch` in `code.ts` inside `generate` / `regenerate` / Apply | Auth headers, OAuth, private APIs |
| Errors via `figma.notify` in `try/catch` | Background polling; fetch on plugin open (Generators) |

```ts
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}
```

Comment the API URL at the top of `code.ts`. Tools with no network needs should not call `fetch`.

## State persistence (Generator only)

### Persist state on the output node, not in clientStorage

```ts
frame.setPluginData('toolState', JSON.stringify(state));
frame.setPluginData('toolId', TOOL_ID); // for safe identification later
```

State **on the node** means the output is self-contained. Copy the frame, paste in another file, the controls still work. `clientStorage` is per-user-per-machine and the wrong tool for this.

### Rehydrate the UI on `selectionchange`

```ts
figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection[0];
  if (!sel) return;

  // Only respond to nodes this tool created
  if (sel.getPluginData('toolId') !== TOOL_ID) return;

  const raw = sel.getPluginData('toolState');
  if (!raw) return;

  figma.ui.postMessage({ type: 'loadState', state: JSON.parse(raw) });
});
```

This is how the controls come back the way the user left them.

## Relaunch buttons (Generators AND Actions)

Relaunch data serves two roles. Use **both** when applicable — they do not conflict.

### Page level — discovery (every tool)

On plugin open, attach relaunch data to **`figma.currentPage`** so the tool appears in the page properties panel while browsing the file. This is how users discover the tool without selecting an output node first.

```ts
function setPageRelaunchForDiscovery(): void {
  figma.currentPage.setRelaunchData({
    edit: 'Open this tool',
  });
}

figma.showUI(__html__, { width: 240, height: 320, themeColors: true });
setPageRelaunchForDiscovery();
```

The scaffold ships this helper. **Always call it once at startup.** Use the `edit` command only at page level — `regenerate` belongs on nodes that hold state or were modified.

Action utilities that never create output nodes rely on page-level relaunch for discovery. Generators still need page-level relaunch **in addition to** output-node relaunch below.

### Node level — attachment (when the tool touches nodes)

When the tool creates or modifies nodes, also attach relaunch data on those nodes so Regenerate / Edit follow the selection in the Inspect panel.

```ts
// Generator: after creating the output frame
frame.setRelaunchData({
  regenerate: 'Regenerate with current values',
  edit: 'Open this tool to edit',
});

// Action: after operating on selected nodes (optional — page level still required)
selectedNode.setRelaunchData({ regenerate: 'Run this action again' });
```

The user sees "Regenerate" and "Edit" on the output frame when they select it. Page-level `edit` remains available when nothing is selected.

### Handle the launch path with `figma.command`

When the user clicks a relaunch button, `figma.command` is set to the matching command name at plugin startup. Handle it:

```ts
if (figma.command === 'regenerate') {
  // Auto-fire regenerate using the state stored on the selected node
  const sel = figma.currentPage.selection[0];
  if (sel) {
    const raw = sel.getPluginData('toolState');
    if (raw) regenerate(JSON.parse(raw));
  }
} else if (figma.command === 'edit') {
  // Just open the UI — selectionchange handler will load state
}
```

Without this, the plugin opens but ignores the relaunch context.

## Output node practices

### Always wrap in a single frame

One output node, not many. Easier to attach state to. Easier to move/copy.

```ts
const frame = figma.createFrame();
frame.layoutMode = 'VERTICAL'; // or HORIZONTAL
frame.primaryAxisSizingMode = 'AUTO';
frame.counterAxisSizingMode = 'AUTO';
// ... build children ...
```

Auto-layout means the frame resizes correctly as content changes.

### Center the viewport after producing output

```ts
figma.viewport.scrollAndZoomIntoView([frame]);
```

User just hit "generate" — show them the result.

### Remove the previous output before building a new one

When **updating** the selected tool frame, remove that frame first, rebuild at the **same x/y**, and re-select it. When **creating** a new output (Generate with no tool frame selected), **leave existing tool outputs on the canvas** and add a new frame at the viewport center.

```ts
if (mode === 'update') {
  const existing = getSelectedToolFrame();
  if (!existing) return; // control change with nothing selected — no-op
  posX = existing.x;
  posY = existing.y;
  existing.remove();
}
```

Otherwise regenerate stacks output on top of output. Mess.

### Output targeting (Generators) — when to create vs update

Commit-fire `regenerate` must **not** spawn a new frame on every control change.

| User action | Expected behavior |
|---|---|
| **Generate** with no tool output frame selected | Create a **new** frame (keep any existing tool outputs) |
| **Generate** with this tool's output frame selected | **Update** that frame (same position) |
| **Control change** after first run, tool output **selected** | **Update** selected frame in place |
| **Control change** with **nothing** selected (or non-tool selection) | **No-op** — wait for Generate |
| Re-select an existing tool output | Rehydrate UI (`loadState`); control changes update that frame |

Implement in `code.ts`:

1. `getSelectedToolFrame()` — returns the selected frame only if `getPluginData('toolId')` matches this tool.
2. `regenerate(state, 'create' | 'update')`:
   - **`update`** — remove **only** the selected tool frame, rebuild at the same x/y.
   - **`create`** — **never** remove `currentOutput` or any other tool frame; add a new frame at the viewport center.
3. `figma.ui.postMessage({ type: 'outputSelected', selected: boolean })` on `selectionchange` so the UI only sends `regenerate` when an output is selected.
4. A simple `isRegenerating` guard to prevent overlapping async rebuilds from stacking frames.

**Critical:** `create` mode must not call `currentOutput.remove()`. That pattern deletes the user's previous output when they click Generate to make a second chart. Only the frame explicitly selected for update may be removed.

**Do not** add secondary footer buttons (Reshuffle, Reset, etc.) unless the user's prompt explicitly asks for one **and** describes what it does. Default Generator footer: **Generate only**.

## Text and fonts

### Always `await loadFontAsync` before setting text

```ts
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
const text = figma.createText();
text.characters = 'Hello';
```

If you skip this, `text.characters =` throws. Always.

## Colors

### Colors are 0-1 floats, not 0-255

```ts
const hexToRgb = (hex: string): RGB => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
};

const solidFill = (hex: string): SolidPaint => ({
  type: 'SOLID',
  color: hexToRgb(hex),
});

rect.fills = [solidFill('#0D99FF')];
```

### Never mutate `fills`, `strokes`, `effects` arrays — replace them

```ts
// Wrong
rect.fills.push(newFill);

// Right
rect.fills = [...rect.fills, newFill];
```

The Plugin API returns frozen arrays.

## Message passing

### Type the contracts on both sides

```ts
type UiToCodeMessage =
  | { type: 'generate'; state: State }
  | { type: 'regenerate'; state: State }
  | { type: 'notify'; message: string };

type CodeToUiMessage =
  | { type: 'loadState'; state: State }
  | { type: 'outputSelected'; selected: boolean };

figma.ui.onmessage = async (msg: UiToCodeMessage) => { ... };
```

No `any`. Future-you will thank present-you.

### UI sends with `parent.postMessage({ pluginMessage: ... })`

```js
parent.postMessage({
  pluginMessage: { type: 'regenerate', state: getStateFromForm() }
}, '*');
```

### UI receives via `window.onmessage`, message lives on `event.data.pluginMessage`

```js
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (msg.type === 'loadState') { ... }
};
```

## UI behavior

Read **`docs/08-figui3-ui.md`** for the full FigUI3 setup. Summary:

### Edit `ui.template.html`, bundle to `ui.html`

The UI source is `template/src/ui.template.html`. Run `npm run bundle-ui` after edits. Figma loads the generated `ui.html` with FigUI3 inlined.

### Wait for custom elements, then init — no auto-generate on open

FigUI3 registers web components asynchronously. **Do not use `DOMContentLoaded` alone.** Do **not** post `generate` from `init()` — wait for the user to click the primary footer button.

Use this init shape (see also `docs/08-figui3-ui.md > Generator init pattern`):

```js
var hasGenerated = false;
var outputSelected = false;

function fireRegenerate() {
  if (!hasGenerated || !outputSelected) return;
  parent.postMessage({ pluginMessage: { type: 'regenerate', state: getStateFromForm() } }, '*');
}

Promise.all([
  customElements.whenDefined('fig-group'),
  customElements.whenDefined('fig-field'),
  customElements.whenDefined('fig-dropdown'),
  customElements.whenDefined('fig-slider'),
  customElements.whenDefined('fig-button'),
]).then(function () {
  document.getElementById('run').addEventListener('click', function () {
    hasGenerated = true;
    parent.postMessage({ pluginMessage: { type: 'generate', state: getStateFromForm() } }, '*');
  });

  document.querySelectorAll('fig-slider, fig-dropdown').forEach(function (el) {
    el.addEventListener('change', fireRegenerate);
  });
});

window.onmessage = function (event) {
  var msg = event.data.pluginMessage;
  if (msg && msg.type === 'loadState') {
    setStateInForm(msg.state);
    hasGenerated = true;
  }
  if (msg && msg.type === 'outputSelected') {
    outputSelected = !!msg.selected;
  }
};
```

When rehydrating from a selected output node (`loadState`), set `hasGenerated = true` so controls commit-fire again without forcing a new first run. Only post `regenerate` when `outputSelected` is true (see **Output targeting** above). The sandbox decides create vs update for `{ type: 'generate' }` — **create must not remove other tool outputs**.

### Panel layout and spacing

Use `<fig-group>`, `<fig-header borderless>`, `<fig-footer borderless>`. Copy the spacing override CSS from `docs/08-figui3-ui.md` into every tool UI. Match the [Generative tools effects panel](https://staging.figma.com/design/ChG6473qlBtfrv8VYx1jaR/Generative-tools-effects?node-id=17850-75051).

### Footer must use `.footer-actions`

Every Generator (and Action) ships its footer button(s) wrapped in `<div class="footer-actions">`. Spec: 16px sides, 12px top + bottom, 8px between buttons. See `docs/08-figui3-ui.md > Footer spec`.

```html
<fig-footer borderless>
  <div class="footer-actions">
    <fig-button id="run" variant="primary">Generate</fig-button>
  </div>
</fig-footer>
```

Default: **one primary Generate button**. Add a secondary footer button only when the user's prompt explicitly requests it and names its behavior (e.g. "Reshuffle layout" that re-rolls random layout). Do not copy Reshuffle from examples unless asked.

### Commit-fire, not input-fire

Bind to `change` on FigUI3 components, NEVER `input`:

- Sliders fire on release
- Number/text inputs fire on blur or Enter
- Dropdowns and switches fire when value changes
- Color pickers fire when picker closes

This is non-negotiable. V1 GenTools does not live-update during drag.

### Actions wait for a footer button, no auto-run

```js
// Inside init(), after customElements.whenDefined:
document.getElementById('apply').addEventListener('click', function () {
  parent.postMessage({
    pluginMessage: { type: 'apply', /* ... form values ... */ },
  }, '*');
});
```

## Feedback

### Use `figma.notify` for messages, never modals

```ts
figma.notify('Renamed 12 layers.');
figma.notify(`Could not regenerate: ${err.message}`);
```

One line, ephemeral. Errors, success counts, warnings — all `notify`.

### Wrap mutations in try/catch

```ts
async function regenerate(state: State): Promise<void> {
  try {
    // ... mutations ...
  } catch (err) {
    figma.notify(`Could not regenerate: ${(err as Error).message}`);
  }
}
```

User gets the error message instead of a silent failure.

## Forbidden words in UI strings

Never use in any string the user sees: `plugin`, `Code Object`, `defineProperties`, `Sinatra`, `manifest`, `widget`, `extension`. Use `tool` instead. See `docs/04-glossary.md`.

## The full checklist

### Generator checklist

- [ ] `figma.showUI(__html__, { width: 240, themeColors: true, height: 320 })` (initial splash; UI auto-resizes)
- [ ] `resize` message handler in `code.ts` calls `figma.ui.resize(240, clamped)`
- [ ] Typed `State`, `UiToCodeMessage`, `CodeToUiMessage`
- [ ] `defaultState` with sensible values
- [ ] `regenerate(state, 'create' | 'update')` function that:
  - [ ] **`update` only:** removes the **selected** tool frame, preserves x/y
  - [ ] **`create`:** adds a new frame; **does not** remove other tool outputs or `currentOutput`
  - [ ] Awaits `loadFontAsync` if creating text
  - [ ] Builds a single auto-layout frame
  - [ ] Sets `setPluginData('toolState', ...)` on the output
  - [ ] Sets `setPluginData('toolId', TOOL_ID)`
  - [ ] Sets `setRelaunchData({ regenerate, edit })` on the output frame
  - [ ] Calls `setPageRelaunchForDiscovery()` on `figma.currentPage` at startup
  - [ ] Calls `viewport.scrollAndZoomIntoView` on **create** only
  - [ ] Wrapped in try/catch with `figma.notify` on error
  - [ ] Uses `isRegenerating` guard
- [ ] `getSelectedToolFrame()` + `outputSelected` postMessage on selectionchange
- [ ] `figma.ui.onmessage`: `generate` → create or update if tool frame selected; `regenerate` → update only
- [ ] If `toolState` stores node ids, lookups use `await figma.getNodeByIdAsync` (never `figma.getNodeById` — required with `documentAccess: "dynamic-page"`)
- [ ] `figma.on('selectionchange', ...)` rehydrates the UI
- [ ] `figma.command === 'regenerate'` triggers an immediate regenerate from stored state
- [ ] Primary **Generate** button in `fig-footer`; buttons wrapped in `<div class="footer-actions">` (12/16/8 spec); **no** `generate` message on plugin open
- [ ] After first Generate (or `loadState` from existing output), controls commit-fire `regenerate` **only when a tool output frame is selected** (`outputSelected` + `getSelectedToolFrame`)
- [ ] Generate creates a new frame when no tool output is selected — **existing tool outputs stay on the canvas**
- [ ] Generate with a tool output selected updates that frame in place
- [ ] Control changes no-op when nothing selected
- [ ] Footer has **Generate only** unless the prompt explicitly requested a named secondary action
- [ ] UI in `ui.template.html`; `npm run bundle-ui` run to generate `ui.html`
- [ ] FigUI3 inlined (no external script/link tags); init waits on `customElements.whenDefined`
- [ ] Panel spacing CSS copied from `docs/08-figui3-ui.md`
- [ ] UI uses **FigUI3 web components** only (`docs/02-propskit-reference.md`)
- [ ] All controls bind to `change`, not `input`
- [ ] UI listens for `loadState` messages and rehydrates the form
- [ ] If using a public API: `fetch` in `code.ts`, no API keys, errors via `figma.notify` (see `docs/10-network-open-apis.md`)

### Action checklist

- [ ] `figma.showUI(__html__, { width: 240, themeColors: true, height: 320 })` (initial splash; UI auto-resizes)
- [ ] `resize` message handler in `code.ts` calls `figma.ui.resize(240, clamped)`
- [ ] Typed message contracts
- [ ] Action function operates on `figma.currentPage.selection`
- [ ] If operating on ids from stored metadata, use `await figma.getNodeByIdAsync` (never `figma.getNodeById`)
- [ ] Empty-selection case handled with `figma.notify`
- [ ] `setPageRelaunchForDiscovery()` on `figma.currentPage` at startup
- [ ] Optional: `setRelaunchData` on each affected node for re-run from Inspect
- [ ] Success or count reported via `figma.notify`
- [ ] Wrapped in try/catch with `figma.notify` on error
- [ ] UI in `ui.template.html`; bundled via `npm run bundle-ui`
- [ ] FigUI3 init waits on `customElements.whenDefined`; panel spacing from `docs/08-figui3-ui.md`
- [ ] UI has a clear Apply button in `fig-footer`, wrapped in `<div class="footer-actions">` (12/16/8 spec), no auto-run
- [ ] No `setPluginData` (Actions are stateless)
- [ ] No `selectionchange` rehydration (no state to load)
- [ ] No `regenerate` function
- [ ] If using a public API: `fetch` in `code.ts`, no API keys (see `docs/10-network-open-apis.md`)

## Want to see this in practice?

- `reference/01-generator-color-swatch/code.ts` — Generator sandbox with all practices wired
- `reference/02-action-layer-renamer/code.ts` — Action sandbox with all practices wired
- `template/src/ui.template.html` — FigUI3 UI with correct panel layout and spacing (Bento Grid)
- `docs/08-figui3-ui.md` — why controls render, bundling, init, spacing CSS
