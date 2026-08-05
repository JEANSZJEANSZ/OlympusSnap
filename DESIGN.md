---
name: Olympus Snap
description: Mount Olympus Arcade — 16-bit mythic photobooth UI
colors:
  aegean-temple-navy: "#0f4c81"
  oracle-blue: "#3b82f6"
  travertine-dust: "#c4b49a"
  travertine-bright: "#e8dfd0"
  cool-ash-paper: "#f8f9fa"
  slate-surface: "#e2e8f0"
  cool-marble: "#d6dde8"
  marble-vein: "#9aa8bc"
  ink-slate: "#0f172a"
  ink-soft: "#334155"
  flash-white: "#ffffff"
  danger-crimson: "#b91c1c"
  sky-top: "#071936"
  sky-mid: "#153d69"
  sky-low: "#be6f62"
typography:
  display:
    fontFamily: "Greek-Freak, 'Press Start 2P', sans-serif"
    fontSize: "clamp(1.85rem, 9vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "0.03em"
  headline:
    fontFamily: "Greek-Freak, 'Press Start 2P', sans-serif"
    fontSize: "clamp(0.9rem, 2.4vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.04em"
  title:
    fontFamily: "'Press Start 2P', monospace"
    fontSize: "clamp(0.85rem, 0.65rem + 0.55vw, 1.35rem)"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.04em"
  body:
    fontFamily: "'Press Start 2P', monospace"
    fontSize: "clamp(0.55rem, 1.6vw, 0.68rem)"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "'Press Start 2P', monospace"
    fontSize: "clamp(0.36rem, 1vw, 0.48rem)"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.14em"
rounded:
  none: "0"
spacing:
  xs: "0.35rem"
  sm: "0.55rem"
  md: "1rem"
  lg: "1.25rem"
  touch: "clamp(2.75rem, 2.25rem + 1vh, 3.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.aegean-temple-navy}"
    textColor: "{colors.cool-ash-paper}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.25rem"
    typography: "{typography.label}"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.aegean-temple-navy}"
    textColor: "{colors.cool-ash-paper}"
  button-accent:
    backgroundColor: "{colors.oracle-blue}"
    textColor: "{colors.cool-ash-paper}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.25rem"
    height: "3.25rem"
  button-gold:
    backgroundColor: "{colors.travertine-dust}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.25rem"
    height: "3.25rem"
  button-ghost:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.25rem"
    height: "3.25rem"
  dialog-box:
    backgroundColor: "{colors.cool-ash-paper}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.none}"
    padding: "1rem 1.1rem 1.15rem"
    typography: "{typography.body}"
  pixel-panel:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.none}"
---

# Design System: Olympus Snap

## Overview

**Creative North Star: "Mount Olympus Arcade"**

Olympus Snap’s UI is a 16-bit game set on Mount Olympus: guests don’t “use a photobooth app,” they enter a pixel temple and play a short ritual. Every surface should read as Olympus first — sky stage, marble stone, oracle chrome — and as classic 16-bit UI second — hard squares, chunky press shadows, Press Start / Greek-Freak type, scanlines, nearest-neighbor art.

The aesthetic philosophy is mythic arcade stagecraft, not photoreal Greece and not soft SaaS event tech. Cool ash and slate marble carry the stone; Aegean navy and oracle blue carry the gods; travertine dust stands in for sacred metal without casino glitter. Depth is structural and pixel-hard. Motion is part of the world (countdowns, reveals, typewriter oracles), not decoration bolted on.

**Key Characteristics:**
- Olympus + 16-bit as the dual identity of every screen
- Zero border-radius on chrome; hard offset shadows only
- Pixel fonts everywhere; Greek-Freak for display brand moments
- Living sky stage behind booth tools; marble checker under panels
- Chunky arcade controls sized for arm’s-length tablet use
- Portraits stay smooth; UI art stays pixelated

## Colors

Cool stone and Aegean navy on a mythic dusk sky — never warm cream paper, never lottery gold.

### Primary
- **Aegean Temple Navy** (`#0f4c81`): Primary actions, speaker tags, panel depth tint, brand weight. The temple’s inked stone.

### Secondary
- **Oracle Blue** (`#3b82f6`): Accent actions (SNAP), links, typewriter cursor — the electric call to play.

### Tertiary
- **Travertine Dust** (`#c4b49a`) / **Travertine Bright** (`#e8dfd0`): Sacred stone highlight for focus rings, plaque borders, gold-adjacent accents — never saturated casino gold.

### Neutral
- **Cool Ash Paper** (`#f8f9fa`): Body / dialog fill.
- **Slate Surface** (`#e2e8f0`): Pixel panels and ghost buttons.
- **Cool Marble** (`#d6dde8`) / **Marble Vein** (`#9aa8bc`): Checker floor and stone texture.
- **Ink Slate** (`#0f172a`) / **Ink Soft** (`#334155`): Text and secondary copy.
- **Flash White** (`#ffffff`): Shutter / exit flashes.
- **Danger Crimson** (`#b91c1c`): Destructive / error only.

### Stage (booth atmosphere)
- **Sky Top / Mid / Low** (`#071936` / `#153d69` / `#be6f62`): Shared dusk gradient behind Frame, Camera, Studio, Reveal, Admin.

### Named Rules
**The Travertine, Not Casino Rule.** Gold means dusty limestone highlight (`#c4b49a` / `#e8dfd0`), never saturated yellow metal.

**The Olympus Sky Rule.** Guest booth screens sit on the sky-top → sky-mid → sky-low stage; don’t replace it with flat app gray.

## Typography

**Display Font:** Greek-Freak (fallback Press Start 2P)
**Body Font:** Press Start 2P (monospace)
**Label/Mono Font:** Press Start 2P

