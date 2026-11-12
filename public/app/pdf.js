// Printable PDF of a submitted application (used by customer + admin).
import { summarySections, formatDate, statusLabel, STEPS } from './schema.js';

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js';
const CONSENT_TEXT = STEPS.flatMap((s) => s.fields).find((f) => f.type === 'consent').text;

function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSPDF_URL;
    s.crossOrigin = 'anonymous';
    s.onload = () => (window.jspdf ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF failed to load')));
    s.onerror = () => reject(new Error('jsPDF failed to load'));
    document.head.appendChild(s);
  });
}

// Converts any image (webp, png, jpg, data URL) to a small JPEG that jsPDF can
// embed, painted onto `background` because JPEG has no transparency.
function imageToJpeg(url, maxW, background) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ data: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// The built-in PDF fonts only cover Western characters.
const clean = (s) => String(s ?? '')
  .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/\u2026/g, '...').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '?');

export async function buildApplicationPdf(app) {
  const JsPDF = await loadJsPdf();
  const s = app.settings || {};
  const doc = new JsPDF({ unit: 'pt', format: 'letter', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;               // page margin
  const labelW = 190;         // width of the question column
  const GOLD = [217, 119, 6];
  let y = 0;

  const businessName = clean(s.business_name || 'Mobile View Properties');
  const logo = await imageToJpeg(s.logo_url || '/public/images/logo.webp', 420, '#0a0a0a');
  const signature = await imageToJpeg(app.signature_png, 900, '#ffffff');

  function header() {
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, W, 78, 'F');
    let x = M;
    if (logo) {
      const h = 44;
      const w = Math.min(140, (logo.w / logo.h) * h);
      const lh = (w * logo.h) / logo.w;
      doc.addImage(logo.data, 'JPEG', M, 39 - lh / 2, w, lh, 'logo');
      x = M + w + 14;
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(businessName.toUpperCase(), x, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 200, 200);
    const contact = [s.phone_main, s.email, s.website_url].filter(Boolean).map(clean).join('   |   ');
    if (contact) doc.text(contact, x, 52);
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(clean(app.reference), W - M, 36, { align: 'right' });
    y = 104;
  }

  function ensure(space) {
    if (y + space > H - 56) {
      doc.addPage();
      header();
    }
  }

  header();
  doc.setTextColor(17, 17, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MOBILE HOME PURCHASE & BUILDING PREFERENCE APPLICATION', M, y, { maxWidth: W - 2 * M });
  y += 24;

  const when = app.submitted_at ? new Date(app.submitted_at) : null;
  const meta = [
    ['Application reference', app.reference],
    ['Submitted', when ? when.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''],
  ];
  if (app.status) meta.push(['Status', statusLabel(app.status)]);
  doc.setFontSize(9.5);
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 90); doc.text(clean(k), M, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(17, 17, 17); doc.text(clean(v), M + 130, y);
    y += 15;
  }
  y += 8;

  // Answers, section by section
  const sections = summarySections(app.answers || {}, app.fileNames || {});
  for (const sec of sections) {
    ensure(46);
    doc.setFillColor(...GOLD);
    doc.rect(M, y - 10, 3, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 17, 17);
    doc.text(clean(sec.title).toUpperCase(), M + 10, y + 1);
    y += 14;
    doc.setFontSize(9.5);
    for (const [label, value] of sec.rows) {
      const lLines = doc.splitTextToSize(clean(label), labelW - 10);
      const vLines = doc.splitTextToSize(clean(value), W - 2 * M - labelW);
      const rowH = Math.max(lLines.length, vLines.length) * 12 + 8;
      ensure(rowH);
      doc.setDrawColor(230, 230, 230);
      doc.line(M, y, W - M, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(lLines, M, y + 13);
      doc.setTextColor(17, 17, 17);
      doc.text(vLines, M + labelW, y + 13);
      y += rowH;
    }
    y += 14;
  }

  // Declaration & signature
  ensure(230);
  doc.setFillColor(...GOLD);
  doc.rect(M, y - 10, 3, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DECLARATION & SIGNATURE', M + 10, y + 1);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const cLines = doc.splitTextToSize('[X] ' + clean(CONSENT_TEXT), W - 2 * M);
  doc.text(cLines, M, y);
  y += cLines.length * 11 + 12;
  doc.setDrawColor(200, 200, 200);
  doc.rect(M, y, 260, 90);
  if (signature) {
    // Keep the signature's shape (phones and desktops produce different widths).
    const scale = Math.min(252 / signature.w, 82 / signature.h);
    const sw = signature.w * scale;
    const sh = signature.h * scale;
    doc.addImage(signature.data, 'JPEG', M + 4 + (252 - sw) / 2, y + 4 + (82 - sh) / 2, sw, sh, 'signature');
  }
  doc.setTextColor(17, 17, 17);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold'); doc.text('Signed by', M + 290, y + 20);
  doc.setFont('helvetica', 'normal'); doc.text(clean(app.signature_name), M + 290, y + 34);
  doc.setFont('helvetica', 'bold'); doc.text('Date of signature', M + 290, y + 58);
  doc.setFont('helvetica', 'normal'); doc.text(clean(formatDate(app.signature_date)), M + 290, y + 72);
  y += 110;

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text('This application is not a purchase contract or financing approval. All prices, payment plans and financing are subject to review and a separate written agreement.',
      M, H - 30, { maxWidth: W - 2 * M - 70 });
    doc.text(`Page ${i} of ${pages}`, W - M, H - 30, { align: 'right' });
  }
  doc.setProperties({ title: `Application ${clean(app.reference)}`, author: businessName });
  return doc;
}
