---
name: LifeOS
description: Precision nutrition planning — AI-assisted, biotech-inspired, mobile-first.
colors:
  ice-core: "oklch(0.588 0.155 210)"
  ice-glow: "oklch(0.715 0.100 205)"
  system-white: "oklch(0.985 0.007 205)"
  frosted-panel: "oklch(0.972 0.012 205)"
  dim-surface: "oklch(0.955 0.018 210)"
  deep-ink: "oklch(0.175 0.012 220)"
  system-text: "oklch(0.508 0.020 215)"
  boundary-line: "oklch(0.876 0.022 210)"
  focus-ring: "oklch(0.715 0.100 205)"
  alert-red: "oklch(0.565 0.235 25)"
typography:
  display:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Geist Mono', 'Geist', monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
    fontFeature: "\"tnum\" on"
rounded:
  sharp: "4px"
  base: "10px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ice-core}"
    textColor: "{colors.system-white}"
    rounded: "{rounded.base}"
    padding: "8px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ice-glow}"
    textColor: "{colors.system-white}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.base}"
    padding: "8px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.system-text}"
    rounded: "{rounded.base}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "{colors.system-white}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
  card-surface:
    backgroundColor: "{colors.frosted-panel}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.base}"
    padding: "24px"
---

# Design System: LifeOS

## 1. Overview

**Creative North Star: "The Biofield Console"**

LifeOS is not a wellness app. It is a precision instrument — an AI operating system applied to human biology. The visual language draws from aerospace control panels, biotech laboratory interfaces, and AI system displays. The surface feels bright, intelligent, and engineered: light and airy, with surfaces that breathe rather than crowd. Every element earns its position.

The palette is predominantly light. Users interact in bright environments — grocery aisles, kitchens, outdoor light. Surfaces are warm white tinted with the faintest trace of ice blue, as if illuminated from behind thin glass. The single accent — ice core blue transitioning toward soft cyan — is deployed with precision: interactive controls, AI-generated content markers, live data indicators. Everywhere else, the surface is calm.

Motion is not decoration; it is language. Elements assemble rather than appear. Transitions follow molecular logic: smooth, progressive, purposeful. The interface communicates that it is processing and responding, not merely displaying. All ambient animation fully respects `prefers-reduced-motion`.

This system explicitly rejects: cyberpunk visual chaos and heavy neon; MyFitnessPal-style density where utility crushes hierarchy; HelloFresh warmth and food-photography green branding; clinical hospital white-and-blue sterility; generic SaaS dashboards with teal gradients, hero metrics, and identical card grids.

**Key Characteristics:**
- Light surfaces tinted with ghost-level ice blue (chroma 0.007–0.022 throughout)
- Single accent color (Ice Core) used on 10% or less of any given screen
- Geist Sans for prose and UI copy; Geist Mono for all data labels, measurements, and system metadata
- Modular layouts with thin geometric boundary lines; no nested cards
- Motion communicates intelligence: assemble, materialize, reconstruct — never bounce or elastic

## 2. Colors: The Ice Field Palette

A near-achromatic palette tinted throughout toward ice blue (hue 205–220°). The accent is a single committed ice blue; everything else recedes toward luminous white. Depth is expressed through incremental lightness difference, not shadow.

### Primary
- **Ice Core** (`oklch(0.588 0.155 210)`): The primary interactive accent. Primary buttons, active navigation states, AI-generated content indicators, focused input rings, progress elements. Its saturation is unmistakable against the near-white surface; use it to say "this is alive, this is interactive."
- **Ice Glow** (`oklch(0.715 0.100 205)`): The hover and ambient-glow form of Ice Core. Slightly lighter and less saturated — a luminous version of the same hue. Used on hover states for primary elements, ambient focus halos, and rare decorative highlights.

