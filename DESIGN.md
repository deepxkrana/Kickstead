---
version: alpha
name: Kickstead
description: A high-contrast retail system for sneaker commerce, balancing bold promotional energy with a clean, image-first product presentation.
colors:
  primary: "#000000"
  secondary: "#FFFFFF"
  tertiary: "#E5E7EB"
  neutral: "#F5F5F5"
  surface: "#FFFFFF"
  on-surface: "#000000"
  error: "#FF0000"
  primary-80: "#1A1A1A"
  primary-60: "#4D4D4D"
  primary-40: "#808080"
  primary-20: "#CCCCCC"
typography:
  headline-display:
    fontFamily: "Montserrat"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline-lg:
    fontFamily: "Montserrat"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: "Montserrat"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline-sm:
    fontFamily: "Montserrat"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0px"
  body-lg:
    fontFamily: "Montserrat"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0px"
  body-md:
    fontFamily: "Montserrat"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0px"
  body-sm:
    fontFamily: "Montserrat"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0px"
  label-lg:
    fontFamily: "Montserrat"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  label-md:
    fontFamily: "Montserrat"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  label-sm:
    fontFamily: "Montserrat"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  caption:
    fontFamily: "Montserrat"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0px"
rounded:
  none: 0px
  sm: 2px
  md: 4px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  xs: 8px
  sm: 20px
  md: 30px
  lg: 38px
  xl: 50px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-80}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: "0px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
---

# Kickstead

## Overview
Kickstead feels bold, commercial, and product-led, with a strong sneaker-retail personality and very little decorative softness. The experience is dense where it needs to convert quickly, but visually restrained: large imagery, strong contrast, and clear hierarchy keep the interface easy to scan. The tone is modern and energetic rather than luxurious or editorial, with emphasis on promotions, category navigation, and featured drops.

## Colors
- **Primary (#000000):** The dominant ink-black used for navigation bars, body text, icons, and the strongest interactive elements. It creates the crisp, athletic retail feel seen throughout the interface.
- **Secondary (#FFFFFF):** The clean white used for text on dark surfaces, cards, and the main page background. It provides maximum contrast and keeps the product photography prominent.
- **Tertiary (#E5E7EB):** A light gray used for subtle dividers, inactive states, and low-emphasis structure such as secondary rules and muted UI affordances.
- **Neutral (#F5F5F5):** A soft off-white supporting background and chip-like surfaces where the design needs a slight tonal break without adding visual weight.
- **Surface (#FFFFFF):** The primary component surface color for cards, inputs, and page sections.
- **On-surface (#000000):** The default content color on light surfaces, reinforcing the stark, high-contrast retail aesthetic.
- **Error (#FF0000):** Used sparingly for urgency and promotional emphasis, matching the vivid red accent seen in navigation and section underlines.
- **Primary scale (#1A1A1A / #4D4D4D / #808080 / #CCCCCC):** Progressive dark-to-light neutrals for hover states, disabled states, borders, and secondary text without leaving the monochrome system.

## Typography
The system uses Montserrat as the primary interface typeface, replacing the more serif-like look suggested by the source styling with a cleaner, more product-forward sans serif system for implementation. Headings are bold, compact, and tightly tracked, with `headline-display`, `headline-lg`, and `headline-md` carrying the strongest hierarchy for hero messages and section titles. Body text stays in regular weight for clarity, while labels are bold and slightly letter-spaced to support navigation, category tabs, and CTA buttons. Uppercase usage is important: nav items, section labels, and promotional text read as all-caps or near-all-caps, giving the interface a sporty, assertive retail voice.

## Layout
The layout is full-bleed and image-centric, with broad horizontal sections and minimal framing around the hero media. The spacing rhythm is moderate to generous, using the `xs` through `xl` scale to separate dense navigation from wide editorial blocks and content sections. Buttons and filters use compact internal padding, while section spacing should remain visibly open so product imagery and promotional banners can breathe. The structure favors clear top-level scanning over complex nested grids.

## Elevation & Depth
Depth is intentionally flat. There are essentially no shadows, and hierarchy is created through contrast, layering, and hard edges rather than elevation. The interface relies on dark overlays, strong type weight, and tonal separation between black navigation, white content areas, and light dividers to distinguish sections. Cards and controls should remain visually grounded and avoid soft material effects.

## Shapes
The shape language is restrained and practical. Interactive elements use small radii, primarily `rounded.md` at 4px, with occasional `rounded.lg` for cards and `rounded.full` for pills or chips. The overall feel is architectural and crisp rather than playful, matching a sneaker storefront that wants to feel precise and efficient.

## Components
**Buttons:** Primary buttons use `button-primary` with a black fill, white text, 40px height, and 4px corners. Secondary actions use `button-secondary`, which keeps the same footprint but switches to transparent fill with a black border or edge emphasis. Tertiary links use `button-tertiary` for inline navigation and “view all” style actions. Hover states should darken slightly using `button-primary-hover`, while staying flat and shadow-free.

**Navigation:** Top-level navigation should use bold uppercase labels with tight tracking and strong contrast. Active or promotional items can use the error red accent for emphasis, but only one item at a time should carry that level of urgency. Icons should be simple, monochrome, and lightweight.

**Cards:** Cards should use `card` with a white surface, subtle light-gray border, 8px radius, and 16px padding. Keep them flat and image-first; avoid heavy shadows or overly decorative framing. Use cards to contain product content rather than compete with it.

**Inputs:** Inputs should follow `input` with 40px height, modest internal padding, and a 4px corner radius. Borders should be minimal and neutral, with strong focus indication handled by color rather than depth. Keep form controls visually quiet so they do not distract from merchandise.

**Chips and filters:** Chips should use `chip`, with pill-shaped corners, compact padding, and bold label styling. Active filters can appear darker or underlined to show selection, while inactive filters should remain neutral and understated. This is especially useful for category toggles like footwear/apparel.

**Hero controls and indicators:** Carousel arrows, pagination dots, and floating utility buttons should remain minimal and monochrome, with red reserved for active states or promotional emphasis. Controls should be readable over photography without introducing shadows or thick borders.

## Do's and Don'ts
- Do keep the system high-contrast and monochrome first, with red used only as an accent.
- Do preserve the flat visual language; use borders and contrast instead of shadows.
- Do use bold uppercase labels for navigation, tabs, and promotional calls to action.
- Do let product imagery dominate the composition, especially in hero and feature sections.
- Don't introduce soft pastels, gradients, or decorative color palettes.
- Don't use rounded corners larger than the defined scale or overly pill-shaped buttons.
- Don't mix serif display styling into the core interface unless a campaign treatment explicitly requires it.
- Don't overcrowd sections with too many competing CTAs or dense grouped controls.