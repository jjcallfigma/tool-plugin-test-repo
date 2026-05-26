# Glossary and forbidden words

## Use these terms

| Term | Meaning |
|---|---|
| **Tool** | The user-facing artifact. What we are building the analog of. |
| **Generator** | Tool that produces output and persistent controls. |
| **Action** | Tool that runs on existing content with a one-time effect. |
| **PropsKit** | The V1 GenTools control system. The only allowed control catalog. |
| **Tool host** | The node a tool is attached to. |
| **Generate** | Primary footer action that creates canvas output. Generators do not auto-run on plugin open. With no tool output selected, **adds** a new frame without deleting existing tool outputs. |
| **Regenerate** | A control change triggers a re-render of the **selected** tool output. No-op when nothing is selected. |
| **Output targeting** | Default Generator behavior: create vs update. Generate → add or update selected frame; control changes → update selected frame only. See `docs/07-plugin-practices.md`. |
| **Commit-fire** | Control change fires regenerate on release/blur, not on drag/keystroke. Gated on `outputSelected` after first Generate. |
| **PropsKit-styled** | Visual styling that matches Figma's right properties panel. |

## Never use in any UI string

These words leak the underlying tech and break the GenTool illusion. They are fine in code comments and internal docs but **forbidden** in anything the user reads.

- `plugin`
- `Code Object`
- `defineProperties`
- `Sinatra`
- `manifest`
- `widget`
- `extension`

## Substitutes

| Don't say | Say instead |
|---|---|
| "Plugin generated" | "Tool generated" |
| "Open the plugin" | "Open the tool" |
| "Plugin failed to load" | "Tool didn't load" |
| "Plugin settings" | "Controls" or just the control labels |
| "Widget" | "Tool" |
| "Extension" | "Tool" |
