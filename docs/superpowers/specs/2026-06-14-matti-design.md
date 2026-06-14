# Matti — Design Specification

A visual calendar app for iPad, designed for autistic children with intellectual disabilities. Displays Google Calendar events one day at a time with a warm, calm aesthetic. Built as a static PWA (no App Store required).

## Target Audience & Design Rationale

Autistic children with intellectual disabilities benefit from:
- **Predictability**: consistent layout, no surprises
- **Low cognitive load**: one day per screen, minimal text, large visual elements
- **Sensory comfort**: soft warm colors, no animations, no auto-playing sounds
- **Independence**: the child navigates by swiping, no adult help needed to view the schedule

These principles are drawn from evidence-based visual schedule research (NCAEP, ABA therapy best practices, and existing apps like Choiceworks and Lil Planner).

## Language

All UI text is in **Swedish**.

## App Name

**Matti** — displayed under the home screen icon.

## Core Concept

Matti shows **one day at a time**. The app always opens on **today**. Swipe left to see tomorrow, the day after, etc. **You cannot swipe back past today** — yesterday doesn't exist in Matti.

## Day View (Main Screen)

The entire screen shows a single day:

```
┌──────────────────────────────────┐
│                                  │
│          ╭─────────────╮         │
│          │   I D A G    │         │
│          ╰─────────────╯         │
│                                  │
│          T I S D A G             │
│          10 juni                 │
│                                  │
│     ┌──────────────────────┐     │
│     │                      │     │
│     │    🏫               │     │
│     │    Skola             │     │
│     │                      │     │
│     │   ┌──────────────┐   │     │
│     │   │  [bild.jpg]  │   │     │
│     │   └──────────────┘   │     │
│     │                      │     │
│     └──────────────────────┘     │
│                                  │
│  ● ○ ○ ○ ○ ○ ○                  │
│  idag                            │
│  MÅN TIS ONS TOR FRE LÖR SÖN   │
│                                  │
└──────────────────────────────────┘
```

### Header Rules

- If the displayed day is **today**: show "IDAG" in a soft highlight badge
- If **tomorrow**: show "IMORGON"
- If **the day after tomorrow**: show "I ÖVERMORGON"
- Otherwise: show only the weekday name (e.g., "FREDAG")
- **Weekday** is always shown large and prominent (e.g., "TISDAG")
- **Date** shown in small text below (e.g., "10 juni") — not emphasized

### Event Display

- Each event renders as a large card: **emoji + title**
- Emoji is extracted from the beginning of the event title in Google Calendar (e.g., "🏫 Skola"). If no emoji is present, show just the title text without an icon.
- If the event description contains an image URL (first URL matching http(s)://...{.jpg,.jpeg,.png,.gif,.webp}), display the image below the title. Non-image URLs in the description are ignored.
- Multiple events on the same day: vertical list of cards
- No events: show a calm empty state (soft illustration or just "Ingen aktivitet")
- Only **all-day events** are shown. Timed events are ignored.

### Navigation

- **Swipe left**: next day
- **Swipe right**: previous day, but **never before today**
- Swipe animation: smooth card transition (slide)
- No scroll — all content fits on screen (if many events, cards shrink proportionally)

## Timeline (Bottom Bar)

A horizontal dot-based timeline at the bottom of the screen:

```
●━━━━━○━━━━━○━━━━━○━━━━━○━━━━━○━━━━━○
MÅN   TIS   ONS   TOR   FRE   LÖR   SÖN
```

- Filled dot (●) = currently displayed day
- Empty dots (○) = other visible days
- Shows a rolling 7-day window starting from today
- Abbreviated weekday labels below each dot (MÅN, TIS, ONS, etc.)
- Today's dot has a warm accent color
- **Tappable**: tapping a dot navigates to that day
- Timeline scrolls with swipe navigation

## Visual Style

**Palette**: Warm & calm
- Background: soft warm white / light beige (#FAF7F2 or similar)
- Cards: white with subtle rounded corners and soft shadow
- Accent (today badge, active dot): warm light green or light orange
- Text: dark warm gray (#3D3D3D), never pure black
- Emoji: rendered at large size (~48-64px)

**Typography**:
- Weekday: large, bold, sans-serif (e.g., system font at 32-40px)
- "IDAG" badge: medium, uppercase, letter-spaced
- Event title: large, readable (24-28px)
- Date: small, light weight (14-16px)

**Shape language**: rounded corners everywhere, no sharp edges. Generous padding.

**No animations** except the swipe transition. No blinking, pulsing, or auto-moving elements.

## Data Source

- **Google Calendar** via a public iCal URL
- iCal URL is configured once by an adult in a hidden settings page
- Parsed client-side using `ical.js`
- Only all-day events are extracted (DTSTART with DATE type, not DATE-TIME)

### CORS Proxy

Google Calendar iCal URLs block browser requests (CORS). Solution: a minimal Cloudflare Worker that proxies the iCal URL and adds CORS headers. ~10 lines of code, free tier.

### Caching

- Service Worker caches the latest iCal data
- On each app open: fetch fresh data, fall back to cache if offline
- Calendar data refreshed on each app open and periodically (every 30 min while open)

## Configuration (Hidden Settings)

- **Access**: long-press (3 seconds) on the "Matti" title text
- **Content**: single text field for iCal URL + a "Spara" (Save) button
- **Storage**: `localStorage`
- **First-time experience**: if no URL is configured, show a friendly message: "En vuxen behöver ställa in kalendern" with an arrow pointing to where to long-press

## PWA Configuration

- `manifest.json`:
  - `name`: "Matti"
  - `short_name`: "Matti"
  - `display`: "standalone"
  - `orientation`: "any" (supports both portrait and landscape)
  - `background_color`: matches app background
  - `theme_color`: matches accent color
  - App icon: custom Matti icon (warm, rounded, recognizable)
- Apple meta tags: `apple-mobile-web-app-capable`, `apple-touch-icon`
- Viewport: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`
- Service Worker: cache app shell + last fetched calendar data

## File Structure

```
matti-viz/
├── index.html          # Single page app
├── style.css           # All styles
├── app.js              # App logic, iCal parsing, swipe handling
├── sw.js               # Service Worker
├── manifest.json       # PWA manifest
├── icons/              # App icons (multiple sizes)
│   ├── icon-192.png
│   └── icon-512.png
└── proxy/
    └── worker.js       # Cloudflare Worker source for CORS proxy
```

## Responsive Layout

- **Portrait (iPad)**: centered column layout, timeline at bottom
- **Landscape (iPad)**: same layout but wider cards, more horizontal space for timeline
- Touch targets: minimum 44x44px (Apple HIG)
- No zoom allowed (viewport locked)

## What Matti Does NOT Do

- No login or authentication
- No editing events (read-only)
- No timed events (only all-day)
- No notifications or sounds
- No settings beyond the iCal URL
- No yesterday or past days
- No tracking, analytics, or external data sharing
