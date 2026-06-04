# Product

## Register

product

## Users

People who plan their meals and track macros against personal targets, on the Polish market. They take nutrition seriously, but they are not clinicians or competitive athletes: they want a tool that makes the weekly plan feel light and rewarding to run, not a spreadsheet they have to endure.

Primary context is the mobile browser, often in motion: checking the plan in a grocery aisle or at the kitchen counter, one hand occupied, in daylight. They sit down weekly to plan, then execute daily. They want to see, at a glance, whether today is on track, and they want a small sense of momentum from doing it well.

## Product Purpose

LifeOS closes the loop existing nutrition tools leave open: a recipe catalog, an AI-generated weekly plan optimized against nutritional targets, and an actionable shopping list, all in one flow. The AI proposes; the user decides. Every number on screen is load-bearing, because wrong macros defeat the entire purpose, but the numbers are presented to invite, not to intimidate.

Success looks like a user going from "what should I eat this week?" to a complete, accurate plan and a ready shopping list in a single session, then coming back daily because the app makes the progress feel good to watch.

## Brand Personality

Warm, premium, motivating.

The interface should feel like a well-made consumer finance app rendered in a spatial-glass material (the Apple visionOS idiom): a warm-neutral field with frosted, translucent panels floating in depth, large friendly numerals, and generous room to breathe. The accent vocabulary is monochrome (white, gray, dark, and transparency); there is no brand color. Color is rationed and meaningful: it appears only to tell the user how they are doing against their targets. It is the polished, premium version of that genre, never the cramped tracker or the templated SaaS knock-off.

Motivation comes from clarity, not noise. The app shows progress and status (a gauge filling toward a target, a clean "on track / approaching / over" read on each macro), so the user feels momentum from the data itself. It does this without streaks, badges, confetti, or daily nagging. The reward is seeing the plan come together and the day land on target.

Voice and tone: encouraging but composed, minimal copy, plain confident labels, no filler. Polish throughout: all copy, labels, AI output, and error messages.

## Anti-references

- **Calorie-tracker density** (MyFitnessPal, Cronometer): cramped, utility-ugly, no visual hierarchy, data dumped without rhythm or whitespace.
- **Cheap template SaaS**: teal gradients, the big-number hero-metric template, endless identical card grids, confetti onboarding. We want the refined polish of a good consumer-fintech dashboard, not the templated slop version.
- **Cyberpunk / neon / dark-aggressive**: dark palettes, neon, glitch, RGB overload. This product is light and warm.
- **Cool wealth-tech terminal**: the cobalt-plus-monospace-ticker-plus-brutalist-data-card direction this project previously committed to. Explicitly avoided so we do not drift back into it. The new direction is warm, soft, and proportional, not cool, sharp, and monospaced.

## Design Principles

1. **The number is the hero, made inviting.** Every macro is load-bearing and exact, but it is shown as a large, legible, friendly figure with room around it, not a dense readout. Precision and warmth are not in tension here; the number earns the space.
2. **AI proposes, user disposes.** The interface always defers to the user's override. Suggestions are visibly editable, swappable, and rejectable; nothing the AI generates is locked in.
3. **Progress you can feel.** Show distance to target with gauges, fills, and a clear status read, so a glance tells the user whether they are on track, approaching the limit, or over. Motivation through clarity, never through streaks, badges, or nagging.
4. **Glanceable in motion.** Information hierarchy must survive a two-second glance on a small screen, one hand occupied, in daylight. Spacious is good; cramped and confusing are not.
5. **Premium warmth, never templated.** Reach for the considered, generous layout. Warm and friendly, but deliberately designed, never the stock dashboard grid and never the cramped tracker.

## Accessibility & Inclusion

The user has set a deliberate priority order here: visual aesthetics come first, and the strict contrast/screen-reader regime is intentionally not a gate for this project.

- **Keyboard navigation is kept.** Interactive elements remain reachable and operable by keyboard.
- **Contrast is not a hard requirement.** We do not hold the palette to WCAG AA contrast ratios. Soft, low-contrast warm surfaces are acceptable in service of the aesthetic. Do not reject a color choice solely on a contrast check.
- **Screen-reader support is not a priority.** We do not invest in exhaustive ARIA labeling or a screen-reader-first experience for the MVP.
- **Reduced motion is still respected.** Honor `prefers-reduced-motion`: suppress ambient and assembling motion, resolve count-ups instantly. This is cheap and worth keeping.
- **Touch targets** stay comfortable for a mobile-primary, one-handed product (around 44x44px).
- **Polish language support** throughout: copy, labels, AI output, and error messages.
