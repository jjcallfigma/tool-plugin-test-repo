# Steering Cursor with docs, rules, and skills

This repo is a harness for generating Figma plugins from a single prompt. The interesting part isn't the plugin output — it's the **layered context system** that pushes a general-purpose coding model toward a specific, opinionated style of tool.

The goal: take a one-line prompt like *"Create a custom tool that swaps Lorem Ipsum with real-looking copy"* and get back a working, polished Figma plugin that matches a strict house style — every time, without back-and-forth.

The output quality comes from stacking three layers of guidance: **always-on rules**, **deep reference docs**, and **on-demand skills**. Each layer does a different job. None of them work well alone.

## The three layers

### 1. Rules — always-on, short, prescriptive

`.cursor/rules/*.mdc` files Cursor loads automatically based on context.

| Rule | When it loads | What it does |
|---|---|---|
| `00-philosophy.mdc` | Every prompt | Six hard rules every tool must obey (one-shot output, explicit first run, persistent controls, etc.) + forbidden words |
| `05-custom-tool-trigger.mdc` | Every prompt | Maps the opener *"Create a custom tool…"* to a specific workflow |
| `10-plugin-code.mdc` | Editing `code.ts` | Required sandbox shape (typed messages, `regenerate(state, mode)`, output targeting) |
| `11-network-open-apis.mdc` | Editing `code.ts` | Allowed vs forbidden network patterns |
| `20-ui-html.mdc` | Editing `ui.template.html` / `ui.html` | FigUI3 init, commit-fire, footer spec |
| `30-manifest.mdc` | Editing `manifest.json` | "Don't touch this" enforcement |

Rules are short because they fire constantly. They tell the model **what is non-negotiable**, not how to do it. The "how" lives in docs.

**Why this matters:** without rules, the model defaults to plausible-but-wrong patterns (live-drag updates, modals for errors, auto-running on plugin open, the word "plugin" in UI strings). The model isn't wrong by default — it just has no reason to know our house style. Rules give it that reason on every turn.

### 2. Docs — deep reference, loaded on demand

`docs/*.md` files the rules and `AGENTS.md` point to. The model reads them when it needs the full picture.

| Doc | What it covers |
|---|---|
| `01-what-is-a-good-tool.md` | The bar — what makes a tool feel like a GenTool |
| `02-propskit-reference.md` | Allowed control catalog (FigUI3 components) |
| `03-figma-plugin-basics.md` | Plugin API quickstart |
| `04-glossary.md` | Forbidden words in UI strings |
| `07-plugin-practices.md` | The complete practices checklist — state, relaunch, message passing, output targeting, fonts, colors, errors |
| `08-figui3-ui.md` | FigUI3 setup, bundling, panel layout, spacing, color picker, auto-resize |
| `09-plugin-structure-and-reset.md` | Required file structure and reset workflow |
| `10-network-open-apis.md` | Public `fetch` patterns, no API keys |

Docs are long, opinionated, and include working code blocks. Rules say *"use commit-fire, not live updates"*; the docs explain why, show the binding pattern, and list the gotchas that caused us to write the rule in the first place.

**Why this matters:** the model can't fit every detail in its working memory on every turn. Docs are the deep reference it pulls in when a rule says *"see `docs/07-plugin-practices.md > Output targeting`"*. The rule fires the lookup; the doc supplies the answer.

### 3. Skills — task-specific recipes, opt-in

`.cursor/skills/*/SKILL.md` files the model loads only when a prompt matches a specific shape.

| Skill | Triggers when |
|---|---|
| `color-picker-ui` | Tool prompt needs a color control (`fig-input-color`) |
| `open-api-tools` | Tool prompt needs live data from a public HTTP API |

Skills are the most targeted layer. They exist because some patterns are gnarly enough that scattering the knowledge across docs isn't enough — you need one focused recipe that handles the whole problem end to end.

The color picker skill, for example, exists because FigUI3's color popover breaks in three different ways inside a 240px plugin iframe. Without a skill, the model would re-derive the wrong fix every time. With it, the model loads one file, gets the working CSS + JS pattern, and moves on.

