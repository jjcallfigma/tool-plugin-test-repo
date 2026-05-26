# Test prompts (paste-ready)

These are the exact prompts to paste into **Cursor** and into **Figma Assistant** for the side-by-side comparison.

**Opener (both environments).** Every prompt starts with **`Create a custom tool that…`** — this is the routing phrase for this comparison. Paste the full block verbatim. Do not tweak between runs. Don't pre-explain to Cursor; `.cursor/rules/` and `docs/` are the context it gets.

**Assistant note.** If Figma Assistant only recognizes a different opener (e.g. "Generate a … tool"), use the same body text but swap only the first line to whatever Assistant expects. Cursor must receive the `Create a custom tool` opener unchanged.

## Tier 1: simple Generator (recommended starter)

### Bento Grid

```
Create a custom tool that arranges any number of cards in a deliberate, asymmetric bento grid layout. Each card gets its own size and proportion so the composition reads as designed, not algorithmic. Cards can hold placeholder content, sample marketing copy, or pull from selected components as fills.

Controls:
- Card count. Number of cards in the grid, from 3 to 24.
- Density. Tight gaps to airy gaps, one slider.
- Aspect mix. Bias toward squares, wide cards, or tall cards.
- Corner radius. Global rounding applied to all cards.
- Theme. Light, dark, or a custom palette picker.
- Content mode. Empty placeholders, sample marketing copy, or use the currently selected components.
- Reshuffle. Re-rolls the size distribution while keeping the card count fixed.

Default state should drop in a 6-card asymmetric layout with placeholder copy, ready to riff on.
```

**Why this one:** medium complexity, clear default, asymmetric layout shows off generation quality. Good Generator example.

## Tier 2: visual / reactive feel

### Mesh Gradient

```
Create a custom tool that creates a reactive painterly mesh gradient background by blending multiple color points. Drag color points directly on canvas to reshape the blend. Tune blur, vibrance, and grain to land anywhere from corporate-clean to risograph poster.

Controls:
- Color points. 3 to 12 draggable points placed on the canvas, each with its own color.
- Blur. How softly colors fade into each other.
- Vibrance. Saturation push, subtle to neon.
- Grain. Optional film grain overlay with intensity slider.
- Bias. Quick presets for light, dark, warm, cool.
- Lock points. Freeze position so you can tweak colors without bumping the composition.

Default state should show 5 color points in a warm sunset palette with medium blur and light grain.
```

**Why this one:** stress-tests visual quality and on-canvas handles. Good if you want to show Cursor producing something pretty.

## Tier 3: structured data

### Org Chart

```
Create a custom tool that builds a clean org chart hierarchy from a list of names, titles, and reporting relationships. Designed for offsites, intros, comms decks, anywhere you need to show structure without firing up Lucidchart.

Controls:
- Layout. Top-down, left-to-right, or radial.
- Depth. Visible levels, collapse the rest into counted groups.
- Cards. Compact (name and title), full (with photo and team), or minimal (initials only).
- Connector style. Right-angle, curved, or straight.
- Highlight. Pick a person to glow their reporting chain up and down.
- Color rules. Color cards by team, level, or geography.

Default state should show a 3-level top-down chart with full cards and right-angle connectors.
```

**Why this one:** structured input, layout logic, connector routing. Good for showing engineering-grade output.

## Tier 4: Action (not a Generator)

### Layer Cleanup

```
Create a custom tool that organizes a messy file as a one-shot layer cleanup action. Walks the selection or page, renames unnamed layers based on their content, groups visually adjacent layers, collapses overgrown layer trees, and reports a tally of what changed.

Controls:
- Scope. Selection, current page, or the entire file.
- Renaming style. By content (text and image alt), by component type, by visual role (hero, body, caption), or off.
- Group threshold. How close layers need to be to get auto-grouped.
- Sort. By position, by size, or off.
- Report. Summarize changes as a notification or as a side-by-side "before / after" frame.

Runs once and exits with a clear count of layers renamed, grouped, and collapsed.
```

**Why this one:** tests the Action archetype (no persistent state, one-shot). Useful if you want to show the comparison across both tool shapes.

## Suggested demo order

If you have 15-20 minutes and want maximum impact:

1. **Bento Grid** first. Sets the loop, shows clean Generator output.
2. **Mesh Gradient** second. Visual hook, shows polish.
3. **Layer Cleanup** third (optional). Shows Cursor handles the Action shape too.

Skip Org Chart unless your audience is engineering-leaning.

## How to time the comparison

Start a stopwatch when you hit Enter / Send in each environment. Record:

- **T1: First visible output.** When does the user see *anything* — a UI panel, a frame, a render?
- **T2: Complete and usable.** When can the user actually start tweaking controls and seeing them work?
- **T3: Total elapsed.** When the tool stops "building" entirely.

For Assistant, T1 and T2 may both be at the same end-state (it generates everything before showing). For Cursor + Claude, T1 will be very fast (file edits start streaming) and T2 will be when compile + import + run finishes.

The bar to beat: 20 minutes (the current Assistant pain point). For Cursor, target under 3 minutes T2 on a Tier 1 prompt.