### Neutral
- **System White** (`oklch(0.985 0.007 205)`): The base surface and background of every screen. Not pure white — tinted at chroma 0.007 toward ice blue. Invisible as an isolated color but perceptibly alive against a true white reference.
- **Frosted Panel** (`oklch(0.972 0.012 205)`): Card and panel backgrounds. One lightness step below System White, creating quiet depth without shadow. The frosted quality comes from tonal separation, never from blur effects.
- **Dim Surface** (`oklch(0.955 0.018 210)`): Secondary surfaces, muted-state backgrounds, hovered non-primary elements, and AI output panel backgrounds.
- **Boundary Line** (`oklch(0.876 0.022 210)`): All borders, dividers, and input outlines. Blue-gray rather than neutral gray — the trace of the system's ice DNA in every structural line.
- **Focus Ring** (`oklch(0.715 0.100 205)`): Focus outline for keyboard navigation. Shares the Ice Glow value — luminous and unmistakable.
- **Deep Ink** (`oklch(0.175 0.012 220)`): Primary text and foreground. Near-black with a slight blue cast — the same tilt as the surface neutrals.
- **System Text** (`oklch(0.508 0.020 215)`): Secondary text, labels, placeholder text, and metadata. Mid-lightness, more perceptible than Deep Ink at small sizes.
- **Alert Red** (`oklch(0.565 0.235 25)`): Destructive actions and error states exclusively.

### Named Rules
**The Single Voice Rule.** Ice Core is the only saturated accent in this system (excluding Alert Red). It appears on 10% or less of any given screen. Its rarity is its power. If more than one element on a screen feels lit up with Ice Core, one of them is wrong.

**The Tint-Everything Rule.** No color in this system has chroma 0. Every neutral is tinted toward hue 205°. The minimum is chroma 0.007. A neutral at chroma 0 reads as default gray; the tint reads as designed.

## 3. Typography: The Geist Protocol

**Primary Font:** Geist Sans (Vercel, free, excellent Polish glyph coverage)
**Data / Label Font:** Geist Mono

**Character:** Geist Sans is a purpose-built engineering typeface. Its letterforms are geometric but not cold, technical but not rigid. Geist Mono brings the operating system into labels and numerical data: proportional data, measurement readouts, system metadata. Together they read as an intelligent instrument, not a document.

### Hierarchy
- **Display** (400 weight, clamp(2rem, 5vw, 3.5rem), 1.08 line-height, −0.02em tracking): Page titles only — the welcome header, section introductions. Appears once per screen maximum.
- **Headline** (500 weight, clamp(1.25rem, 2.5vw, 1.75rem), 1.2 line-height, −0.015em tracking): Major section headers: "Twój plan tygodniowy", "Katalog przepisów". Used sparingly; one per screen section.
- **Title** (500 weight, 1.125rem, 1.3 line-height, −0.01em tracking): Card titles, form section headers, panel identifiers. The workhorse of in-screen hierarchy.
- **Body** (400 weight, 0.9375rem / 15px, 1.6 line-height): All paragraph and description text. Line length capped at 68ch. Descriptions, instructions, helper text.
- **Label** (Geist Mono, 500 weight, 0.6875rem / 11px, 1.4 line-height, 0.08em tracking, UPPERCASE): System metadata, nutrient labels, field identifiers, category tags, data unit suffixes — KCAL, BIAŁKO, TŁUSZCZE, WĘGLOWODANY. Tabular number feature enabled (`font-feature-settings: "tnum" on`).

### Named Rules
**The Mono Protocol.** Geist Mono is reserved for measurement data, system labels, and metadata — never for prose or UI copy. When a value has a unit (302 kcal, 28g białka), the value and unit together use Label style. This creates an immediate visual grammar: Mono reads as machine output; Sans reads as human language.

**The Scale Contract.** Each step in the hierarchy differs by at least 1.25× in size and 100 in weight from its adjacent neighbor. No flat scales. The gap between Label (11px, mono) and Body (15px, sans) is intentionally wide — they should never be confused for each other.

## 4. Elevation: Tonal Depth

This system is flat by default. Shadows are not a first-class tool — depth is expressed through tonal layering (the incremental lightness steps from System White → Frosted Panel → Dim Surface) and thin Boundary Line borders.

Shadows appear in exactly two contexts: (1) as a diffuse ambient glow on primary interactive elements at hover and focus — not a structural shadow but a luminous aura in Ice Core's hue; (2) as a cool-tinted containment shadow under floating panels (modals, dropdowns, tooltips) where positional separation from the surface is genuinely needed.