**Why this matters:** rules are always on (cheap to apply, expensive to bloat). Docs are deep but generic. Skills are narrow and only pulled in when relevant. Together they form a context budget that scales: simple prompts pay almost nothing, complex prompts pay only for what they need.

## The two reinforcement mechanisms

### `AGENTS.md` — the project briefing

Cursor reads `AGENTS.md` at chat start. It's the entry point: tells the model what this workspace is, what the trigger phrase means, **what to read before writing code** (in order), and what the file structure looks like.

Without `AGENTS.md`, even with rules and docs sitting in the repo, the model has no map. It might find the right doc eventually — or it might not. `AGENTS.md` removes the chance.

### Reference implementations — worked examples

`reference/01-generator-color-swatch/` and `reference/02-action-layer-renamer/` are full, working tools that demonstrate every practice in the docs.

Docs tell the model *what* to do. References show *how it looks when done right*. The model can pattern-match against a reference faster than it can reassemble principles from prose.

## Why this stack works (and why each piece is load-bearing)

| Layer | Strength | If removed |
|---|---|---|
| Rules | Always-on; cheap; catches the obvious failure modes | Model regresses to generic patterns; forbidden words slip in; live-drag returns |
| Docs | Deep; opinionated; cites the rationale | Rules become unexplained dogma; model can't recover from edge cases |
| Skills | Narrow; expensive context only when needed | Gnarly patterns (color picker, fetch) get re-derived wrong each run |
| `AGENTS.md` | The map | Model doesn't know where to look; reads the wrong files in the wrong order |
| Reference impls | Pattern to match against | Model assembles from principles, which is slower and more error-prone |

The output quality is a function of how well these layers cover the surface area of the task. Every time a generation goes sideways, the fix is: **which layer should have caught this?** If it's a one-off, add it to a rule. If it has nuance, write a doc. If it's a self-contained recipe, make it a skill. If it's structural, update `AGENTS.md`.

## How to extend the system

When you spot a new failure mode in a generated tool:

1. **Always-on, one-liner fix?** → add to `00-philosophy.mdc` or the relevant scoped rule.
2. **Needs rationale + code examples?** → new section in the right `docs/` file, then link from the rule.
3. **Self-contained recipe for a specific control or API pattern?** → new `.cursor/skills/<name>/SKILL.md`.
4. **Affects which files the model reads or in what order?** → update `AGENTS.md`.
5. **Pattern worth showing end-to-end?** → add or extend a `reference/` example.

The system is designed to absorb fixes without bloating any single layer. Rules stay short. Docs stay deep. Skills stay narrow. `AGENTS.md` stays a map.

## Workspace map

```
.
├── AGENTS.md                  ← project briefing, read at chat start
├── .cursor/
│   ├── rules/                 ← always-on / context-scoped guidance
│   └── skills/                ← opt-in recipes for gnarly patterns
├── docs/                      ← deep reference, cited by rules
├── reference/                 ← worked example tools (Generator + Action)
├── scaffold/                  ← empty starting point for each test run
└── template/                  ← the actual plugin Figma imports
    └── src/
        ├── code.ts            ← overwritten on each generation
        └── ui.template.html   ← overwritten on each generation
```

## One-time setup

```bash
cd template
npm install
npm run build
```

Then in Figma Desktop: **Plugins → Development → Import plugin from manifest** → pick `template/manifest.json`. The plugin appears as **GenTool Comparison** under Plugins → Development. From that point on, every regeneration replaces `template/src/` in place — no re-import needed.

## Per-run workflow

```bash
cd template && npm run reset     # wipes src/ back to scaffold
```

Then open a fresh Cursor chat and paste a prompt starting with **`Create a custom tool that…`**. Cursor reads `AGENTS.md`, pulls the right rules and docs, writes `code.ts` + `ui.template.html`, runs the build, and tells you to re-run the tool in Figma.
