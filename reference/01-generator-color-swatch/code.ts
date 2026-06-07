/**
 * REFERENCE EXAMPLE — Generator archetype.
 *
 * Tool: Color Swatch Grid
 * Does: Produces a horizontal row of colored swatches with persistent controls.
 *
 * Practices demonstrated (every Generator should hit all of these):
 *   1. figma.showUI with themeColors: true
 *   2. Typed message contracts (UI ↔ code)
 *   3. State type with sensible defaults
 *   4. Output targeting — update selected tool frame in place; Generate adds a new
 *      frame without deleting other tool outputs (see docs/07 > Output targeting)
 *   5. loadFontAsync before any text creation (skipped here — no text nodes)
 *   6. RGB conversion helper (Figma uses 0-1 floats)
 *   7. setPluginData('toolState', ...) — persists state ON the node
 *   8. setPluginData('toolId', ...) — safe identification on selection
 *   9. setRelaunchData — page level for discovery; output frame for Regenerate / Edit
 *  10. viewport.scrollAndZoomIntoView — centers user on new output only
 *  11. selectionchange listener — rehydrates the UI + posts outputSelected
 *  12. figma.command handling — detects launch via relaunch button vs. menu
 *  13. Try/catch around the regenerate body — surface failures via figma.notify
 *
 * Read this top-to-bottom before writing a new Generator.
 */

figma.showUI(__html__, { width: 280, height: 480, themeColors: true });

function setPageRelaunchForDiscovery(): void {
  figma.currentPage.setRelaunchData({
    edit: 'Open this tool',
  });
}
setPageRelaunchForDiscovery();

type State = {
  count: number;
  cellSize: number;
  cornerRadius: number;
  color: string;
  gap: number;
};

type UiToCodeMessage =
  | { type: 'generate'; state: State }
  | { type: 'regenerate'; state: State }
  | { type: 'notify'; message: string };

type CodeToUiMessage =
  | { type: 'loadState'; state: State }
  | { type: 'outputSelected'; selected: boolean };

const TOOL_ID = 'reference-color-swatch';

const defaultState: State = {
  count: 5,
  cellSize: 56,
  cornerRadius: 8,
  color: '#0D99FF',
  gap: 8,
};

let currentOutput: FrameNode | null = null;
let isRegenerating = false;

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

function getSelectedToolFrame(): FrameNode | null {
  const sel = figma.currentPage.selection[0];
  if (sel?.type === 'FRAME' && sel.getPluginData('toolId') === TOOL_ID) {
    return sel;
  }
  return null;
}

function postOutputSelected(selected: boolean): void {
  figma.ui.postMessage({ type: 'outputSelected', selected });
}

async function regenerate(state: State, mode: 'create' | 'update'): Promise<void> {
  if (isRegenerating) return;
  isRegenerating = true;

  try {
    let posX = 0;
    let posY = 0;

    if (mode === 'update') {
      const existing = getSelectedToolFrame();
      if (!existing) return;
      posX = existing.x;
      posY = existing.y;
      existing.remove();
    }

    const frame = figma.createFrame();
    frame.name = 'Color Swatch Grid';
    frame.layoutMode = 'HORIZONTAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
    frame.itemSpacing = state.gap;
    frame.paddingTop = state.gap;
    frame.paddingBottom = state.gap;
    frame.paddingLeft = state.gap;
    frame.paddingRight = state.gap;
    frame.fills = [];

    for (let i = 0; i < state.count; i++) {
      const swatch = figma.createRectangle();
      swatch.resize(state.cellSize, state.cellSize);
      swatch.cornerRadius = state.cornerRadius;
      swatch.fills = [solidFill(state.color)];
      swatch.opacity = 1 - (i % 4) * 0.15;
      frame.appendChild(swatch);
    }

    frame.setPluginData('toolState', JSON.stringify(state));
    frame.setPluginData('toolId', TOOL_ID);
    frame.setRelaunchData({
      regenerate: 'Regenerate with current values',
      edit: 'Open this tool to edit',
    });

    if (mode === 'update') {
      frame.x = posX;
      frame.y = posY;
    } else {
      frame.x = figma.viewport.center.x - frame.width / 2;
      frame.y = figma.viewport.center.y - frame.height / 2;
      figma.viewport.scrollAndZoomIntoView([frame]);
    }

    currentOutput = frame;
    figma.currentPage.selection = [frame];
    postOutputSelected(true);
  } catch (err) {
    figma.notify(`Could not regenerate: ${(err as Error).message}`);
  } finally {
    isRegenerating = false;
  }
}

figma.ui.onmessage = async (msg: UiToCodeMessage) => {
  if (msg.type === 'generate') {
    const selected = getSelectedToolFrame();
    await regenerate(msg.state, selected ? 'update' : 'create');
  } else if (msg.type === 'regenerate') {
    await regenerate(msg.state, 'update');
  } else if (msg.type === 'notify') {
    figma.notify(msg.message);
  }
};

figma.on('selectionchange', () => {
  const toolFrame = getSelectedToolFrame();
  postOutputSelected(!!toolFrame);

  if (!toolFrame) return;

  const raw = toolFrame.getPluginData('toolState');
  if (!raw) return;

  figma.ui.postMessage({ type: 'loadState', state: JSON.parse(raw) as State });
  currentOutput = toolFrame;
});

if (figma.command === 'regenerate') {
  const sel = getSelectedToolFrame();
  if (sel) {
    const raw = sel.getPluginData('toolState');
    if (raw) {
      void regenerate(JSON.parse(raw) as State, 'update');
    }
  }
}

void defaultState;
