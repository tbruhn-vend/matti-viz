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
