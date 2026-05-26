/**
 * REFERENCE EXAMPLE — Action archetype.
 *
 * Tool: Layer Renamer
 * Does: Renames the user's selected layers using a chosen pattern.
 *
 * NOTE: GenTools Actions ALWAYS have a UI. This differs from typical Figma
 * plugins where an action could be a headless menu command with no UI.
 * Decision date: 2026-05-19. Rationale: GenTools is a unified surface
 * where every tool shows up in the same panel with the same affordances.
 * Single-action utility = one-button panel (parameter form + Apply).
 * Multi-action utility = multi-button panel (one button per action).
 *
 * Practices demonstrated (every Action should hit all of these):
 *   1. figma.showUI with themeColors: true (UI IS REQUIRED, even for Actions)
 *   2. Typed message contracts
 *   3. Action shape: NO persistent state on a node, NO regenerate
 *   4. UI is a one-button panel: user picks options, hits Apply
 *   5. Operate on figma.currentPage.selection
 *   6. Handle empty selection gracefully (figma.notify)
 *   7. setRelaunchData on the affected node(s) so user can re-run from Inspect panel
 *   8. figma.notify for success/failure feedback (never modals)
 *   9. Try/catch around mutations
 *  10. NO auto-run on load — Actions wait for the user to click Apply
 *
 * Read this top-to-bottom before writing a new Action.
 */

figma.showUI(__html__, { width: 280, height: 220, themeColors: true });

// ---- Message contracts ----

type Pattern = 'numbered' | 'hexcode' | 'role-based';

type UiToCodeMessage =
  | { type: 'apply'; prefix: string; pattern: Pattern }
  | { type: 'notify'; message: string };

// ---- Action ----

function buildName(prefix: string, pattern: Pattern, node: SceneNode, index: number): string {
  const base = prefix.trim();
  let suffix = '';

  if (pattern === 'numbered') {
    suffix = String(index + 1).padStart(2, '0');
  } else if (pattern === 'hexcode') {
    // Use the first solid fill's hex if available, else a hash-like fallback
    if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        const r = Math.round(fill.color.r * 255).toString(16).padStart(2, '0');
        const g = Math.round(fill.color.g * 255).toString(16).padStart(2, '0');
        const b = Math.round(fill.color.b * 255).toString(16).padStart(2, '0');
        suffix = `#${r}${g}${b}`.toUpperCase();
      } else {
        suffix = node.id.slice(-4);
      }
    } else {
      suffix = node.id.slice(-4);
    }
  } else if (pattern === 'role-based') {
    // Map node type to a designer-friendly role
    const roleMap: Record<string, string> = {
      TEXT: 'text',
      FRAME: 'frame',
      RECTANGLE: 'rect',
      ELLIPSE: 'ellipse',
      COMPONENT: 'component',
      INSTANCE: 'instance',
      GROUP: 'group',
    };
    suffix = roleMap[node.type] ?? node.type.toLowerCase();
  }

  return base ? `${base} ${suffix}` : suffix;
}

async function applyRename(prefix: string, pattern: Pattern): Promise<void> {
  try {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify('Select one or more layers first.');
      return;
    }

    let count = 0;
    selection.forEach((node, i) => {
      const newName = buildName(prefix, pattern, node, i);
      if (newName && newName !== node.name) {
        node.name = newName;
        count++;
      }

      // Wire up relaunch so the user can re-run on this node from Inspect
      if ('setRelaunchData' in node) {
        (node as SceneNode).setRelaunchData({ regenerate: 'Rename again' });
      }
    });

    figma.notify(`Renamed ${count} layer${count === 1 ? '' : 's'}.`);
  } catch (err) {
    figma.notify(`Rename failed: ${(err as Error).message}`);
  }
}

// ---- Message handlers ----

figma.ui.onmessage = async (msg: UiToCodeMessage) => {
  if (msg.type === 'apply') {
    await applyRename(msg.prefix, msg.pattern);
  } else if (msg.type === 'notify') {
    figma.notify(msg.message);
  }
};

// ---- Relaunch button handling ----

// If launched from a relaunch button, the parent already has the rename applied.
// You COULD auto-fire here if you stored the last pattern in setPluginData,
// but Actions typically don't persist state. Keep the UI open for the user
// to choose fresh options.
if (figma.command === 'regenerate') {
  figma.notify('Pick options and hit Apply to rename again.');
}
