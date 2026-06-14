# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Matti is a visual calendar PWA for iPad, designed for autistic children with intellectual disabilities. It displays Google Calendar events one day at a time with a warm, calm aesthetic. All UI text is in Swedish.

## Architecture

Static PWA — vanilla HTML/CSS/JS with ES modules. No build step, no framework, no runtime dependencies.

- `js/dates.js` — Pure date utilities (Swedish labels, emoji extraction, formatting)
- `js/calendar.js` — iCal parser (extracts all-day VEVENTs, expands RRULE)
- `js/swipe.js` — Touch gesture detection
- `js/settings.js` — Hidden settings panel (long-press on title, localStorage)
- `js/app.js` — Orchestrator (state, rendering, data fetching, init)
- `sw.js` — Service Worker (cache-first shell, network-first calendar data)
- `proxy/worker.js` — Cloudflare Worker CORS proxy for Google Calendar iCal URLs

## Commands

```bash
npm test                            # Run all unit tests
node --test tests/dates.test.js     # Run date utility tests only
node --test tests/calendar.test.js  # Run calendar parser tests only
npx serve .                         # Start local dev server
```

## Key Design Decisions

- Only all-day events are shown (timed events are filtered out)
- No external dependencies — iCal parsing is a custom implementation
- Calendar URL stored in localStorage, accessed via hidden settings (3s long-press on title)
- Default CORS proxy: allorigins.win. Production: deploy proxy/worker.js to Cloudflare Workers
- "Today" resets at midnight via a 60-second interval check
- Swipe navigation is forward-only from today (no past days)
- All paths are relative (not absolute) for GitHub Pages compatibility
