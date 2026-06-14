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
