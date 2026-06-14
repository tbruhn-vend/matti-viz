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
