---
name: LifeOS
description: Spatial glass for nutrition, in the visionOS idiom. Warm-neutral field with a varied tinted environment, frosted borderless panels floating in depth, large thin numerals (Plus Jakarta Sans), monochrome graphite accents, and color reserved strictly for scored macros. Light-canonical, premium, motivating.
colors:
  # Restrained. Off-white surfaces + translucency + dark graphite carry everything.
  # Color (green/amber/red) appears ONLY on values scored against the user's target.
  # Surfaces lightened toward clean off-white (warmth dialed right back) so panels no longer read cream.
  background: "oklch(0.960 0.004 86)"       # light neutral field, barely warm; the environment tints it
  foreground: "oklch(0.305 0.006 70)"       # graphite ink, ~#272727, faintly warm, never pure black
  card: "oklch(0.993 0.0022 86)"            # near off-white; opaque fallback under glass
  card-foreground: "oklch(0.305 0.006 70)"
  popover: "oklch(0.993 0.0022 86)"
  popover-foreground: "oklch(0.305 0.006 70)"
  primary: "oklch(0.305 0.006 70)"          # the accent is DARK graphite, not a hue: solid CTAs, active controls
  primary-foreground: "oklch(0.978 0.008 84)"
  secondary: "oklch(0.951 0.004 86)"        # light neutral surface for secondary controls
  secondary-foreground: "oklch(0.305 0.006 70)"
  muted: "oklch(0.951 0.004 86)"
  muted-foreground: "oklch(0.520 0.012 74)"
  accent: "oklch(0.934 0.006 84)"           # hover / selected / icon-button wash
  accent-foreground: "oklch(0.305 0.006 70)"
  border: "oklch(0.892 0.006 84)"           # hairline for dividers and inputs only; panels are borderless
  input: "oklch(0.892 0.006 84)"
  ring: "oklch(0.305 0.006 70)"             # graphite focus ring (applied at reduced opacity)
  # Functional data semantics. The ONLY chroma in the system. On scored values and status only.
  positive: "oklch(0.660 0.130 150)"        # on or under target (fresh green)
  positive-foreground: "oklch(0.978 0.008 84)"
  caution: "oklch(0.780 0.130 78)"          # approaching the limit (warm amber)
  caution-foreground: "oklch(0.320 0.040 72)"
  destructive: "oklch(0.605 0.190 28)"      # over target / error (warm red-coral)
  destructive-foreground: "oklch(0.978 0.008 84)"
typography:
  # Plus Jakarta Sans (single family). Geometric, warm, lightly distinctive; an accessible Google-Fonts
  # stand-in for Lufga (the aspirational reference). Closer paid-free alternatives via Fontshare:
  # General Sans, Switzer. No monospace; numbers are proportional, thin, tabular-aligned.
  display:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  metric:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 300
    lineHeight: 1.0
    letterSpacing: "-0.02em"
    fontVariantNumeric: "tabular-nums"
  label:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
    textTransform: "uppercase"
---

# LifeOS Design System

Spatial glass applied to nutrition, in the Apple visionOS idiom. A warm-neutral field lit by a varied tinted environment; frosted, borderless panels that float in depth; large thin numerals; a monochrome accent vocabulary of off-white, warm gray, and graphite plus transparency. Color is rationed: green, amber, and red appear only on values scored against the user's target. See PRODUCT.md for register (product), users, and the strategic principles this serves.

Direction locked 2026-06-04 against the `B3` weekly-plan probe (`context/probes/weekly-plan/`). The earlier blue-accent experiment, the azure-brand idea, and the original cobalt + monospace + brutalist direction are all retired. Three screen references extend it: the product catalog (`context/probes/product-catalog/catalog.html`, master–detail + gauges + grouped profile), the product add/edit flow (`context/probes/product-catalog/off-add.html`, the editable preview / "AI suggestion surface", shared by manual entry and Open Food Facts import), and the nutritional-targets screen (`context/probes/nutritional-targets/targets.html`, the daily calorie + macro targets form, whose macro→energy reconciliation bar is its scored-vs-target moment). The targets screen (added 2026-06-05) is the first surface to run macro identity color and the semantic scored set side by side; see Identity palettes.

