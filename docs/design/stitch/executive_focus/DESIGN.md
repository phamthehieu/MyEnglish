---
name: Executive Focus
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#3b665f'
  on-secondary: '#ffffff'
  secondary-container: '#bdece2'
  on-secondary-container: '#416c65'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15600'
  on-tertiary-container: '#ffe6d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#bdece2'
  secondary-fixed-dim: '#a2d0c6'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#224e47'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-lg-medium:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-medium:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  caption:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  gutter-tablet: 1.5rem
  margin-tablet: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system establishes a focused, discreet, and refined aesthetic tailored specifically for upwardly mobile working professionals. The visual language eschews loud, juvenile gamification—such as saturated neon badges, bouncing cartoon animals, and confetti bursts—in favor of quiet competence, intellectual dignity, and ergonomic clarity. 

The emotional tone balances calm reassurance with purposeful momentum. The interface must look entirely natural sitting open next to corporate spreadsheets, Slack workspaces, or IDEs during work breaks without drawing unwanted attention. Micro-interactions express accomplishment through understated typographic changes, smooth progress bars, subtle tint shifts, and crisp haptic feedback rather than arcade-style theatrics.

## Colors
The color hierarchy anchors around Deep Teal (`#0F766E`), projecting institutional trust, deep concentration, and career advancement. 

### Role Assignments
- **Primary (`#0F766E`)**: High-intent primary buttons, active state indicators, key learning progression rings, and focused navigation elements.
- **Primary Tints (`#F0FDFA`, `#CCFBF1`)**: Card highlights, selected multiple-choice states, subtle banner backdrops, and active chip containers.
- **Secondary / Supporting Accents**:
  - **Success (`#16A34A`)**: Correct responses, completed lesson nodes, daily streak milestones.
  - **Warning (`#D97706`)**: Soft retention reminders, review schedules, pacing notifications.
  - **Error (`#DC2626`)**: Grammatical errors, pronunciation mismatch feedback, destructive actions.
- **Neutrals**:
  - **Background Canvas (`#F7F8FA`)**: Soft cool-slate off-white to eliminate eye strain under fluorescent or dual-monitor office lighting.
  - **Surface / Containers (`#FFFFFF`)**: Crisp, elevated white for lesson cards, audio player docks, and interactive panels.
  - **Text Primary (`#0F172A`)**: High-contrast, slate-tinted black ensuring minimum 7:1 contrast on white surfaces.
  - **Text Secondary (`#64748B`)**: Contextual metadata, IPA pronunciations, and timestamps maintaining minimum 4.5:1 contrast compliance.
  - **Borders & Separators (`#E2E8F0`)**: Low-distraction structural boundaries.

## Typography
`Be Vietnam Pro` is used universally across all levels to guarantee flawless rendering of complex Vietnamese tone marks and stacked diacritics (dấu mũ, dấu móc, dấu thanh) alongside Latin script. 

Line-height ratios adhere strictly to a 1.4–1.5x minimum baseline to prevent vertical clipping of acute, grave, hook, tilde, and dot marks across both Vietnamese instructional copy and English learning materials. Headings leverage optical kerning and tighter negative letter tracking to convey authoritative poise, while body text uses proportional tracking for effortless micro-reading during short commute or desk study sprints.

## Layout & Spacing
The layout relies on a mobile-first fluid grid optimized for vertical one-handed interactions:
- **Mobile (Base)**: 4-column layout, 16px (`1rem`) outer margins, 16px (`1rem`) gutters. Full-bleed interactive cards conform to the 16px side boundaries.
- **Tablet / Large Mobile**: 8-column layout, 32px (`2rem`) margins, 24px (`1.5rem`) gutters. Content groups lock to a maximum reading container width of 640px to preserve comfortable scan lengths.
- **Vertical Rhythm**: Spacing scales strictly across an 8-point structural base (with 4px half-steps for micro-alignments). Element groupings, answer choices, and study modules maintain minimum 12px to 16px vertical clearances to prevent accidental mis-taps.

