# Matti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static PWA that displays Google Calendar events one day at a time, designed for autistic children with intellectual disabilities.

**Architecture:** Vanilla HTML/CSS/JS with ES modules. No build step, no framework. Pure functions for date logic and iCal parsing (tested with Node's built-in test runner). DOM rendering and touch gestures in separate modules. Calendar data fetched via a CORS proxy from a public iCal URL.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties, Node.js test runner, Cloudflare Workers (CORS proxy), GitHub Pages (hosting)

**Spec:** `docs/superpowers/specs/2026-06-14-matti-design.md`

---

## File Structure

All files created from scratch (empty repo):

```
matti-viz/
├── index.html            # Single page — loads all modules, contains DOM structure
├── style.css             # All styles — CSS custom properties for palette
├── js/
│   ├── app.js            # Orchestrator: state, rendering, init, data refresh
│   ├── calendar.js       # iCal parsing: unfold lines, extract VEVENTs, expand RRULE
│   ├── dates.js          # Pure date utilities: labels, formatting, emoji/image extraction
│   ├── swipe.js          # Touch gesture detection, fires onSwipeLeft/onSwipeRight
│   └── settings.js       # Hidden settings panel: long-press, localStorage, first-time UX
├── sw.js                 # Service Worker: cache shell + calendar data
├── manifest.json         # PWA manifest
├── icons/
│   ├── icon.svg          # Source SVG icon (warm rounded "M")
│   ├── icon-192.png      # PWA icon (generated)
│   └── icon-512.png      # PWA icon (generated)
├── tests/
│   ├── dates.test.js     # Unit tests for dates.js
│   └── calendar.test.js  # Unit tests for calendar.js
├── proxy/
│   └── worker.js         # Cloudflare Worker CORS proxy (~15 lines)
└── package.json          # type:module + test script (no runtime deps)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `manifest.json`
- Create: `icons/icon.svg`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "matti-viz",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Create manifest.json**

```json
{
  "name": "Matti",
  "short_name": "Matti",
  "start_url": ".",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#FAF7F2",
  "theme_color": "#A8D5BA",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 3: Create icon SVG**

Create `icons/icon.svg` — a warm rounded square with the letter "M" in a friendly sans-serif font. Sage green background (#A8D5BA), white letter, rounded corners.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#A8D5BA"/>
  <text x="256" y="340" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="300" font-weight="700" fill="white">M</text>
</svg>
```

- [ ] **Step 4: Generate PNG icons from SVG**

Run: `npx @anthropic-ai/svg-to-png icons/icon.svg --sizes 192,512 --output icons/`

If that tool isn't available, use this fallback Node script (save as `scripts/generate-icons.js`, run once, then delete):

```js
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

for (const size of [192, 512]) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.22;

  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fillStyle = '#A8D5BA';
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.59}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2 + size * 0.03);

  writeFileSync(`icons/icon-${size}.png`, canvas.toBuffer('image/png'));
}
```

If the `canvas` npm package isn't available, open `icons/icon.svg` in a browser, right-click → "Save as PNG", and resize to 192x192 and 512x512 manually.

- [ ] **Step 5: Commit**

```bash
git init
git add package.json manifest.json icons/
git commit -m "chore: project scaffolding — package.json, PWA manifest, app icons"
```

---

## Task 2: Date Utilities (TDD)

**Files:**
- Create: `tests/dates.test.js`
- Create: `js/dates.js`

All functions in `dates.js` are pure (no DOM, no side effects). Tested with Node's built-in test runner.

- [ ] **Step 1: Write failing tests**

Create `tests/dates.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmoji,
  extractImageUrl,
  getRelativeLabel,
  getWeekdayName,
  getWeekdayShort,
  formatDate,
  getTimelineDays,
  dateToString,
} from '../js/dates.js';

describe('extractEmoji', () => {
  it('extracts emoji from start of title', () => {
    const result = extractEmoji('🏫 Skola');
    assert.deepEqual(result, { emoji: '🏫', text: 'Skola' });
  });

  it('returns null emoji when no emoji present', () => {
    const result = extractEmoji('Skola');
    assert.deepEqual(result, { emoji: null, text: 'Skola' });
  });

  it('handles emoji without space after', () => {
    const result = extractEmoji('🏊Simning');
    assert.deepEqual(result, { emoji: '🏊', text: 'Simning' });
  });

  it('does not treat digits as emoji', () => {
    const result = extractEmoji('3 saker');
    assert.deepEqual(result, { emoji: null, text: '3 saker' });
  });

  it('handles ZWJ sequences', () => {
    const result = extractEmoji('👨‍👩‍👧 Familj');
    assert.equal(result.text, 'Familj');
    assert.ok(result.emoji !== null);
  });
});

describe('extractImageUrl', () => {
  it('extracts jpg URL from description', () => {
    const url = extractImageUrl('Bild: https://example.com/skola.jpg resten');
    assert.equal(url, 'https://example.com/skola.jpg');
  });

  it('extracts png URL', () => {
    const url = extractImageUrl('https://img.host/photo.png');
    assert.equal(url, 'https://img.host/photo.png');
  });

  it('extracts URL with query parameters', () => {
    const url = extractImageUrl('https://img.host/photo.jpg?w=400&h=300');
    assert.equal(url, 'https://img.host/photo.jpg?w=400&h=300');
  });

  it('returns null when no image URL', () => {
    assert.equal(extractImageUrl('No image here'), null);
  });

  it('returns null for non-image URLs', () => {
    assert.equal(extractImageUrl('Visit https://example.com/page'), null);
  });

  it('returns null for empty/undefined description', () => {
    assert.equal(extractImageUrl(''), null);
    assert.equal(extractImageUrl(undefined), null);
  });
});