**Character:** Chunky 8-bit voice for UI; Greek-Freak only for Olympus brand display (titles, ritual cues). Small pixel sizes, wide letter-spacing on labels, uppercase on controls.

### Hierarchy
- **Display** (400, `clamp(1.85rem, 9vw, 3.6rem)`, lh 0.92): Landing brand words — OLYMPUS / SNAP!.
- **Headline** (400, `clamp(0.9rem, 2.4vw, 1.2rem)`): Secondary Greek-Freak cues (e.g. TAP / ritual prompts).
- **Title** (400, booth `clamp(0.85rem…1.35rem)`): Screen titles and tool headers in Press Start.
- **Body** (400, `clamp(0.55rem, 1.6vw, 0.68rem)`, lh 1.75): Dialog / oracle copy; keep readable blocks short.
- **Label** (400, `clamp(0.36rem, 1vw, 0.48rem)`, tracking ~0.14em, uppercase): Kickers, button labels, speaker tags.

### Named Rules
**The Two-Font Rule.** Greek-Freak = Olympus display only. Press Start 2P = everything interactive and instructional.

## Layout

Full-viewport stages (`100dvh`), `overflow: hidden` on the shell — each route is one game screen, not a scroll document. Landing uses a three-row grid (mast / spacer / oracle). Booth tools (`.booth-view`) use clamp scales for rails, swatches, and touch targets sized for laptop / 24" / tablet arm’s length. Breakpoints observed: tighten filters under `640px`; widen rails at `1400px+`. Safe-area padding on reveal / mobile studio sheets. One primary CTA per beat; secondary chrome stays in rails or footers.

## Elevation & Depth

Structural pixel depth only — no soft ambient blurs on chrome. Hard multi-layer box-shadows read as 16-bit extruded edges; press states shorten the offset. Sky gradients and marble checkers provide atmospheric depth behind flat UI plates.

### Shadow Vocabulary
- **Panel** (`4px 4px 0 #0f172a, 8px 8px 0 color-mix(in srgb, #0f4c81 40%, transparent)`): `.pixel-panel` shells.
- **Button** (`0 0 0 3px #0f172a, 4px 4px 0 #0f172a`): Resting arcade buttons.
- **Button Press** (`0 0 0 3px #0f172a, 1px 1px 0 #0f172a`): Active / depressed.
- **Dialog Frame** (`0 0 0 4px #0f172a, 0 0 0 8px #c4b49a, 6px 6px 0 #0f4c81`): Oracle `DialogBox`.

### Named Rules
**The Hard Edge Rule.** Chrome depth is offset squares only. Soft drop-shadows and glassmorphism are out of system.

## Shapes

**Zero radius** on panels, buttons, dialogs, and plaques (`border-radius: 0`). Circles appear only inside ritual art (shutter lens rings), not as UI chrome. Checker marble floor is 24px cells. Scanline overlays are optional atmosphere on stages. Pixel-art rendering (`image-rendering: pixelated`) is mandatory for UI art/canvas; photobooth portraits use `.photo-smooth`.

### Named Rules
**The Square Temple Rule.** If it has a corner radius, it isn’t Olympus Snap chrome.

## Components

Chunky arcade controls — tactile, square, readable at arm’s length.

### Buttons
- **Shape:** Sharp square (`0` radius), min-height ~`3.25rem`, uppercase Press Start.
- **Primary:** Aegean navy on cool ash; hard button shadow.
- **Accent:** Oracle blue (SNAP / ritual primary).
- **Gold:** Travertine dust on ink (secondary highlight).
- **Ghost:** Slate surface on ink.
- **Hover / Active:** Brightness lift; active translates `3px 3px` with press shadow (stepped, ~60ms).
- **Focus:** `3px` travertine outline, `3px` offset.

### Cards / Containers
- **Corner Style:** None (`0`).
- **Background:** Slate surface (`.pixel-panel`) or cool ash (dialogs).
- **Shadow Strategy:** Panel / dialog vocab above.
- **Border:** Usually shadow-as-border; landing plaque uses `3px` travertine stroke.
- **Internal Padding:** ~`1rem` dialogs; clamp padding on plaques.

### Inputs / Fields
- Admin / asset tools inherit the same square, high-contrast field language as ghost panels — ink on ash/slate, hard focus via travertine outline. No rounded search pills.

### Navigation
- Flow is route-based ritual beats (Landing → Frame → Camera → Studio → Reveal), not a persistent app nav. Admin is PIN-gated and visually a forge variant of the same sky stage — not a SaaS sidebar.

### DialogBox (signature)
- RPG oracle panel: speaker tag (navy + travertine-bright), typewriter body, accent block cursor. Double-ring frame (ink + travertine) with navy kick shadow.

### RitualShutterButton (signature)
- Accent `PixelButton` with nested pixel lens housing; busy state steps a lens pulse. The SNAP affordance of the camera beat.

## Do's and Don'ts

### Do:
- **Do** lead with Olympus stagecraft and 16-bit UI grammar on every guest screen.
- **Do** keep chrome at `border-radius: 0` with hard offset shadows.
- **Do** use Greek-Freak for brand display and Press Start 2P for controls/copy.
- **Do** keep touch targets near `--booth-touch` / button min-height for shared tablets.
- **Do** render UI art pixelated and portraits with `.photo-smooth`.

### Don't:
- **Don't** ship SaaS photobooth patterns (soft cards, pill CTAs, dashboard chrome, stock “smile!” UI).
- **Don't** use saturated casino gold or warm cream/paper body backgrounds.
- **Don't** soften the system with blur glass panels or fluffy drop shadows on controls.
- **Don't** round the corners of buttons, panels, or dialogs.
- **Don't** replace the mythic sky stage with a flat neutral app shell on guest booth routes.
