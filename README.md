# CursorVsAgent

Side-by-side comparison: **Cursor + Claude building a Figma plugin** vs **Figma's Assistant building a GenTool**. Same prompt, two environments.

The premise: GenTools are plugins under the hood. If Cursor + Claude can produce a working, polished plugin from the same prompt in under 3 minutes, and Assistant is taking 20, that's the gap to talk about.

This workspace is the Cursor side of the comparison. It's loaded with everything Cursor needs to produce a GenTool-quality plugin from a paste-ready prompt.

## Workspace map

```
CursorVsAgent/
├── README.md                       ← you are here
├── AGENTS.md                       ← Cursor reads this automatically
├── .cursor/
│   └── rules/
│       ├── 00-philosophy.mdc       ← always-on rules
│       ├── 05-custom-tool-trigger.mdc  ← always-on: "Create a custom tool" → build plugin
│       ├── 10-plugin-code.mdc      ← auto-attaches when editing code.ts
│       ├── 20-ui-html.mdc          ← auto-attaches when editing ui.template.html / ui.html
│       └── 30-manifest.mdc         ← auto-attaches when editing manifest.json
├── docs/
│   ├── 01-what-is-a-good-tool.md
│   ├── 02-propskit-reference.md
│   ├── 03-figma-plugin-basics.md
│   ├── 04-glossary.md
│   ├── 05-test-prompts.md
│   ├── 06-test-protocol.md
│   ├── 07-plugin-practices.md
│   ├── 08-figui3-ui.md
│   └── 09-plugin-structure-and-reset.md
├── scaffold/                       ← empty starting point (reset source)
│   └── src/
│       ├── code.ts
│       └── ui.template.html
└── template/                       ← Figma imports manifest from here
    ├── manifest.json               ← STABLE. Imported once.
    ├── package.json
    ├── scripts/
    │   ├── bundle-ui.mjs
    │   └── reset-template.mjs
    ├── tsconfig.json
    └── src/
        ├── code.ts                 ← Cursor overwrites each run
        ├── ui.template.html        ← Cursor overwrites each run
        ├── ui.html                 ← generated
        └── vendor/                 ← FigUI3 (from npm install)
```

## One-time setup

You only do this once:

```bash
cd /path/to/CursorVsAgent/template
npm install
npm run build
```

`npm install` pulls FigUI3, TypeScript, and plugin typings. `postinstall` copies FigUI3 vendor files and runs `bundle-ui`. `npm run build` bundles the UI and compiles `code.ts` → `code.js`.

Then in **Figma Desktop**:

1. Plugins → Development → Import plugin from manifest
2. Pick `CursorVsAgent/template/manifest.json`
3. The plugin shows up as **GenTool Comparison** under Plugins → Development

Run it once to verify the pipeline works. You should see a small frame with colored tiles and a label like "count: 6 · density: 50 · light." If that renders, your dev plugin is wired up and you're ready for the comparison.

## Per-run workflow (generation test)

1. **Reset:** `cd template && npm run reset` — see `docs/09-plugin-structure-and-reset.md`
2. **Fresh Cursor chat** — paste a prompt starting with **`Create a custom tool that…`** (see `docs/05-test-prompts.md`)
3. Cursor overwrites `template/src/code.ts` and `template/src/ui.template.html`, runs build
4. **Figma:** Plugins → Development → **GenTool Comparison** (same entry; no re-import)
5. Score with `docs/06-test-protocol.md`

Do **not** wipe `template/` or `node_modules/` between runs.

**In Figma Assistant (parallel window):**

1. Paste the same prompt verbatim into Assistant.
2. Watch it build.

Stopwatch:

- **T1: first visible output** — when does the user see *anything* (UI panel or frame)?
- **T2: complete and usable** — when can the user tweak a control and see it work?
- **T3: total elapsed**

Record both sides for each prompt.

## Why the manifest stays stable

Cursor overwrites `src/code.ts` and `src/ui.template.html` (which generates `ui.html`). The manifest name and id never change. That means you import the plugin into Figma **once**, and every subsequent comparison uses the same dev plugin entry. Faster, less friction, no re-import dance during a live demo.

## How the rules work

Cursor reads `.cursor/rules/*.mdc` based on context:

- **`05-custom-tool-trigger.mdc`** has `alwaysApply: true` → fires on `Create a custom tool…` opener
- **`00-philosophy.mdc`** has `alwaysApply: true` → loaded on every prompt
- **`10-plugin-code.mdc`** has `globs: **/code.ts` → loaded when editing `code.ts`
- **`20-ui-html.mdc`** has `globs: **/ui.template.html`, `**/ui.html` → loaded when editing UI files
- **`30-manifest.mdc`** has `globs: **/manifest.json` → loaded only if you edit the manifest (you shouldn't)

`AGENTS.md` is read at chat start as project context.

## Fairness rules

- Same prompt verbatim, both environments
- Same control catalog (PropsKit via FigUI3 web components), both environments
- Same archetypes (Generator, Action)
- Same forbidden words in UI strings
- Same persistence model (`setPluginData`)
- Same explicit-first-run expectation (Generate button, no auto-fire on open)

The only thing different is the system around the model: Cursor's harness + Claude vs. Figma's Assistant infrastructure. That's exactly what the comparison should isolate.

## What this is NOT

- Not an attack on the Assistant team. The point is to show user expectation vs. current reality with a fair benchmark.
- Not a production replacement. The plugins Cursor builds here are demo artifacts, not what would ship as Code Objects.
- Not a feature parity claim. GenTools include orchestration, persistence, multi-tool, left-rail discovery, etc. that this comparison doesn't touch. This is specifically about **generation speed and output quality** for a single tool.

## Archiving runs you care about

Cursor overwrites in place, so each new prompt erases the last build. If you want to keep a particular result (e.g., the Bento Grid you demoed):

```bash
cd CursorVsAgent
git init && git add -A && git commit -m "bento grid run"
```

Or copy the `template/src/` folder somewhere safe before kicking off the next prompt.

## Cross-references in the vault

- Master GenTools context: `Projects/GenTools/Gentools HQ.md`
- Tool specs (where these prompts come from): `Projects/GenTools/EAP-Tool-Specs.md`
- PropsKit decisions: `Projects/Archive/GenTools Cowork Dump/Propskit Backlog.md`
- Playground context: `Projects/GenTools/gentools-playground-context.md`
