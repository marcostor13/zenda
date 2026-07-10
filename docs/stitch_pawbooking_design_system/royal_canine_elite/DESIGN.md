---
name: Royal Canine Elite
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#454652'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#757684'
  outline-variant: '#c5c5d4'
  surface-tint: '#4156b9'
  primary: '#00135d'
  on-primary: '#ffffff'
  primary-container: '#08258b'
  on-primary-container: '#8094fa'
  inverse-primary: '#b9c3ff'
  secondary: '#805600'
  on-secondary: '#ffffff'
  secondary-container: '#fcaf19'
  on-secondary-container: '#694600'
  tertiary: '#00135c'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a2b75'
  on-tertiary-container: '#8796e5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001158'
  on-primary-fixed-variant: '#273d9f'
  secondary-fixed: '#ffddb0'
  secondary-fixed-dim: '#ffba45'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#614000'
  tertiary-fixed: '#dee1ff'
  tertiary-fixed-dim: '#b9c3ff'
  on-tertiary-fixed: '#001258'
  on-tertiary-fixed-variant: '#31418a'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  crown-gold-light: '#FFC533'
  divider-muted: '#8B9BBC'
  surface-white: '#FFFFFF'
  text-main: '#051A66'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  button-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system embodies a premium, energetic, and highly professional service platform tailored for the pet industry. It draws inspiration from high-end travel booking engines while maintaining a warm, approachable character. The brand personality is "The Royal Treatment for Every Dog"—combining the authority of a market leader with the affection of a pet lover.

The visual style is **Corporate / Modern** with **High-Contrast** accents. It utilizes a modular grid system to convey organization and reliability. The interface uses generous whitespace to highlight service categories, while vibrant brand colors drive action and hierarchy. The aesthetic is clean and functional, ensuring that complex booking flows feel effortless and trustworthy.

## Colors

The palette is anchored by **Royal King Blue**, representing trust and stability, and **Crown Gold**, representing premium quality and warmth. 

- **Primary (Royal King Blue):** Used for primary navigation, headings, and main action buttons.
- **Secondary (Crown Gold):** Reserved for high-priority CTAs, accents, and visual highlights.
- **Tertiary (Deep Shadow Blue):** Used for deep shading, active states of blue elements, and high-contrast text.
- **Neutral:** A very light grey-blue is used for background surfaces to reduce eye strain while maintaining a "cool" professional tone.

Color application should follow the alternating rhythm established in the brand's iconography (Blue-Gold-Blue), creating a dynamic visual pace throughout the user journey.

## Typography

The typography system uses a hierarchical trio of fonts to manage different communicative needs:
- **Headings (Plus Jakarta Sans):** Chosen for its geometric precision and friendly, open counters. This replaces Poppins for a more modern, premium feel while retaining the requested "Black" weight for displays.
- **Body (Inter):** The workhorse for readability. Used for all service descriptions, booking details, and long-form text.
- **Accents (Montserrat Bold):** Used strictly for slogans, labels, and small all-caps headers to provide a distinct, energetic secondary voice.

Maintain high contrast between headlines and body text. Large display sizes should use tighter letter spacing for a "locked-in" professional appearance.

## Layout & Spacing

This design system utilizes a **12-column Fluid Grid** for main content areas and a specialized **5-column Modular Grid** for service category landing sections. 

- **Desktop:** 12 columns with 24px gutters. Content is centered in a 1280px container.
- **Tablet:** 8 columns with 20px gutters and 24px side margins.
- **Mobile:** 4 columns with 16px gutters and 16px side margins.

Spacing follows an 8px rhythmic scale. Vertical rhythm is maintained through "stack" variables (8, 16, 32), ensuring that related elements (like a service icon and its title) stay closer than unrelated sections. Service modules should be separated by 1px vertical dividers in `divider-muted` to maintain the "booking engine" structure.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and extremely subtle **Ambient Shadows**.

- **Level 0 (Background):** `neutral_color_hex` (#F8F9FA).
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF). This is the primary surface for service listings and search results. Use a very soft, diffused shadow (0px 4px 20px rgba(8, 37, 139, 0.05)) to lift these from the background.
- **Level 2 (Interaction/Popovers):** Pure White with a more defined shadow (0px 8px 30px rgba(8, 37, 139, 0.12)) to indicate temporary overlay.

Avoid heavy dark shadows; instead, use low-opacity Royal King Blue tints in the shadows to maintain brand cohesion and a "light" airy feel.

## Shapes

The shape language is "Soft-Modular." 

- **Standard Components:** Buttons, Input fields, and small cards use a **0.5rem (8px)** corner radius to feel professional yet friendly.
- **Large Containers:** Hero sections and primary content cards use a **1rem (16px)** radius to create a distinct, modern boundary.
- **Service Badges:** Icons must always be housed in **Perfect Circles** (fully rounded/pill-shaped logic) to contrast against the rectangular grid of the booking engine.
- **Badges/Tags:** Use the "Pill" style (100px radius) for status indicators (e.g., "Available", "Top Rated").

## Components

- **Buttons:** 
    - **Primary:** Royal King Blue background, white text. Bold, 16px Inter.
    - **Secondary/CTA:** Crown Gold background, Royal King Blue text. Used for "Book Now" or "Search" to draw maximum attention.
- **Service Badges:** 80px x 80px circles. Background colors must alternate Blue -> Gold -> Blue across the 5-column layout. Icons inside are 32px.
- **Inputs:** White background, 1px `divider-muted` border. On focus, the border transitions to 2px Royal King Blue with a subtle blue outer glow.
- **Cards:** White surfaces with 8px radius. Include a 4px Crown Gold "top-bar" accent for featured or premium listings.
- **Iconography:** Use a mix of the custom circular badges for categories and clean, 2pt weight line icons for utility actions (map, filter, sort), rendered in Royal King Blue.
- **Circular Badges:** Each badge contains a "Marker" (a single large letter like 'G', 'A', 'V') positioned slightly offset or integrated with the circle to reinforce the service identity.