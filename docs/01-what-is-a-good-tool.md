# What is a good GenTool

A GenTool is the user-facing artifact when someone asks Figma's Assistant to "make me a tool for X." It is AI-generated, persistent, and attached to a node. The user never sees the plugin foundation underneath.

For this Cursor demo, you are building a real Figma plugin that mimics the shape and feel of a GenTool. Use this doc to understand the bar.

## The three shapes a tool can take

**Generator.** Produces output and persistent controls. State lives on the node. Examples: bento grid, 3D sphere, shadow builder, mock user roster, mesh gradient. After the tool runs, the user sees output on canvas AND a control panel they can keep tweaking.

**Action.** Runs on existing content. **Always has a UI surface** — single-action utilities as one-button panels (parameter form + Apply), multi-action utilities as multi-button panels. Examples: layer cleanup, color extractor, spec sheet. The tool acts on what's selected, reports what it did, exits or stays available.

> **Important — this differs from typical Figma plugins.** Real-world Figma plugins can run as headless commands (a menu invocation that just does the thing, no UI). GenTools made the deliberate call that **every tool has a UI**, including Actions. The rationale: GenTools is a unified surface where every tool surfaces the same way and offers the same affordances. A "select all rectangles" command, if built as a GenTool Action, would still show a one-button panel with a Scope dropdown and an Apply button. Decision date: 2026-05-19.

**Effect.** Reactive visual treatment driven by GPU. Out of scope for this demo. Listed here only so you know not to build one.

## Hard constraints (do not break)

1. **One artifact per prompt.** A single plugin, single manifest, single UI file. Not a bundle.
2. **Explicit first run (Generators).** No canvas output until the user clicks **Generate**. After that, controls commit-fire `regenerate` on change **only while a tool output frame is selected**. **Generate** adds a new frame when no tool output is selected — **without deleting existing tool outputs**. (Actions wait for **Apply**.)
3. **Every tool has a UI.** Including Actions. No headless tools. Single-action utilities are one-button panels with a parameter form. Multi-action utilities have one button per action. See note above on why this differs from typical Figma plugins.
4. **Persistent controls (Generators).** A Generator's controls stay available. State on the node, restored when the user re-opens the plugin or re-selects the node.
5. **Set, then regenerate (Generators).** Generator controls do not live-update during interaction. The user commits a value (releases the slider, picks a dropdown option, blurs the input), and *then* the canvas updates. No real-time reactivity in V1.
6. **Layers stay editable.** The output is real Figma nodes the user can ungroup, restyle, delete, or duplicate. The tool does not freeze its host node.
7. **One screen.** No wizards, no multi-step setup. All controls visible at once.
8. **Sensible defaults.** Every control has a default value chosen to make the first render look intentional, not "empty placeholder grey."

## The happy path you are building toward

1. User opens your plugin (the equivalent of pasting a prompt into Assistant).
2. User sees a control panel with PropsKit-style controls. **Canvas is unchanged.**
3. User clicks **Generate**. A frame appears on canvas with the tool's default output.
4. User clicks **Generate** again (nothing selected) → a **second** frame appears; the first remains.
5. User selects an output frame and changes a control → that frame **updates in place** (same position).
6. User changes a control with **nothing** selected → canvas unchanged until they select an output or click Generate.
7. User closes plugin. State persists on the node.
8. User re-selects the node later, re-opens the plugin. Same controls, same values — edit and regenerate without a forced re-run on open.

If your plugin does not deliver that happy path, it does not pass.

## Quality bar (what "good" looks like)

- **Time to first render: under 2 seconds after Generate.** User clicks Generate; output appears quickly.
- **Output looks intentional.** Default state should look like something a designer would put on a slide, not a wireframe.
- **Controls map cleanly to outcomes.** If the user changes "Density" from low to high, they should see exactly the change they expected. No surprise side effects.
- **Failure states are quiet.** If something goes wrong (no selection, invalid input), surface a single-line notification via `figma.notify`. Never a modal.

## Out of scope for this demo

- No real LLM calls inside the plugin. The plugin is the *output* of an LLM, it does not call one.
- No persistence across files. `setPluginData` on the node is enough.
- No multiplayer or collaboration features.
- No accounts, no API keys, no authenticated/private services. **Public open HTTP APIs** (no auth) are OK when the prompt needs live data — see `docs/10-network-open-apis.md`.
- No code editor surface. The user never sees the plugin's source.

## Glossary

| Term | Meaning |
|---|---|
| **GenTool / tool** | The user-facing artifact. What you are building the analog of. |
| **Generator** | Tool that produces output and persistent controls. State on the node. |
| **Action** | Tool that runs on existing content. Always has a UI surface. |
| **PropsKit** | The V1 GenTools control system. The catalog of allowed control types. See `02-propskit-reference.md`. |
| **Tool host** | The node a tool is attached to. Use this instead of "selection" when persistence is the point. |
| **Generate (first run)** | User clicks the primary footer button; canvas output is not created on plugin open. |
| **Regenerate** | A control change triggers a re-render of the tool's output. |

## Words you do not use in any UI string

`plugin`, `Code Object`, `defineProperties`, `Sinatra`, `manifest`, `widget`. The user sees `tool`. Everything else is internal.