### Shadow Vocabulary
- **Ice Aura** (`0 0 0 3px oklch(0.715 0.100 205 / 0.35)`): Focus and hover companion — surrounds active elements with a soft, diffuse ice-blue halo. Paired with the Boundary Line focus ring. Never used decoratively.
- **Float Lift** (`0 8px 32px oklch(0.508 0.020 215 / 0.15), 0 2px 8px oklch(0.508 0.020 215 / 0.08)`): Floating elements only — dropdowns, tooltips, modal containers. Cool-tinted and diffuse. Not visible on any static surface.

### Named Rules
**The Flat-First Rule.** If you are reaching for a shadow on a static surface — a card at rest, a section container, a sidebar — stop. Use a Boundary Line border or a Frosted Panel background instead. Shadows appear only in response to state or genuine positional elevation.

**The Glow Exception.** The Ice Aura is not a structural shadow; it is a system signal meaning "this element is alive and in focus." It appears on primary buttons (focus/hover), inputs (focus), and active navigation items. Nowhere else.

## 5. Components

### Buttons

Refined and technical. Rounded (10px) but not pill-shaped. No ornament — color assignment carries the hierarchy.

- **Shape:** Gently rounded (10px / `{rounded.base}`)
- **Primary:** Ice Core background, System White text. Padding: 8px 20px. Title weight (500), −0.01em tracking. Transition: background and box-shadow, 180ms ease-out-quint.
- **Primary Hover:** Background shifts to Ice Glow. Ice Aura shadow activates.
- **Primary Focus-Visible:** Ice Aura ring. Outline 2px Ice Glow, offset 2px.
- **Outline:** Transparent background, Boundary Line border (1px), Deep Ink text. Hover: Dim Surface background.
- **Ghost:** No border, no background. System Text color. Hover: Dim Surface background. Used for tertiary actions, icon triggers, and logout.
- **Disabled:** 40% opacity across all variants. No interaction, no hover treatment.

### Inputs / Fields

Precise and readable. The field boundary is a Boundary Line stroke; on focus it shifts to Ice Core and the Ice Aura halo activates.

- **Style:** System White background, 1px Boundary Line border, 10px radius. Padding: 9px vertical, 12px horizontal. Body typography (15px, 400 weight).
- **Label:** Geist Mono Label style — uppercase, 11px, 0.08em tracking, System Text color. Rendered above the field, gap 6px.
- **Focus:** Border color transitions to Ice Core; Ice Aura shadow activates. Transition: 180ms ease-out-quint.
- **Placeholder:** System Text color. Same Body typography.
- **Error:** Alert Red border. Error message in Alert Red below the field, Label style.
- **Disabled:** Cursor not-allowed, 50% opacity.

### Cards / Panels

The container vocabulary. Frosted Panel background creates quiet separation from the page background without shadow. The border is structural — it defines the panel.

- **Corner Style:** Gently rounded (10px)
- **Background:** Frosted Panel (`oklch(0.972 0.012 205)`)
- **Shadow:** None at rest. Float Lift on floating/elevated overlays only.
- **Border:** 1px Boundary Line — always present. Removing it dissolves the panel into the background.
- **Internal Padding:** 24px (`{spacing.lg}`)
- **Nested cards:** Prohibited. Internal grouping uses spacing rhythm and Dim Surface background rows — never another card layer.

### Alerts / System Messages

Status communication without drama. Full-border containers, never side-stripe accents.

- **Default:** Frosted Panel background, Boundary Line border, Deep Ink text.
- **Destructive:** Alert Red border (1px), Alert Red text. A 0.12 opacity Alert Red fill may be added to the background when clarity requires it — verify 4.5:1 contrast before shipping.
- **Side stripes:** Prohibited. The color is expressed through border color and text color.

### Navigation

The app header defines the system register: technical, restrained, functional.

