# Design Charter

This charter overrides generic "clean / professional / minimal" design rules, including any from design-review skills or presets. If a rule elsewhere conflicts with this charter, this charter wins.

## Audience
Children in the Persian diaspora learning Persian, plus their parents. The child experience must feel like a toy and a picture book, never like office software.

## Color
- Bright, happy, warm palette. Each section/module has its own recognizable color.
- Saffron gold (#FBBF24 → #F97316) is the brand identity.
- Contrast is achieved with dark ink text on bright or soft fills. White text only on deep fills. Never darken a whole palette just to make white text pass.
- Warm neutrals (cream, warm white, warm dark ink) instead of cold slate grays on child screens.
- Gradients are welcome for hero cards, primary actions, and section headers, roughly one strong gradient per screen.

## Illustration and emoji
- Story covers, scene backdrops, and illustrations are core content, not decoration. Show them large on home and story screens.
- Colorful emoji (or colored illustrated icons) carry section identity, feedback, and celebration. Monochrome line icons are only for small utility controls and the parent area.
- For section identity, BottomNav, feedback, and celebration specifically, render the emoji through `<Emoji name="...">` (`apps/web/src/components/shared/Emoji.tsx`, Fluent Emoji "Color" style, `apps/web/public/emoji/`), not a raw emoji character in JSX — it gets a native-glyph fallback if the SVG fails to load. Content emoji (counted objects, board tokens, badge faces, decorative flourishes inside a sentence) and apps/mobile stay native for now.

## Shape and feel
- Chunky, rounded, tactile shapes with 3D bottom edges and springy press feedback.
- Touch targets at least 56px for small fingers.
- Large, clear Persian typography with correct RTL layout. Letters being learned are shown extra large.

## Motion and feedback
- Celebrate success generously: confetti, stars, sounds, bounces.
- Keep mistakes gentle and encouraging, never harsh.
- Respect prefers-reduced-motion.

## Accessibility
- WCAG AA text contrast, achieved via dark-ink-on-bright pairings.
- Minimal reading required; support pre-readers with images, icons, and audio.

## Parent area
Calmer than the child side, but still warm and friendly: cream backgrounds, rounded cards, one soft shadow level, saffron accents. No hairline-gray corporate lists.

## Tooling
scripts/check-child-design-tokens.sh is advisory only and must never block richness (gradients, shadows, radii, color).
