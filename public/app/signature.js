// Finger / mouse / stylus signature pad (no external libraries).
export function createSignaturePad(canvas, { onChange } = {}) {
  const ctx = canvas.getContext('2d');
  let strokes = [];      // [[{x,y}, ...], ...] in CSS pixels
  let current = null;
  let restoredImage = null; // image restored from a saved draft

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function style() {
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1220';
  }

  function drawStroke(pts) {
    if (!pts.length) return;
    style();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  function redraw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (restoredImage) ctx.drawImage(restoredImage, 0, 0, rect.width, rect.height);
    strokes.forEach(drawStroke);
  }

  function point(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    current = [point(e)];
    strokes.push(current);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    events.forEach((ev) => current.push(point(ev)));
    redraw();
  });
  const end = () => {
    if (!current) return;
    current = null;
    onChange && onChange();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function inkLength() {
    let len = 0;
    for (const s of strokes) {
      for (let i = 1; i < s.length; i++) len += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    }
    return len;
  }

  window.addEventListener('resize', resize);
  requestAnimationFrame(resize);

  return {
    resize,
    clear() {
      strokes = [];
      restoredImage = null;
      redraw();
      onChange && onChange();
    },
    // A few dots are not a signature - require some real ink.
    isEmpty() {
      return !restoredImage && inkLength() < 40;
    },
    toDataURL() {
      return canvas.toDataURL('image/png');
    },
    fromDataURL(url) {
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        restoredImage = img;
        strokes = [];
        redraw();
      };
      img.src = url;
    },
  };
}
