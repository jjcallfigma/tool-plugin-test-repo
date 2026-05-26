/**
 * Tool: (not built yet)
 * Sandbox entry — replaced when you paste a generation prompt.
 * Network: template manifest allows public open API fetch in code.ts (no API keys).
 * See docs/10-network-open-apis.md.
 */

figma.showUI(__html__, { width: 240, height: 320, themeColors: true });

figma.ui.onmessage = (msg: { type: string; height?: number }) => {
  // Auto-resize: every GenTool panel hugs its content. See docs/08-figui3-ui.md.
  if (msg && msg.type === 'resize' && typeof msg.height === 'number') {
    const h = Math.max(120, Math.min(900, Math.round(msg.height)));
    figma.ui.resize(240, h);
  }
};