## Elevation & Depth
Depth is communicated through low-opacity ambient shadows paired with crisp border outlines, avoiding dramatic skeuomorphic heights:

- **Flat / Base Layer**: Used on canvas (`#F7F8FA`) and inset input fields. Bordered with `#E2E8F0` at 1px thickness.
- **Level 1 (Cards, Modules, List Items)**: `#FFFFFF` surface accompanied by `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)` and a 1px perimeter border in `#E2E8F0`.
- **Level 2 (Audio Controllers, Active Quiz Modals, Floating Actions)**: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`, creating crisp visual isolation without casting distracting gray spreads across adjacent content.
- **Level 3 (Bottom Navigation Bar, Bottom Sheets)**: `box-shadow: 0 -4px 12px 0 rgba(15, 23, 42, 0.04)`, grounding persistent interfaces while retaining optical lightness.

## Shapes
A unified 16px radius (`rounded-lg` under token scale 2) anchors the visual architecture, establishing a contemporary, tactile, and professional contour across interactive elements:

- **16px (`1rem`)**: Applied to all primary call-to-action buttons, learning cards, quiz answer options, audio player widgets, and modal containers.
- **8px (`0.5rem`)**: Applied to internal sub-elements including badges, tags, feedback alerts, and inline vocabulary snippets.
- **Full / Pill (`9999px`)**: Reserved exclusively for audio progress tracks, search pills, and minimal streak tags.

## Components

### Buttons
- **Touch Target**: Strict minimum 48px height across all actionable states.
- **Primary**: Solid `#0F766E` fill, `#FFFFFF` text (`body-lg-medium`), 16px corner radius. Pressed state subtly darkens to `#115E59` with a gentle 0.98x scale compression.
- **Secondary**: `#F0FDFA` fill, `#0F766E` text, 1px border in `#CCFBF1`.
- **Ghost / Tertiary**: Transparent fill, `#0F766E` or `#64748B` text, 48px touch frame with centered label and optional Lucide line icon.

### Cards & Lesson Nodes
- Surface `#FFFFFF`, 16px radius, Level 1 elevation, 1px `#E2E8F0` border.
- Internal padding is 16px (`space-md`) on mobile, expanding to 24px (`space-lg`) for comprehensive review summaries.

### Quiz & Option Selectors (Multiple Choice)
- Idle state: `#FFFFFF` surface, 1px `#E2E8F0` border, text `#0F172A`. Minimum height 56px with 16px internal padding.
- Selected state: `#F0FDFA` background, 1.5px `#0F766E` border, text `#0F766E`.
- Validated Correct: `#F0FDF4` background, 1.5px `#16A34A` border, paired with a green checkmark icon.
- Validated Incorrect: `#FEF2F2` background, 1.5px `#DC2626` border, paired with red cross icon.

### Text Input Fields
- Minimum height 48px. Background `#FFFFFF`, 1px `#E2E8F0` border, 12px horizontal padding, 16px radius.
- Focus state: Border transitions to `#0F766E` with an outer 2px soft ring of `#CCFBF1`. Placeholder text set in `#94A3B8`.

### Chips & Badges
- 32px height, 8px radius. Background `#F1F5F9`, text `#475569`, typography `label-md`. 
- Active filter chip: Background `#0F766E`, text `#FFFFFF`.

### Checkboxes & Radio Buttons
- 22px optical size housed within a 48px transparent touch hit-box. 
- Radio buttons feature a 6px centered dot on active state; checkboxes feature a 1.5px stroke Lucide check icon. Active fill `#0F766E`.

### Audio Pronunciation & Waveform Bar (Domain-Specific)
- Compact 48px height inline unit featuring a rounded play/pause button, synchronized scrubbing timeline in `#0F766E`, and playback rate chip (`1.0x`, `0.8x`) set in `label-md`.