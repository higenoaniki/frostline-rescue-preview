const UI_SELECTOR = 'button, input, select, textarea, a, [role="menu"], .modal, .title-screen, .top-hud, .quest-panel, .shipping-panel, .event-panel, .bottom-hud, #investmentPanel, #defensePanel';

export function bindFloatingStick(surface, input, joystick, stick, canMove) {
  let origin = null, capture = null;
  const reset = () => {
    if (capture?.hasPointerCapture(input.pointerId)) capture.releasePointerCapture(input.pointerId);
    input.pointerId = null; input.joyX = input.joyY = 0; origin = capture = null;
    joystick.classList.remove('active'); stick.style.transform = 'translate(0, 0)';
  };
  surface.addEventListener('pointerdown', (event) => {
    if (!canMove() || input.pointerId !== null || event.button !== 0 || event.isPrimary === false || event.target.closest(UI_SELECTOR)) return;
    event.preventDefault(); input.pointerId = event.pointerId; origin = { x: event.clientX, y: event.clientY };
    capture = event.target; capture.setPointerCapture(event.pointerId);
    joystick.style.left = `${origin.x}px`; joystick.style.top = `${origin.y}px`; joystick.classList.add('active');
    stick.style.transform = 'translate(0, 0)'; input.joyX = input.joyY = 0;
  });
  surface.addEventListener('pointermove', (event) => {
    if (input.pointerId !== event.pointerId || !origin) return;
    if (!canMove()) { reset(); return; }
    event.preventDefault();
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y, distance = Math.hypot(dx, dy);
    const scale = Math.min(1, 42 / (distance || 1));
    input.joyX = distance < 6 ? 0 : dx * scale / 42; input.joyY = distance < 6 ? 0 : dy * scale / 42;
    stick.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, (event) => { if (event.pointerId === input.pointerId) reset(); });
  window.addEventListener('blur', () => { reset(); input.keys.clear(); });
  return reset;
}