describe('getRelativeLabel', () => {
  const today = new Date(2026, 5, 14); // June 14, 2026

  it('returns IDAG for today', () => {
    assert.equal(getRelativeLabel(new Date(2026, 5, 14), today), 'IDAG');
  });

  it('returns IMORGON for tomorrow', () => {
    assert.equal(getRelativeLabel(new Date(2026, 5, 15), today), 'IMORGON');
  });

  it('returns I ÖVERMORGON for day after tomorrow', () => {
    assert.equal(getRelativeLabel(new Date(2026, 5, 16), today), 'I ÖVERMORGON');
  });

  it('returns null for 3+ days ahead', () => {
    assert.equal(getRelativeLabel(new Date(2026, 5, 17), today), null);
  });
});

describe('getWeekdayName', () => {
  it('returns Swedish weekday names', () => {
    assert.equal(getWeekdayName(new Date(2026, 5, 14)), 'SÖNDAG'); // June 14 2026 is Sunday
    assert.equal(getWeekdayName(new Date(2026, 5, 15)), 'MÅNDAG');
    assert.equal(getWeekdayName(new Date(2026, 5, 16)), 'TISDAG');
  });
});

describe('getWeekdayShort', () => {
  it('returns abbreviated Swedish weekday names', () => {
    assert.equal(getWeekdayShort(new Date(2026, 5, 15)), 'MÅN');
    assert.equal(getWeekdayShort(new Date(2026, 5, 19)), 'FRE');
  });
});

describe('formatDate', () => {
  it('formats date as "D månad"', () => {
    assert.equal(formatDate(new Date(2026, 5, 14)), '14 juni');
    assert.equal(formatDate(new Date(2026, 0, 3)), '3 januari');
    assert.equal(formatDate(new Date(2026, 11, 25)), '25 december');
  });
});

describe('dateToString', () => {
  it('converts date to YYYY-MM-DD string', () => {
    assert.equal(dateToString(new Date(2026, 5, 14)), '2026-06-14');
    assert.equal(dateToString(new Date(2026, 0, 3)), '2026-01-03');
  });
});

