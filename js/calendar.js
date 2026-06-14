const BYDAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unfoldLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n /g, '').replace(/\n\t/g, '');
}

function parseDate(val) {
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
    const multiProps = {};
    for (const line of match[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx);
      const val = line.slice(colonIdx + 1);
      const baseName = key.split(';')[0];
      props[baseName] = val;
      props[key] = val;
      if (!multiProps[baseName]) multiProps[baseName] = [];
      multiProps[baseName].push(val);
    }
    props._multi = multiProps;
    blocks.push(props);
  }
  return blocks;
}

function getExdates(props) {
  const dates = new Set();
  const vals = props._multi?.EXDATE || [];
  for (const val of vals) {
    dates.add(parseDate(val.replace(/T.*/, '')));
  }
  return dates;
}

function getRecurrenceId(props) {
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('RECURRENCE-ID')) return parseDate(v.replace(/T.*/, ''));
  }
  return null;
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
  const overrides = new Map();

  for (const props of vevents) {
    if (!isAllDay(props)) continue;
    const recId = getRecurrenceId(props);
    if (recId) {
      const uid = props['UID'] || '';
      overrides.set(`${uid}:${recId}`, props);
    }
  }

  for (const props of vevents) {
    if (!isAllDay(props)) continue;
    if (getRecurrenceId(props)) continue;

    const rawStart = getDtstart(props);
    if (!rawStart) continue;
    const startDate = parseDate(rawStart);
    const title = unescapeIcal(props['SUMMARY'] || '');
    const description = unescapeIcal(props['DESCRIPTION'] || '');
    const rrule = props['RRULE'];
    const uid = props['UID'] || '';

    if (rrule) {
      const exdates = getExdates(props);
      const dates = expandRRule(startDate, rrule, rangeStart, rangeEnd);
      for (const date of dates) {
        if (exdates.has(date)) continue;
        const override = overrides.get(`${uid}:${date}`);
        if (override) {
          const oTitle = unescapeIcal(override['SUMMARY'] || title);
          const oDesc = unescapeIcal(override['DESCRIPTION'] || description);
          events.push({ date, title: oTitle, description: oDesc });
        } else {
          events.push({ date, title, description });
        }
      }
    } else {
      const rawEnd = getDtend(props);
      const endDate = rawEnd ? parseDate(rawEnd) : addDays(startDate, 1);
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
