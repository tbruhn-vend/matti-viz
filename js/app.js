import { extractEmoji, extractImageUrl, getRelativeLabel, getWeekdayName, formatDate, dateToString, getTimelineDays } from './dates.js';
import { parseEvents, getEventsForDate } from './calendar.js';
import { initSwipe } from './swipe.js';
import { initSettings, getIcalUrl } from './settings.js';

const DEFAULT_PROXY = 'https://matti-proxy.tomasbruhn.workers.dev';

const state = {
  today: null,
  dayOffset: 0,
  events: [],
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

  const t = Math.min(state.dayOffset / 6, 1);
  document.body.style.background = `hsl(${40 + t * 5}, ${30 - t * 20}%, ${93 + t * 4}%)`;

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
    if (day.offset === 0) label.classList.add('today-label');
    label.textContent = day.offset === 0 ? 'IDAG' : day.weekdayShort;

    wrapper.appendChild(dot);
    wrapper.appendChild(label);
    track.appendChild(wrapper);
  }

  timeline.appendChild(track);
}

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

async function fetchCalendarData() {
  const icalUrl = getIcalUrl();
  if (!icalUrl) return;

  const url = `${DEFAULT_PROXY}?url=${encodeURIComponent(icalUrl)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
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

  initSettings({
    onSave: () => loadAndRender(),
  });

  initSwipe(document.getElementById('day-container'), {
    onSwipeLeft: () => navigateToDay(state.dayOffset + 1, 'left'),
    onSwipeRight: () => {
      if (state.dayOffset > 0) navigateToDay(state.dayOffset - 1, 'right');
    },
  });

  const icalUrl = getIcalUrl();
  if (!icalUrl) {
    showScreen('setup');
  } else {
    loadAndRender();
  }

  setInterval(checkDateChange, 60_000);

  setInterval(() => {
    if (getIcalUrl()) fetchCalendarData().then(renderDayView);
  }, 30 * 60_000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}

document.addEventListener('DOMContentLoaded', init);
