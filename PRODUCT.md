# Product

## Register

product

## Users

Nutrition-focused individuals who plan meals seriously and track macros against personal targets. Polish market. Primary context: mobile browser, often in-motion — checking the app while at a grocery store or cooking. They are detail-oriented, trust data, and want precision, not encouragement. They sit down weekly to plan, then execute daily. They are not patients or athletes; they are self-directed people who treat nutrition as a system to optimize.

## Product Purpose

LifeOS closes the loop that existing nutrition tools leave open: recipe catalog → AI-generated weekly plan optimized against nutritional targets → actionable shopping list. The AI proposes; the user decides. Every number on screen is load-bearing — wrong macros defeat the purpose. Success looks like a user who can go from "what should I eat this week?" to a complete, nutritionally accurate plan and a ready shopping list in one session.

## Brand Personality

Intelligent, precise, alive.

The interface feels like an advanced AI operating system applied to human biology — a biotech control panel for personal nutrition. Not a wellness app. Not a fitness tracker. A system. It should feel like it's working, processing, thinking — a living digital environment rather than a static form.

Voice tone: technical but not cold, minimal copy, confident labels, no filler words. System-style uppercase labels for metadata. No cheerful prompts or gamified streaks.

## Anti-references

- **Cyberpunk / gaming aesthetics**: heavy neon, dark aggressive palettes, visual chaos, glitch effects, RGB overload.
- **MyFitnessPal / Cronometer**: cramped calorie-tracker density, utility-first ugliness, no visual hierarchy.
- **HelloFresh / meal-kit brands**: over-saturated food photography, green branding, "wholesome" warmth.
- **Clinical / hospital medical**: white + pale blue sterile feel, form-heavy, bureaucratic layout.
- **Generic SaaS dashboards**: teal gradients, hero-metric templates, identical card grids, confetti onboarding.

## Design Principles

1. **Precision over decoration.** Every visual element frames the data; nothing decorates for its own sake. Nutritional numbers are the truth — the interface is the container, not the spectacle.

2. **Living system, not static layout.** Elements assemble, materialize, dissolve. The UI feels like it is processing and responding, not just displaying. Motion communicates intelligence.

3. **Biotech restraint.** The aesthetic is aerospace and laboratory, not cyberpunk. Light, airy, luminous — frosted glass, ice tones, ambient glow. The system is clean because it is engineered, not because it is simple.

4. **Visible intelligence.** The AI is not hidden behind a button. Its presence is felt in the interface rhythm — suggestions appear, plans construct, alternatives surface. The system thinks; the interface shows it thinking.

5. **Glanceable precision.** Users interact in-context: while shopping, while cooking, one hand occupied. Information hierarchy must survive a 2-second glance on a small screen. Dense data is allowed; confusing data is not.

## Aesthetic Direction

**Color strategy**: Restrained-to-Committed. Dominant surface is soft warm white and frosted pale gray. Accent is ice blue to soft cyan — used deliberately on interactive elements, data highlights, AI-generated content, and status indicators. Holographic iridescence as a rare highlight, not a pattern. Avoid zero-chroma pure white; tint all neutrals toward the ice-blue hue at chroma 0.008–0.015.

**Theme**: Light. Scene: a person at a kitchen counter or grocery store aisle, bright ambient light, phone in one hand, checking their weekly plan before buying chicken breast. The screen needs to be readable in daylight. Dark mode is secondary.

**Typography**: Modern sans-serif, thin to medium weights. Spacious tracking on labels and metadata. Clear scale contrast between data values (large, medium weight) and labels (small, uppercase, tracked out). The scale should feel like a system readout, not a document.

**Motion**: Elements assemble from particles, reconstruct dynamically, materialize like holograms. Smooth cinematic transitions, micro-interactions on hover, ambient floating particles in backgrounds. Never bounce, never elastic. Ease-out-expo or ease-out-quint only. Respect `prefers-reduced-motion` — all ambient animation must be suppressible.

**Layout**: Modular and system-driven. Thin geometric lines, radial and circular motifs where meaningful (not decorative). Layered transparent surfaces with depth. Floating interface panels. Subtle grid geometry in backgrounds. No nested cards.

## Accessibility & Inclusion

- WCAG AA minimum. Light palette requires careful contrast management — ice-blue accents on white backgrounds must hit 4.5:1 for text, 3:1 for non-text UI.
- Polish language support throughout — all copy, labels, AI outputs, and error messages in Polish.
- Touch targets minimum 44×44px for mobile-primary use.
- Color is never the sole carrier of meaning — icons, labels, or patterns must reinforce state.
