const ICAL_KEY = 'matti-ical-url';

export function getIcalUrl() {
  return localStorage.getItem(ICAL_KEY);
}

export function initSettings({ onSave }) {
  const title = document.getElementById('app-title');
  const overlay = document.getElementById('settings-overlay');
  const icalInput = document.getElementById('ical-url-input');
  const saveBtn = document.getElementById('settings-save');
  const closeBtn = document.getElementById('settings-close');

  let pressTimer = null;

  title.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => openSettings(), 3000);
  }, { passive: true });

  title.addEventListener('touchend', () => clearTimeout(pressTimer));
  title.addEventListener('touchmove', () => clearTimeout(pressTimer));

  title.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => openSettings(), 3000);
  });
  title.addEventListener('mouseup', () => clearTimeout(pressTimer));
  title.addEventListener('mouseleave', () => clearTimeout(pressTimer));

  const setupBtn = document.getElementById('setup-settings-btn');
  if (setupBtn) {
    setupBtn.addEventListener('click', openSettings);
  }

  function openSettings() {
    icalInput.value = getIcalUrl() || '';
    overlay.classList.remove('hidden');
  }

  function closeSettings() {
    overlay.classList.add('hidden');
  }

  saveBtn.addEventListener('click', () => {
    const icalUrl = icalInput.value.trim();

    if (icalUrl) {
      localStorage.setItem(ICAL_KEY, icalUrl);
    } else {
      localStorage.removeItem(ICAL_KEY);
    }

    closeSettings();
    onSave();
  });

  closeBtn.addEventListener('click', closeSettings);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });
}