- **Structure:** Full-width header with 1px Boundary Line border-bottom. System White background. Content max-width 80rem, 16px horizontal padding.
- **Brand mark:** "LifeOS" in Title style (Geist Sans, 500 weight, 1.125rem), Deep Ink. No icon, no logo gradient.
- **User identity:** System Text, Body style, right-aligned.
- **Actions:** Ghost button variant for logout and secondary nav actions.
- **Active state indicator:** In sidebar or tab navigation, a 2px Ice Core bottom border (tabs) or 2px Ice Core left border (sidebar) indicates the active item. This is the one permitted narrow colored border — structural, not decorative.
- **Mobile:** Header collapses to brand mark plus one action icon. Navigation items become a bottom sheet. No hamburger menu that dumps all items as a stacked list.

### AI Output Panel (Signature Component)

The product's centerpiece. When the AI generates a meal suggestion or weekly plan, the output requires a treatment that communicates: "this was produced by the system, not entered by you."

- **Background:** Dim Surface (`oklch(0.955 0.018 210)`) — one step deeper than Frosted Panel, visually distinct from user-authored content.
- **Border:** 1px Ice Core at 0.35 opacity — a luminous trace that reads as AI-generated without aggression.
- **Header label:** Geist Mono Label style, "SYSTEM" or "AI" prefix in Ice Core, uppercase, fully tracked.
- **Entry animation:** The panel fades in at 0→1 opacity over 240ms (ease-out-quint). Content elements within it stagger at 40ms intervals. Under `prefers-reduced-motion`: instant display, no animation.
- **Override affordance:** Accept and reject actions in Ghost button style at the panel's trailing edge. Present but visually recessed — the AI content is primary until the user acts.

## 6. Do's and Don'ts

### Do:
- **Do** tint every neutral toward ice blue (hue 205°, minimum chroma 0.007). Zero-chroma neutrals read as default gray; the tint reads as designed.
- **Do** use Geist Mono for all numerical data, unit labels, and system metadata — KCAL, BIAŁKO, TŁUSZCZE, WĘGLOWODANY, timestamps, record IDs.
- **Do** express depth through tonal layering (System White → Frosted Panel → Dim Surface) before reaching for shadows or borders.
- **Do** make AI-generated content look visually distinct from user-authored content. The Dim Surface background plus reduced-opacity Ice Core border is the signal for "the system produced this."
- **Do** cap body text at 68ch. Nutrition tables and AI plan outputs may go wider when the layout demands it.
- **Do** animate with ease-out-quint or ease-out-expo at 160–240ms. Never animate layout properties (height, width, padding, margin).
- **Do** suppress all ambient and particle effects when `prefers-reduced-motion` is active. Replace with simple 240ms opacity transitions.
- **Do** use uppercase Geist Mono Labels for all category and metadata labels — they visually encode "this is a data field, not prose."
- **Do** maintain minimum 44×44px touch targets on all interactive elements. Users check this app on mobile in motion.

### Don't:
- **Don't** use heavy neon, dark aggressive palettes, glitch effects, or RGB overload. This is not cyberpunk. The biotech aesthetic here is aerospace-clean and laboratory-precise.
- **Don't** cram nutritional data without hierarchy. MyFitnessPal density — numbers stacked without breathing room — is the primary anti-reference. Every number on screen must have a clear visual role.
- **Don't** use food photography, green "wholesome" branding, or HelloFresh-style warmth. The product's relationship to food is analytical, not appetitive.
- **Don't** go clinical with white and light-blue sterility. The ice palette is luminous, not hospital-blank. Warmth lives in the tinted neutrals and their measured chroma.
- **Don't** use generic SaaS patterns: teal gradient headers, hero-metric cards (big number plus label plus gradient accent), identical icon-heading-text card grids, confetti or celebration animations.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, callouts, or alerts. The AI Output Panel's Ice Core border is a full border, not a stripe.
- **Don't** use glassmorphism (backdrop-filter: blur) as a default surface treatment. Frosted glass is reserved for modals, tooltips, and floating overlays only — never for static cards or panels.
- **Don't** use gradient text (`background-clip: text` plus a gradient). Emphasis through weight (500 vs 400) and scale only. Gradient text is decorative and meaningless.
- **Don't** nest cards. Internal grouping uses Dim Surface background rows or horizontal dividers — never a card within a card.
- **Don't** add bounce or elastic easing to any motion. All transitions use ease-out curves. The interface moves like an intelligent system, not a toy.
