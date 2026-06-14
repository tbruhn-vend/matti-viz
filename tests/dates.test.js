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
  const today = new Date(2026, 5, 14);

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
    assert.equal(getWeekdayName(new Date(2026, 5, 14)), 'SÖNDAG');
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
    const today = new Date(2026, 5, 15);
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