## Note on glass

Glass here is the primary material, not decoration. This is a deliberate, systematic choice (visionOS), so it overrides the usual "glass as default is a reflex" caution. What keeps it honest:

- Glass conveys **depth and layering**, never just prettiness.
- **It needs something behind it.** A frosted panel over a flat field reads as a solid card, not glass. The field carries a soft, *varied* tinted environment (distinct hue zones, see Environment) so the blur has color to refract. Keep it gentle: enough variation that the frost reads, not so much that it competes with the data.
- **Vibrancy**: glass uses `backdrop-filter: blur() saturate(180%)`.
- **Legibility wins over the effect.** Hero and scored values sit on the thicker, more opaque glass tier or a near-solid backing so they never wash out. Thin glass is for chrome and secondary surfaces.
- **Graceful fallback**: where `backdrop-filter` is unsupported or `prefers-reduced-motion` is set, glass resolves to a solid warm-neutral tint using `card`.

## Color Strategy

**Restrained**, by intent. Warm-neutral surfaces and translucency carry everything. The "accent" is not a hue: it is **dark graphite** (`primary`, ~#272727) for solid calls-to-action and active controls, off-white glass for surfaces, and depth itself for emphasis. The only saturated color in the system is the **functional data set**: `positive` (on or under target), `caution` (approaching), `destructive` (over).

Rules:
- OKLCH only. Surfaces are clean off-white: only a whisper of warmth (hue ~84 to 86) at chroma ~0.002 to 0.006, lightened so panels read white-neutral, not cream. Warmth lives mainly in the environment behind glass, not in the surfaces. No `#000`, no `#fff`.
- **No brand hue.** No blue, no azure, no cobalt, no colored primary. Interaction reads through graphite, glass, and depth.
- **Color earns its place on data only.** Macros, status pills, adherence bars, deltas. Never on a surface, icon, or heading.
- Contrast is not gated to WCAG ratios (see Accessibility), but the glass legibility rule is non-negotiable for load-bearing numbers.

### Environment (behind glass)

The field is not a flat tone. It carries 3 to 4 soft, distinct radial zones in different hues so the frosted panels have something to refract and the background never reads uniform. Keep zones gentle (chroma ~0.022 to 0.034, light and lower-alpha) and balanced warm-to-cool so the overall field stays light and neutral, not warm-heavy (softened alongside the off-white surfaces). The probe uses honey (top-left), peach (top-right), sage (bottom-left), and a faint cool tone (bottom-right). Adjust placement per surface; keep the principle (varied, soft, balanced).

### Chart and data-viz palette

Mostly monochrome with color on scored series only: neutral lines and gridlines in `muted-foreground` / `border`; green / amber / red for series scored against target, with soft pastel fills fading to transparent. Everything else grayscale.

### Identity palettes (scoped exception)

One deliberate exception to "color earns its place on data scored against target": color may encode *identity* (which macro, which category), never *score*, but **only on surfaces that present reference data the user is reading or defining, not values scored against a target**. Two surfaces qualify: the **product catalog** (catalog products are reference data, never scored) and the **nutritional-targets** screen (the targets themselves are the reference everything else is scored against, so they are not themselves scored). Everywhere a value IS scored against the user's target (weekly plan, per-day view, adherence bars, and the macro→energy reconciliation on the targets screen itself), the `positive` / `caution` / `destructive` set still rules and the scored value stays monochrome graphite. The targets screen is the first place the two systems deliberately coexist: macro identity hues on the editable macros and the split-composition bar, the semantic set on the reconciliation bar. Distinguish them by meaning — hue answers *which macro*, green/amber/red answers *how it scores*.

**Macro identity.** Energy, protein, carbs, and fat each carry a fixed hue so the macros are distinguishable at a glance — on the catalog's per-product gauges, and on the targets screen's macro dots and split-composition bar.
- The **number stays graphite** (legibility guard). Color lives in the gauge ring (with its gradient sweep and end cap), the label dot, or the bar segment, never on the figure.
- Each ring is scaled to a per-nutrient reference max on 100 g, so the fill reads "how rich in this macro," not as a score.
- Each hue pairs a lighter sweep start (`--gc-s`) and a faint same-hue track tint (`--trk`) so an empty ring still reads colored, never dead gray. Spread roughly evenly on the wheel; chrome pulled back so it reads premium, not candy:
  - Energia (kcal): `oklch(0.64 0.150 30)` koral
  - Białko: `oklch(0.60 0.120 245)` błękit
  - Węglowodany: `oklch(0.66 0.100 182)` morski teal
  - Tłuszcze: `oklch(0.80 0.130 92)` złoto

**Category identity (facet icons).** Each food category has a small colored icon used in the browse chips and shown icon-only in the catalog table's category column (label moves to a tooltip). Color sits on the glyph only, never on a surface or text. Tokens (`--cc`, consumed by `.cicon`): Nabiał `oklch(0.66 0.085 245)`, Mięso `oklch(0.58 0.140 18)`, Drób `oklch(0.70 0.105 70)`, Ryby `oklch(0.64 0.100 205)`, Zboża `oklch(0.74 0.115 88)`, Warzywa `oklch(0.62 0.130 150)`, Owoce `oklch(0.64 0.150 40)`, Strączki `oklch(0.58 0.085 110)`, Tłuszcze `oklch(0.78 0.120 95)`, Przetwory `oklch(0.56 0.110 310)`. "Wszystkie" stays neutral (inherits text color).

Both palettes live as reusable tokens in `lifeos-kit.css` (`.g-*`, `.cat-*`). Locked references: the catalog screen (`context/probes/product-catalog/catalog.html`) for both palettes, and the nutritional-targets screen (`context/probes/nutritional-targets/targets.html`) for macro identity reused on dots + split bar. Category glyphs are placeholder shapes, not final.

### Deliberately avoided

- A colored brand accent of any kind (the retired blue and cobalt). Accents are off-white, warm gray, graphite, transparency.
- Monospace ticker numbers and hard-edged brutalist data cards.
- Decorative glass; glass that buries a number it should present.
- A flat, uniform background behind glass (the frost then reads as a plain card).
- Dark-aggressive, neon, glitch palettes; teal gradients and meal-kit green.

## Theme

Light is canonical. Scene: a Polish home cook in a bright kitchen on Sunday evening, phone in one hand, glancing at whether Monday hits their protein target before they accept the plan. The field is warm-neutral; glass panels float above it, legible under daylight.

Dark is a strong sibling and glass shines there (the visionOS night look): deep warm near-black field, dark translucent panels, light text. Token pairs defined for both (see Dark Theme). Light gets the primary design effort.

## Typography

**Plus Jakarta Sans is the single family**: geometric, warm, lightly distinctive, an accessible stand-in for Lufga (the aspirational reference, not on Google Fonts). If a closer match is wanted later, swap to General Sans or Switzer (Fontshare, free for commercial use). No monospace, no display/body pairing.

- `metric`: the signature. Weight **300 (thin)**, large, `tabular-nums` so values align in columns. The big number a user came to see (`2 140` kcal, `48` g). Unit as a small superscript / muted suffix; decimals may render at reduced weight or opacity for the two-tone look. On glass, metrics get a thicker/opaque backing.
- `display` / `headline` / `title`: weight 550 to 600, tight negative tracking, fixed rem scale (not fluid clamp). Hierarchy from scale and weight contrast (ratio >= 1.25).
- `label`: uppercase, tracked 0.06em, small, weight 500. Meal slot, day, units, status. Slightly translucent (vibrancy) on glass.
- `body`: line length capped at 65 to 75ch. Copy is minimal.

**Form controls** (`input`, `select`, `button`, `textarea`) inherit Plus Jakarta Sans via a base reset in `lifeos-kit.css`. Browsers do not inherit `font-family` on form controls by default, so without this they silently fall back to a system font and the screen reads as mixed typefaces. The reset lives in the kit so every probe gets it for free.

## Glass material and elevation

The surface is layered glass over the warm-neutral, tinted field. Depth comes from blur strength, translucency, and soft wide shadows. **Panels are borderless**: the shadow and the tonal lift do the separating; there is no specular hairline border on cards (a 1px border made them read as outlined cards, not floating glass).

Tiers (low to high):
- **Field**: the deepest layer, with the tinted environment. Flat, no glass.
- **Glass panel (regular)**: the default surface (rows, cards, nav, sheets). Translucent fill, medium blur, soft shadow, no border. Floats above the field.
- **Glass raised (thick)**: the expanded/focused panel, header, sticky action bar, menus, overlays. Stronger blur, more opaque fill (legible contents), larger shadow.
- **Solid backing**: under hero metrics and dense data so numbers never wash out. Near-opaque `card`.

No nested cards: a panel may hold metric blocks, but a glass panel never sits inside another glass panel; depth tiers replace nesting.

Glass tokens (light):
- `--glass-blur`: `24px`; `--glass-blur-thick`: `40px`; `--glass-saturate`: `180%`
- `--glass-fill`: `oklch(0.997 0.0014 86 / 0.50)`
- `--glass-fill-thick`: `oklch(0.994 0.0020 86 / 0.86)`
- `--shadow-soft`: `0 1px 2px oklch(0.305 0.006 70 / 0.05), 0 8px 28px oklch(0.305 0.006 70 / 0.11)`
- `--shadow-lift`: `0 16px 48px oklch(0.305 0.006 70 / 0.18)` (raised glass, overlays)

Compose a glass panel as: `background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: var(--shadow-soft);` (no border) with solid `card` as the no-backdrop-filter fallback.

## Radius

Soft and cohesive. Panels and primary buttons share the base radius so the whole reads as one family.

- `--radius` (panels, cards, sheets, **and action buttons**): `1rem`.
- `--radius-sm` (inputs, icon buttons, swap controls, small tiles): `0.625rem`.
- `--radius-pill` (segmented toggle, chips, status pills, gauge tracks, dots): `999px`.

## Layout

- Spacious and rhythmic; glass panels float with gaps so depth reads. Varied spacing (4px base scale, never uniform). Whitespace is structural.
- Mobile-first, one hand. The weekly plan is a vertical stack of glass day-panels; tapping a day expands its meals inline (the focused day rises to the thick-glass tier). On wider screens the stack becomes a 7-column arrangement.
- Do not wrap everything in a panel. Many metrics and labels sit directly on the field; reach for glass when something should float or layer.
- Per-day nutritional view is primary; weekly aggregate is a secondary toggle (per PRD FR-011).

## Components

- **Buttons**: primary is a solid graphite block (`primary`, `--radius` to match panels) with off-white text. Secondary is a glass block with `foreground` text. The more important action sits on the right of an action bar. No colored buttons.
- **Icon button**: a square control at `--radius-sm` with a tinted background (`card` or `accent`), a soft shadow, no border, and a **solid (filled) icon** in `foreground`. Used in the header and as the inline swap control. Solid icon style throughout, not outline.
- **Segmented toggle**: a pill (`--radius-pill`) on an `accent` track; the active segment lifts on a `card` fill with soft shadow. Per-day vs weekly. (Kept exactly as the probe; it works.)
- **Inputs**: kit primitive `.input` (`.input--sm` for compact inline/value fields) — `--radius-sm`, `card` fill, `border` hairline, graphite focus ring via the `--focus` token (3px at reduced opacity; inverts to light on dark). Covers text entry, the single smart search/EAN field (one input that detects barcode vs free text), the category `select`, and every editable value in the add/edit product flow.
- **Metric tile / day row**: large thin `metric` value on a near-solid backing, small uppercase `label`, unit as superscript, optional adherence bar or status. Legibility beats the glass effect here.
- **Macro vs target / adherence bar**: a thin rounded (`--radius-pill`) track. Fill is `positive` on or under target, `caution` near the ceiling, `destructive` when over, paired with the value and a sign. The only color on the row. The nutritional-targets screen reuses this as the **macro→energy reconciliation**: macro grams imply kcal via Atwater (4/4/9 kcal/g), scored live against the calorie target (thresholds ~±2% on, ~±8% near, beyond = mismatch) — it doubles as a data-integrity guard that catches macros that don't add up to the stated goal.
- **Status dot / pill**: capsule or dot of the semantic hue. "On track / approaching / over", meal type, day.
- **AI suggestion surface**: a raised (thick) glass overlay, clearly editable; Accept / swap / reject always visible. Marked by depth and a quiet label, not a brand color. The AI never presents a locked result (PRODUCT.md: AI proposes, user disposes). Realized in the product add/edit flow (`context/probes/product-catalog/off-add.html`) as the **editable preview**: a `panel--thick` lifted on `--shadow-lift` with a brief materialize (blur-in + scale), every field inline-editable, and an explicit save action (more important action on the right). The **draft / unsaved** state is signalled *neutrally* — a graphite glass pill with a muted pulsing dot, never a semantic hue. "Unsaved" is a state, not a value scored against a target, so color stays reserved.
- **Editable values & data honesty**: when capturing nutrition data, an empty field means **no data (NULL), never 0** — empty inputs render with a dashed border and a muted "brak danych" placeholder, visibly distinct from an entered `0`. This carries the PRD nutritional-accuracy guardrail into the UI (e.g. an OFF product that reports salt but not sodium leaves sodium empty, not zeroed). Unit normalization (e.g. OFF salt/sodium `g → mg`) happens **inside the OFF integration**; the form shows only canonical-unit values, not the raw→converted derivation. Gauges/rings stay **presentational** (read-only visualization); editing happens in dedicated input fields beside or below them, never inside the ring.
- **Charts**: monochrome lines and gridlines, color only on scored series, soft pastel fills.

## Motion

Calm, spatial, state-driven. 150 to 250 ms on most transitions.

- Easing: `--ease-out-quint` `cubic-bezier(0.23, 1, 0.32, 1)` and `--ease-out-expo` `cubic-bezier(0.19, 1, 0.22, 1)`. No bounce.
- Glass panels appear with a brief blur-in plus a small scale-up (0.98 to 1) and fade (the visionOS materialize). Transform, opacity, and `backdrop-filter` only; never layout properties.
- Signature, motivating: on plan generation, adherence bars fill and hero numbers count up toward their final value. Sparingly, on real results only.
- `prefers-reduced-motion`: suppress count-ups, fills, and blur-in (resolve instantly); glass falls back to a solid warm-neutral tint.

## Dark Theme

Strong sibling; glass shines here. Deep warm near-black field, dark translucent panels, light text. The graphite accent inverts: the solid CTA becomes light, text on it dark.

- `background`: `oklch(0.200 0.006 72)`
- `foreground`: `oklch(0.952 0.006 84)`
- `card`: `oklch(0.250 0.007 74)` (opaque fallback)
- `primary`: `oklch(0.945 0.006 84)` (light CTA on dark)
- `primary-foreground`: `oklch(0.230 0.007 72)`
- `secondary` / `muted`: `oklch(0.290 0.007 74)`
- `muted-foreground`: `oklch(0.680 0.010 78)`
- `border`: `oklch(0.330 0.008 74)`
- `--glass-fill`: `oklch(0.300 0.008 80 / 0.42)`; `--glass-fill-thick`: `oklch(0.320 0.008 80 / 0.66)`
- `positive`: `oklch(0.700 0.135 150)`; `caution`: `oklch(0.805 0.130 80)`; `destructive`: `oklch(0.650 0.180 28)`

## Accessibility

Per PRODUCT.md, this project puts visual aesthetics ahead of the strict accessibility regime.

- **Keyboard navigation is kept**: interactive elements stay reachable and operable.
- **Contrast is not gated** to WCAG ratios; soft, low-contrast, translucent pairings are allowed. The one hard rule is the glass legibility guard: load-bearing and scored numbers must stay readable (thicker/opaque backing).
- **Screen-reader support is not a priority** for the MVP.
- **Reduced motion is respected**, and glass degrades to a solid tint.
- **Touch targets** stay comfortable (around 44x44px) for one-handed mobile use.
- **Polish** throughout: copy, labels, AI output, errors.