describe('getTimelineDays', () => {
  it('returns 7 days starting from today', () => {
    const today = new Date(2026, 5, 14);
    const days = getTimelineDays(today);
    assert.equal(days.length, 7);
    assert.equal(days[0].dateStr, '2026-06-14');
    assert.equal(days[6].dateStr, '2026-06-20');
  });

  it('includes weekday short names', () => {
    const today = new Date(2026, 5, 15); // Monday
    const days = getTimelineDays(today);
    assert.equal(days[0].weekdayShort, 'MÅN');
  });

  it('each day has offset from today', () => {
    const today = new Date(2026, 5, 14);
    const days = getTimelineDays(today);
    assert.equal(days[0].offset, 0);
    assert.equal(days[3].offset, 3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/dates.test.js`

Expected: All tests fail with `Cannot find module '../js/dates.js'`

- [ ] **Step 3: Implement dates.js**

Create `js/dates.js`:

```js
const WEEKDAYS = ['SÖNDAG', 'MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'LÖRDAG'];
const WEEKDAYS_SHORT = ['SÖN', 'MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR'];
const MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

const EMOJI_RE = /^(\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*)\s*/u;
const IMAGE_URL_RE = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?/i;

export function extractEmoji(title) {
  const match = title.match(EMOJI_RE);
  if (match) {
    return { emoji: match[1], text: title.slice(match[0].length) };
  }
  return { emoji: null, text: title };
}

export function extractImageUrl(description) {
  if (!description) return null;
  const match = description.match(IMAGE_URL_RE);
  return match ? match[0] : null;
}

export function getRelativeLabel(date, today) {
  const diff = Math.round((date - today) / 86_400_000);
  if (diff === 0) return 'IDAG';
  if (diff === 1) return 'IMORGON';
  if (diff === 2) return 'I ÖVERMORGON';
  return null;
}

export function getWeekdayName(date) {
  return WEEKDAYS[date.getDay()];
}

export function getWeekdayShort(date) {
  return WEEKDAYS_SHORT[date.getDay()];
}

export function formatDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function dateToString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTimelineDays(today) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push({
      date: d,
      dateStr: dateToString(d),
      weekdayShort: getWeekdayShort(d),
      offset: i,
    });
  }
  return days;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/dates.test.js`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/dates.js tests/dates.test.js
git commit -m "feat: date utility functions with Swedish labels and formatting"
```

---

## Task 3: iCal Parser (TDD)

**Files:**
- Create: `tests/calendar.test.js`
- Create: `js/calendar.js`

The parser handles Google Calendar iCal format: unfolds lines, extracts all-day VEVENTs, expands basic RRULE patterns (DAILY, WEEKLY with BYDAY). No external dependencies.

- [ ] **Step 1: Write failing tests**

Create `tests/calendar.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEvents, getEventsForDate } from '../js/calendar.js';

const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260615
DTEND;VALUE=DATE:20260616
SUMMARY:🏫 Skola
DESCRIPTION:Bild: https://example.com/skola.jpg
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260615
DTEND;VALUE=DATE:20260616
SUMMARY:🏊 Simning
END:VEVENT
BEGIN:VEVENT
DTSTART:20260615T090000Z
DTEND:20260615T100000Z
SUMMARY:Timed Meeting
END:VEVENT
END:VCALENDAR`;

describe('parseEvents — basic', () => {
  it('parses all-day events', () => {
    const events = parseEvents(SAMPLE_ICAL, '2026-06-15', '2026-06-16');
    const june15 = events.filter(e => e.date === '2026-06-15');
    assert.equal(june15.length, 2);
  });

  it('filters out timed events', () => {
    const events = parseEvents(SAMPLE_ICAL, '2026-06-15', '2026-06-16');
    const timed = events.filter(e => e.title.includes('Timed'));
    assert.equal(timed.length, 0);
  });

  it('extracts title and description', () => {
    const events = parseEvents(SAMPLE_ICAL, '2026-06-15', '2026-06-16');
    const skola = events.find(e => e.title.includes('Skola'));
    assert.ok(skola);
    assert.ok(skola.description.includes('https://example.com/skola.jpg'));
  });
});

describe('parseEvents — multi-day', () => {
  const MULTI_DAY = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260615
DTEND;VALUE=DATE:20260618
SUMMARY:🏕 Läger
END:VEVENT
END:VCALENDAR`;

  it('expands multi-day events to each date', () => {
    const events = parseEvents(MULTI_DAY, '2026-06-14', '2026-06-19');
    assert.equal(events.filter(e => e.title.includes('Läger')).length, 3);
    assert.ok(events.find(e => e.date === '2026-06-15'));
    assert.ok(events.find(e => e.date === '2026-06-16'));
    assert.ok(events.find(e => e.date === '2026-06-17'));
  });
});

describe('parseEvents — RRULE WEEKLY', () => {
  const WEEKLY = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260602
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
SUMMARY:🏫 Skola
END:VEVENT
END:VCALENDAR`;

  it('expands weekly recurring events', () => {
    const events = parseEvents(WEEKLY, '2026-06-01', '2026-06-15');
    const dates = events.map(e => e.date).sort();
    assert.ok(dates.includes('2026-06-01')); // Mon
    assert.ok(dates.includes('2026-06-03')); // Wed
    assert.ok(dates.includes('2026-06-05')); // Fri
    assert.ok(dates.includes('2026-06-08')); // Mon
    assert.ok(!dates.includes('2026-06-02')); // Tue — not in BYDAY
  });
});

describe('parseEvents — RRULE DAILY', () => {
  const DAILY = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260610
DTEND;VALUE=DATE:20260611
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:💊 Medicin
END:VEVENT
END:VCALENDAR`;

  it('expands daily recurring with COUNT', () => {
    const events = parseEvents(DAILY, '2026-06-10', '2026-06-20');
    assert.equal(events.length, 3);
    assert.equal(events[0].date, '2026-06-10');
    assert.equal(events[1].date, '2026-06-11');
    assert.equal(events[2].date, '2026-06-12');
  });
});

describe('parseEvents — RRULE with UNTIL', () => {
  const UNTIL = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260602
RRULE:FREQ=DAILY;UNTIL=20260603
SUMMARY:Kort serie
END:VEVENT
END:VCALENDAR`;

  it('stops at UNTIL date', () => {
    const events = parseEvents(UNTIL, '2026-06-01', '2026-06-10');
    assert.equal(events.length, 3); // June 1, 2, 3
  });
});

describe('parseEvents — line folding', () => {
  const FOLDED = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260615
DTEND;VALUE=DATE:20260616
SUMMARY:🎨 Konst och pyssel
 med lera
DESCRIPTION:En lång beskrivning som
 fortsätter på nästa rad med https://example
 .com/bild.png
END:VEVENT
END:VCALENDAR`;

  it('unfolds continuation lines', () => {
    const events = parseEvents(FOLDED, '2026-06-15', '2026-06-16');
    assert.equal(events.length, 1);
    assert.ok(events[0].title.includes('Konst och pyssel med lera'));
  });
});

describe('getEventsForDate', () => {
  it('filters events by date string', () => {
    const events = [
      { date: '2026-06-15', title: 'A' },
      { date: '2026-06-15', title: 'B' },
      { date: '2026-06-16', title: 'C' },
    ];
    const result = getEventsForDate(events, '2026-06-15');
    assert.equal(result.length, 2);
  });

  it('returns empty array when no events', () => {
    const result = getEventsForDate([], '2026-06-15');
    assert.deepEqual(result, []);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/calendar.test.js`

Expected: Fails with `Cannot find module '../js/calendar.js'`

- [ ] **Step 3: Implement calendar.js**

Create `js/calendar.js`:

```js
const BYDAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unfoldLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function parseDate(val) {
  // "20260615" → "2026-06-15"
  return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
}

function dateFromString(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const d = dateFromString(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function unescapeIcal(val) {
  return val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function extractVEvents(ical) {
  const unfolded = unfoldLines(ical);
  const blocks = [];
  const re = /BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g;
  let match;
  while ((match = re.exec(unfolded)) !== null) {
    const props = {};
    for (const line of match[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx);
      const val = line.slice(colonIdx + 1);
      const baseName = key.split(';')[0];
      props[baseName] = val;
      props[key] = val;
    }
    blocks.push(props);
  }
  return blocks;
}

function isAllDay(props) {
  const hasValueDate = Object.keys(props).some(
    k => k.startsWith('DTSTART') && k.includes('VALUE=DATE')
  );
  if (hasValueDate) return true;
  const raw = props['DTSTART'] || '';
  return /^\d{8}$/.test(raw);
}

function getDtstart(props) {
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('DTSTART')) return v.replace(/\s/g, '');
  }
  return null;
}

function getDtend(props) {
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('DTEND')) return v.replace(/\s/g, '');
  }
  return null;
}

function parseRRule(rruleStr) {
  const parts = {};
  for (const part of rruleStr.split(';')) {
    const [k, v] = part.split('=');
    parts[k] = v;
  }
  return parts;
}

function expandRRule(startDate, rrule, rangeStart, rangeEnd) {
  const rule = parseRRule(rrule);
  const freq = rule.FREQ;
  const count = rule.COUNT ? parseInt(rule.COUNT) : Infinity;
  const until = rule.UNTIL ? parseDate(rule.UNTIL.replace(/T.*/, '')) : rangeEnd;
  const interval = rule.INTERVAL ? parseInt(rule.INTERVAL) : 1;
  const byDay = rule.BYDAY ? rule.BYDAY.split(',') : null;

  const dates = [];
  let generated = 0;

  if (freq === 'DAILY') {
    let current = dateFromString(startDate);
    while (generated < count && toDateStr(current) <= until && toDateStr(current) <= rangeEnd) {
      const ds = toDateStr(current);
      if (ds >= rangeStart) {
        dates.push(ds);
      }
      generated++;
      current.setDate(current.getDate() + interval);
    }
  } else if (freq === 'WEEKLY') {
    const targetDays = byDay ? byDay.map(d => BYDAY_MAP[d]) : [dateFromString(startDate).getDay()];
    let current = dateFromString(startDate);
    // Go to start of the week containing DTSTART
    const startDow = current.getDay();
    current.setDate(current.getDate() - startDow);

    while (generated < count && toDateStr(current) <= until && toDateStr(current) <= rangeEnd) {
      for (const dow of targetDays) {
        const candidate = new Date(current);
        candidate.setDate(candidate.getDate() + dow);
        const ds = toDateStr(candidate);
        if (ds < startDate) continue;
        if (ds > until || ds > rangeEnd) break;
        if (generated >= count) break;
        if (ds >= rangeStart) {
          dates.push(ds);
        }
        generated++;
      }
      current.setDate(current.getDate() + 7 * interval);
    }
  }

  return dates;
}

export function parseEvents(icalText, rangeStart, rangeEnd) {
  const vevents = extractVEvents(icalText);
  const events = [];

  for (const props of vevents) {
    if (!isAllDay(props)) continue;

    const rawStart = getDtstart(props);
    if (!rawStart) continue;
    const startDate = parseDate(rawStart);
    const title = unescapeIcal(props['SUMMARY'] || '');
    const description = unescapeIcal(props['DESCRIPTION'] || '');
    const rrule = props['RRULE'];

    if (rrule) {
      const dates = expandRRule(startDate, rrule, rangeStart, rangeEnd);
      for (const date of dates) {
        events.push({ date, title, description });
      }
    } else {
      const rawEnd = getDtend(props);
      const endDate = rawEnd ? parseDate(rawEnd) : addDays(startDate, 1);
      // Multi-day: expand from startDate to endDate (exclusive)
      let current = dateFromString(startDate);
      const end = dateFromString(endDate);
      while (current < end) {
        const ds = toDateStr(current);
        if (ds >= rangeStart && ds <= rangeEnd) {
          events.push({ date: ds, title, description });
        }
        current.setDate(current.getDate() + 1);
      }
    }
  }

  return events;
}

export function getEventsForDate(events, dateStr) {
  return events.filter(e => e.date === dateStr);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/calendar.test.js`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/calendar.js tests/calendar.test.js
git commit -m "feat: iCal parser with RRULE expansion and multi-day event support"
```

---

## Task 4: HTML Structure & CSS

**Files:**
- Create: `index.html`
- Create: `style.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Matti">
  <meta name="theme-color" content="#A8D5BA">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <title>Matti</title>
</head>
<body>
  <div id="app">
    <!-- First-time setup message (shown when no iCal URL configured) -->
    <div id="setup-screen" class="screen hidden">
      <p class="setup-message">En vuxen behöver ställa in kalendern</p>
      <p class="setup-hint">Tryck och håll på <strong>Matti</strong> ovanför</p>
    </div>

    <!-- Main app (shown when calendar is configured) -->
    <div id="main-screen" class="screen hidden">
      <header id="header">
        <h1 id="app-title">Matti</h1>
      </header>

      <div id="day-container">
        <div id="day-view">
          <div id="day-label-badge"></div>
          <div id="day-weekday"></div>
          <div id="day-date"></div>
          <div id="events-list"></div>
          <div id="empty-state" class="hidden">
            <p>Ingen aktivitet</p>
          </div>
        </div>
      </div>

      <nav id="timeline"></nav>
    </div>

    <!-- Loading state -->
    <div id="loading-screen" class="screen hidden">
      <p>Laddar...</p>
    </div>

    <!-- Settings overlay -->
    <div id="settings-overlay" class="hidden">
      <div id="settings-panel">
        <h2>Inställningar</h2>
        <label for="ical-url-input">Kalender-URL (iCal)</label>
        <input type="url" id="ical-url-input"
               placeholder="https://calendar.google.com/calendar/ical/...">
        <label for="proxy-url-input">CORS-proxy (valfritt)</label>
        <input type="url" id="proxy-url-input"
               placeholder="https://your-proxy.workers.dev">
        <div class="settings-buttons">
          <button id="settings-save">Spara</button>
          <button id="settings-close">Stäng</button>
        </div>
      </div>
    </div>
  </div>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

```css
:root {
  --bg: #FAF7F2;
  --card-bg: #FFFFFF;
  --card-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  --card-radius: 20px;
  --accent: #A8D5BA;
  --accent-soft: rgba(168, 213, 186, 0.3);
  --text: #3D3D3D;
  --text-light: #9A9A9A;
  --dot-inactive: #D9D9D9;
  --dot-line: #E8E8E8;
  --overlay-bg: rgba(0, 0, 0, 0.4);
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Screens */
.screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.hidden {
  display: none !important;
}

/* Setup screen */
.setup-message {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  padding: 0 40px;
  line-height: 1.4;
}

.setup-hint {
  margin-top: 24px;
  font-size: 16px;
  color: var(--text-light);
  text-align: center;
}

/* Loading screen */
#loading-screen p {
  font-size: 20px;
  color: var(--text-light);
}

/* Header */
#header {
  padding: 24px 0 0;
  text-align: center;
}

#app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-light);
  letter-spacing: 2px;
  text-transform: uppercase;
}

/* Main screen */
#main-screen {
  justify-content: flex-start;
}

/* Day container */
#day-container {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

#day-view {
  width: 100%;
  max-width: 600px;
  padding: 0 32px;
  text-align: center;
  will-change: transform, opacity;
}

/* Day label badge (IDAG / IMORGON / I ÖVERMORGON) */
#day-label-badge {
  display: inline-block;
  padding: 6px 20px;
  border-radius: 30px;
  background: var(--accent-soft);
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

#day-label-badge.hidden {
  display: none;
}

/* Weekday */
#day-weekday {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 4px;
}

/* Date */
#day-date {
  font-size: 15px;
  font-weight: 400;
  color: var(--text-light);
  margin-bottom: 32px;
}

/* Events */
#events-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.event-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: 24px 32px;
  width: 100%;
  max-width: 440px;
  text-align: center;
}

.event-emoji {
  font-size: 56px;
  line-height: 1.2;
  margin-bottom: 8px;
}

.event-title {
  font-size: 26px;
  font-weight: 600;
}

.event-image {
  margin-top: 16px;
  border-radius: 12px;
  max-width: 100%;
  max-height: 200px;
  object-fit: cover;
}

/* Empty state */
#empty-state {
  padding: 40px;
}

#empty-state p {
  font-size: 22px;
  color: var(--text-light);
  font-weight: 500;
}

/* Timeline */
#timeline {
  padding: 20px 32px 40px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.timeline-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  padding: 0 8px;
}

.timeline-track::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 18px;
  right: 18px;
  height: 3px;
  background: var(--dot-line);
  border-radius: 2px;
  z-index: 0;
}

.timeline-dot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
  min-height: 44px;
  justify-content: flex-start;
  padding-top: 2px;
}

.timeline-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--dot-inactive);
  transition: background 0.2s ease, transform 0.2s ease;
}

.timeline-dot.active {
  background: var(--accent);
  transform: scale(1.3);
}

.timeline-dot.today {
  border: 3px solid var(--accent);
}

.timeline-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-light);
  letter-spacing: 0.5px;
}

/* Settings overlay */
#settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

#settings-panel {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 32px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
}

#settings-panel h2 {
  font-size: 22px;
  margin-bottom: 20px;
}

#settings-panel label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-light);
  margin-bottom: 6px;
  margin-top: 16px;
}

#settings-panel label:first-of-type {
  margin-top: 0;
}

#settings-panel input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--dot-line);
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

#settings-panel input:focus {
  border-color: var(--accent);
}

.settings-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.settings-buttons button {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

#settings-save {
  background: var(--accent);
  color: white;
}

#settings-close {
  background: var(--dot-line);
  color: var(--text);
}

/* Landscape adjustments */
@media (orientation: landscape) {
  #day-view {
    max-width: 800px;
  }

  #day-weekday {
    font-size: 32px;
  }

  .event-card {
    max-width: 520px;
    padding: 20px 28px;
  }

  .event-emoji {
    font-size: 48px;
  }

  .event-title {
    font-size: 24px;
  }

  #timeline {
    max-width: 700px;
    padding-bottom: 24px;
  }
}
```

- [ ] **Step 3: Open in browser and verify the static layout**

Run: `npx serve .` (or `python3 -m http.server 8000`)

Open `http://localhost:8000` (or port shown). Verify:
- Background is warm beige (#FAF7F2)
- Page is blank (modules not wired yet) but no console errors
- Manifest loads (check DevTools → Application → Manifest)

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: HTML structure and CSS styles with warm calm palette"
```

---

## Task 5: Day View Rendering & App Init

**Files:**
- Create: `js/app.js`

This task wires up the rendering: reads state, builds the day header and event cards, handles the empty state. Uses hardcoded test data first.

- [ ] **Step 1: Create js/app.js with state and rendering**

```js
import { extractEmoji, extractImageUrl, getRelativeLabel, getWeekdayName, formatDate, dateToString, getTimelineDays } from './dates.js';
import { parseEvents, getEventsForDate } from './calendar.js';
import { initSwipe } from './swipe.js';
import { initSettings, getIcalUrl, getProxyUrl } from './settings.js';

const DEFAULT_PROXY = 'https://api.allorigins.win/raw';

const state = {
  today: null,     // Date object, midnight local time
  dayOffset: 0,    // 0 = today, 1 = tomorrow, ...
  events: [],      // parsed event objects from iCal
  loading: false,
};

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getCurrentDate() {
  const d = new Date(state.today);
  d.setDate(d.getDate() + state.dayOffset);
  return d;
}

// --- Rendering ---

function renderDayView() {
  const date = getCurrentDate();
  const dateStr = dateToString(date);
  const relLabel = getRelativeLabel(date, state.today);

  const badge = document.getElementById('day-label-badge');
  if (relLabel) {
    badge.textContent = relLabel;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  document.getElementById('day-weekday').textContent = getWeekdayName(date);
  document.getElementById('day-date').textContent = formatDate(date);

  const dayEvents = getEventsForDate(state.events, dateStr);
  const list = document.getElementById('events-list');
  const emptyState = document.getElementById('empty-state');

  list.innerHTML = '';

  if (dayEvents.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    for (const event of dayEvents) {
      list.appendChild(createEventCard(event));
    }
  }

  renderTimeline();
}

function createEventCard(event) {
  const { emoji, text } = extractEmoji(event.title);
  const imageUrl = extractImageUrl(event.description);

  const card = document.createElement('div');
  card.className = 'event-card';

  if (emoji) {
    const emojiEl = document.createElement('div');
    emojiEl.className = 'event-emoji';
    emojiEl.textContent = emoji;
    card.appendChild(emojiEl);
  }

  const titleEl = document.createElement('div');
  titleEl.className = 'event-title';
  titleEl.textContent = text;
  card.appendChild(titleEl);

  if (imageUrl) {
    const img = document.createElement('img');
    img.className = 'event-image';
    img.src = imageUrl;
    img.alt = text;
    img.loading = 'lazy';
    card.appendChild(img);
  }

  return card;
}

// --- Timeline ---

function renderTimeline() {
  const timeline = document.getElementById('timeline');
  const days = getTimelineDays(state.today);

  timeline.innerHTML = '';
  const track = document.createElement('div');
  track.className = 'timeline-track';

  for (const day of days) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-dot-wrapper';
    wrapper.addEventListener('click', () => navigateToDay(day.offset));

    const dot = document.createElement('div');
    dot.className = 'timeline-dot';
    if (day.offset === state.dayOffset) dot.classList.add('active');
    if (day.offset === 0) dot.classList.add('today');

    const label = document.createElement('span');
    label.className = 'timeline-label';
    label.textContent = day.weekdayShort;

    wrapper.appendChild(dot);
    wrapper.appendChild(label);
    track.appendChild(wrapper);
  }

  timeline.appendChild(track);
}

// --- Navigation ---

function navigateToDay(offset, direction) {
  if (offset < 0) return;
  if (offset === state.dayOffset) return;

  const dir = direction || (offset > state.dayOffset ? 'left' : 'right');
  const view = document.getElementById('day-view');

  view.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
  view.style.transform = dir === 'left' ? 'translateX(-20%)' : 'translateX(20%)';
  view.style.opacity = '0';

  setTimeout(() => {
    state.dayOffset = offset;
    renderDayView();

    view.style.transition = 'none';
    view.style.transform = dir === 'left' ? 'translateX(20%)' : 'translateX(-20%)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        view.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
        view.style.transform = 'translateX(0)';
        view.style.opacity = '1';
      });
    });
  }, 250);
}

// --- Data Loading ---

async function fetchCalendarData() {
  const icalUrl = getIcalUrl();
  if (!icalUrl) return;

  const proxyBase = getProxyUrl() || DEFAULT_PROXY;
  const url = `${proxyBase}?url=${encodeURIComponent(icalUrl)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    const rangeStart = dateToString(state.today);
    const rangeEnd = dateToString((() => {
      const d = new Date(state.today);
      d.setDate(d.getDate() + 90);
      return d;
    })());

    state.events = parseEvents(text, rangeStart, rangeEnd);
  } catch (err) {
    console.error('Failed to fetch calendar:', err);
    // Keep existing events (from cache via SW) if fetch fails
  }
}

async function loadAndRender() {
  state.loading = true;
  showScreen('loading');

  await fetchCalendarData();

  state.loading = false;
  showScreen('main');
  renderDayView();
}

function showScreen(name) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.add('hidden');
  }
  const target = document.getElementById(`${name}-screen`);
  if (target) target.classList.remove('hidden');
}

// --- Init ---

function checkDateChange() {
  const now = todayMidnight();
  if (now.getTime() !== state.today.getTime()) {
    state.today = now;
    state.dayOffset = 0;
    loadAndRender();
  }
}

export function init() {
  state.today = todayMidnight();

  // Settings (long-press on title)
  initSettings({
    onSave: () => loadAndRender(),
  });

  // Swipe navigation
  initSwipe(document.getElementById('day-container'), {
    onSwipeLeft: () => navigateToDay(state.dayOffset + 1, 'left'),
    onSwipeRight: () => {
      if (state.dayOffset > 0) navigateToDay(state.dayOffset - 1, 'right');
    },
  });

  // Show correct initial screen
  const icalUrl = getIcalUrl();
  if (!icalUrl) {
    showScreen('setup');
  } else {
    loadAndRender();
  }

  // Check for date change every minute
  setInterval(checkDateChange, 60_000);

  // Refresh calendar data every 30 min
  setInterval(() => {
    if (getIcalUrl()) fetchCalendarData().then(renderDayView);
  }, 30 * 60_000);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: Verify the module loads without errors**

Run: `npx serve .`

Open the app — the page should show the loading screen briefly, then the main screen (or setup screen if no URL). There will be errors for missing `swipe.js` and `settings.js` — that's expected and handled in the next tasks.

**Note:** Create stub files first to prevent import errors:

Create `js/swipe.js`:
```js
export function initSwipe(element, callbacks) {
  // Stub — implemented in Task 6
}
```

Create `js/settings.js`:
```js
export function initSettings(options) {
  // Stub — implemented in Task 7
}

export function getIcalUrl() {
  return localStorage.getItem('matti-ical-url');
}

export function getProxyUrl() {
  return localStorage.getItem('matti-proxy-url');
}
```

- [ ] **Step 3: Commit**

```bash
git add js/app.js js/swipe.js js/settings.js
git commit -m "feat: day view rendering with event cards, timeline, and navigation"
```

---

## Task 6: Swipe Navigation

**Files:**
- Modify: `js/swipe.js` (replace stub)

- [ ] **Step 1: Implement swipe.js**

Replace the stub in `js/swipe.js` with:

```js
export function initSwipe(element, { onSwipeLeft, onSwipeRight }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const dy = Math.abs(e.touches[0].clientY - startY);
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy > dx) tracking = false;
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;

    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;

    if (Math.abs(dx) < 50) return;

    if (dx < 0) onSwipeLeft();
    else onSwipeRight();
  }, { passive: true });
}
```

- [ ] **Step 2: Test in browser**

Run `npx serve .`, open on iPad (or iPad simulator / Chrome DevTools touch emulation):
- Swipe left → should attempt to navigate forward (will work once data is loaded)
- Swipe right on day 0 → should do nothing (can't go before today)

- [ ] **Step 3: Commit**

```bash
git add js/swipe.js
git commit -m "feat: touch swipe navigation for day switching"
```

---

## Task 7: Settings Panel

**Files:**
- Modify: `js/settings.js` (replace stub, keep exports)

- [ ] **Step 1: Implement settings.js**

Replace `js/settings.js` with:

```js
const ICAL_KEY = 'matti-ical-url';
const PROXY_KEY = 'matti-proxy-url';

export function getIcalUrl() {
  return localStorage.getItem(ICAL_KEY);
}

export function getProxyUrl() {
  return localStorage.getItem(PROXY_KEY);
}

export function initSettings({ onSave }) {
  const title = document.getElementById('app-title');
  const overlay = document.getElementById('settings-overlay');
  const icalInput = document.getElementById('ical-url-input');
  const proxyInput = document.getElementById('proxy-url-input');
  const saveBtn = document.getElementById('settings-save');
  const closeBtn = document.getElementById('settings-close');

  // Long-press on title to open settings
  let pressTimer = null;

  title.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => openSettings(), 3000);
  }, { passive: true });

  title.addEventListener('touchend', () => clearTimeout(pressTimer));
  title.addEventListener('touchmove', () => clearTimeout(pressTimer));

  // Also support mouse for desktop testing
  title.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => openSettings(), 3000);
  });
  title.addEventListener('mouseup', () => clearTimeout(pressTimer));
  title.addEventListener('mouseleave', () => clearTimeout(pressTimer));

  function openSettings() {
    icalInput.value = getIcalUrl() || '';
    proxyInput.value = getProxyUrl() || '';
    overlay.classList.remove('hidden');
  }

  function closeSettings() {
    overlay.classList.add('hidden');
  }

  saveBtn.addEventListener('click', () => {
    const icalUrl = icalInput.value.trim();
    const proxyUrl = proxyInput.value.trim();

    if (icalUrl) {
      localStorage.setItem(ICAL_KEY, icalUrl);
    } else {
      localStorage.removeItem(ICAL_KEY);
    }

    if (proxyUrl) {
      localStorage.setItem(PROXY_KEY, proxyUrl);
    } else {
      localStorage.removeItem(PROXY_KEY);
    }

    closeSettings();
    onSave();
  });

  closeBtn.addEventListener('click', closeSettings);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });
}
```

- [ ] **Step 2: Test in browser**

1. Open the app — should show setup screen ("En vuxen behöver ställa in kalendern")
2. Long-press (3 seconds) on "Matti" text → settings panel should appear
3. Enter a test iCal URL → tap "Spara" → panel closes
4. Refresh the page → app should skip setup screen and attempt to load data

- [ ] **Step 3: Commit**

```bash
git add js/settings.js
git commit -m "feat: hidden settings panel with long-press access and localStorage"
```

---

## Task 8: Service Worker

**Files:**
- Create: `sw.js`

- [ ] **Step 1: Create sw.js**

```js
const CACHE_NAME = 'matti-v1';
const SHELL_FILES = [
  './',
  'index.html',
  'style.css',
  'js/app.js',
  'js/calendar.js',
  'js/dates.js',
  'js/swipe.js',
  'js/settings.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== 'matti-calendar')
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    // App shell: cache-first
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
  } else {
    // External (CORS proxy for calendar data): network-first
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open('matti-calendar').then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
```

- [ ] **Step 2: Verify Service Worker registration**

Run `npx serve .`, open the app. In DevTools → Application → Service Workers:
- Service Worker should be registered and active
- Under Cache Storage: `matti-v1` should contain the shell files

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat: service worker with cache-first shell and network-first calendar data"
```

---

## Task 9: CORS Proxy

**Files:**
- Create: `proxy/worker.js`

- [ ] **Step 1: Create proxy/worker.js (Cloudflare Worker)**

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const icalUrl = url.searchParams.get('url');
    if (!icalUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    try {
      const response = await fetch(icalUrl);
      const body = await response.text();

      return new Response(body, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err) {
      return new Response(`Fetch error: ${err.message}`, { status: 502 });
    }
  },
};
```

- [ ] **Step 2: Document deployment**

To deploy this Cloudflare Worker:

1. Install wrangler: `npm install -g wrangler`
2. Login: `wrangler login`
3. Create `proxy/wrangler.toml`:
```toml
name = "matti-proxy"
main = "worker.js"
compatibility_date = "2026-06-14"
```
4. Deploy: `cd proxy && wrangler deploy`
5. Note the deployed URL (e.g., `https://matti-proxy.YOUR-SUBDOMAIN.workers.dev`)
6. In Matti settings, enter this URL as the CORS proxy

**Important:** Update `js/app.js` — the `DEFAULT_PROXY` constant works for testing with `allorigins.win`, but for production use the deployed worker URL format:

If using the Cloudflare Worker, the proxy URL format is: `https://matti-proxy.xxx.workers.dev/?url=`

If using allorigins (default), the format is: `https://api.allorigins.win/raw?url=`

Both accept the iCal URL as a query parameter after `url=`.

- [ ] **Step 3: Commit**

```bash
git add proxy/
git commit -m "feat: Cloudflare Worker CORS proxy for Google Calendar iCal"
```

---

## Task 10: Integration Testing & Polish

**Files:**
- Possibly modify: `js/app.js`, `style.css` (minor tweaks)

- [ ] **Step 1: Run all unit tests**

Run: `node --test tests/`

Expected: All tests pass.

- [ ] **Step 2: Test with a real Google Calendar**

1. Create a test Google Calendar or use an existing one
2. Add some all-day events with emoji titles (e.g., "🏫 Skola", "🏊 Simning")
3. Optionally add an image URL in an event's description
4. Make the calendar public: Calendar settings → Access permissions → Make available to public
5. Copy the iCal URL: Calendar settings → Integrate calendar → Public address in iCal format
6. Open Matti in a browser (or iPad), long-press "Matti", enter the iCal URL
7. Save and verify events appear

- [ ] **Step 3: Test checklist (manual)**

Verify each of these in a browser with touch emulation or on an actual iPad:

- [ ] App opens on today's date
- [ ] "IDAG" badge shows for today
- [ ] Weekday name is displayed prominently in Swedish
- [ ] Date shown in small text (e.g., "14 juni")
- [ ] Swipe left goes to tomorrow → "IMORGON" badge appears
- [ ] Swipe left again → "I ÖVERMORGON" badge appears
- [ ] Swipe left a third time → no badge, just weekday name
- [ ] Swipe right from today does nothing (blocked)
- [ ] Timeline dots update on navigation
- [ ] Tapping a timeline dot navigates to that day
- [ ] Today's dot has accent color
- [ ] Active dot is larger
- [ ] Events display with emoji + title
- [ ] Image shows if URL is in description
- [ ] Empty day shows "Ingen aktivitet"
- [ ] Long-press (3s) on "Matti" opens settings
- [ ] Settings saves and loads iCal URL
- [ ] App works in both portrait and landscape
- [ ] "Add to Home Screen" works and shows Matti icon
- [ ] App opens in standalone mode (no Safari UI) from home screen

- [ ] **Step 4: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: polish and integration testing fixes"
```

- [ ] **Step 5: Final commit — create CLAUDE.md**

Create `CLAUDE.md` at project root:

```markdown
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
node --test tests/           # Run all unit tests
node --test tests/dates.test.js   # Run date utility tests only
npx serve .                  # Start local dev server
```

## Key Design Decisions

- Only all-day events are shown (timed events are filtered out)
- No external dependencies — iCal parsing is a custom implementation
- Calendar URL stored in localStorage, accessed via hidden settings (3s long-press on title)
- Default CORS proxy: allorigins.win. Production: deploy proxy/worker.js to Cloudflare Workers
- "Today" resets at midnight via a 60-second interval check
- Swipe navigation is forward-only from today (no past days)
```

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project architecture and commands"
```

---

## Task 11: GitHub Pages Deployment

- [ ] **Step 1: Create a GitHub repository**

```bash
gh repo create matti-viz --public --source=. --push
```

If `gh` is not installed, create the repo manually on github.com, then:
```bash
git remote add origin git@github.com:YOUR_USERNAME/matti-viz.git
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

```bash
gh api repos/{owner}/{repo}/pages -X POST -f "build_type=workflow" 2>/dev/null || true
```

Or manually: GitHub repo → Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / `/ (root)` → Save.

- [ ] **Step 3: Create GitHub Actions workflow for Pages**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deployment workflow"
git push
```

- [ ] **Step 4: Verify deployment**

Wait ~1 minute, then open: `https://YOUR_USERNAME.github.io/matti-viz/`

Verify:
- App loads with warm beige background
- PWA manifest is detected
- "Add to Home Screen" works on iPad when visiting this URL in Safari
