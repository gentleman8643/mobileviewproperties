// Mobile View Properties - customer application form
import {
  STEPS, FILE_RULES, optValue, optDesc, isVisible, validateStep, cleanAnswers,
  summarySections, todayISO,
} from './schema.js';
import { getSupabase, getBusinessSettings, escapeHtml as esc, digitsOnly, telegramLink } from './supabase.js';
import { createSignaturePad } from './signature.js';

const DRAFT_KEY = 'mvp_application_draft_v1';
const LAST_KEY = 'mvp_application_last_v1';
const BUCKET = 'application-files';

const app = document.getElementById('app');
const state = {
  step: 0,
  maxStep: 0,
  data: {},
  files: {},          // fieldId -> [{ key, file, name, size, type, path }]
  clientId: null,
  startedAt: Date.now(),
  submitting: false,
  restored: false,
  settings: {},
};
let sigPad = null;
let saveTimer = null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------
// Draft persistence (survives refreshes and network problems)
// ---------------------------------------------------------------------
function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        v: 1, step: state.step, maxStep: state.maxStep, data: state.data,
        clientId: state.clientId, startedAt: state.startedAt, savedAt: Date.now(),
      }));
    } catch { /* storage full or private mode - the form still works */ }
  }, 250);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    // Drafts older than 30 days are discarded.
    if (!d || d.v !== 1 || !d.data || Date.now() - (d.savedAt || 0) > 30 * 864e5) return false;
    state.data = d.data;
    state.step = Math.min(Math.max(d.step | 0, 0), STEPS.length - 1);
    state.maxStep = Math.min(Math.max(d.maxStep | 0, state.step), STEPS.length - 1);
    state.clientId = d.clientId || null;
    state.startedAt = d.startedAt || Date.now();
    // Files cannot be stored on the device - they must be re-attached.
    for (const step of STEPS) for (const f of step.fields) if (f.type === 'files') delete state.data[f.id];
    return Object.keys(state.data).length > 0;
  } catch {
    return false;
  }
}

function clearDraft() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function applyDefaults() {
  for (const step of STEPS) {
    for (const f of step.fields) {
      if (f.default !== undefined && state.data[f.id] === undefined) state.data[f.id] = f.default;
      if (f.today) state.data[f.id] = todayISO();
    }
  }
  if (!state.clientId) state.clientId = uuid();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------
const ICON_INFO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
const ICON_LOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function labelHtml(f, forInput = true) {
  const mark = f.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(optional)</span>';
  const tag = forInput ? `label for="f_${f.id}"` : 'div';
  const close = forInput ? 'label' : 'div';
  return `<${tag} class="field-label" id="l_${f.id}">${esc(f.label)}${mark}</${close}>` +
    (f.help ? `<p class="field-help" id="h_${f.id}">${esc(f.help)}</p>` : '');
}

function choiceHtml(f, multi) {
  const value = state.data[f.id];
  const kind = f.type === 'pills' ? 'pills' + (f.wide ? ' wide' : '')
    : f.type === 'yesno' ? 'yesno pills' : multi ? 'multi' : f.compact ? 'compact' : '';
  const options = f.type === 'yesno' ? ['Yes', 'No'] : f.options;
  const role = multi ? 'checkbox' : 'radio';
  const btns = options.map((o) => {
    const v = optValue(o);
    const on = multi ? Array.isArray(value) && value.includes(v) : value === v;
    const desc = optDesc(o);
    return `<button type="button" class="choice${multi ? ' is-multi' : ''}" role="${role}" aria-checked="${on}"
      data-field="${f.id}" data-value="${esc(v)}"><span class="choice-mark" aria-hidden="true"></span>
      <span class="choice-text"><span>${esc(v)}</span>${desc ? `<span class="choice-desc">${esc(desc)}</span>` : ''}</span></button>`;
  }).join('');
  return labelHtml(f, false) +
    `<div class="choice-grid ${kind}" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="l_${f.id}">${btns}</div>`;
}

function inputHtml(f) {
  const v = state.data[f.id] ?? '';
  const describedBy = `e_${f.id}${f.help ? ` h_${f.id}` : ''}`;
  const common = `id="f_${f.id}" name="${f.id}" data-input="${f.id}" aria-describedby="${describedBy}"` +
    (f.required ? ' aria-required="true"' : '') + (f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '');
  if (f.type === 'select') {
    const opts = f.options.map((o) => `<option value="${esc(optValue(o))}"${optValue(o) === v ? ' selected' : ''}>${esc(optValue(o))}</option>`).join('');
    return labelHtml(f) + `<select class="input" ${common}><option value="">Select…</option>${opts}</select>`;
  }
  if (f.type === 'textarea') {
    return labelHtml(f) + `<textarea class="input" ${common} maxlength="3000" rows="4">${esc(v)}</textarea>`;
  }
  if (f.type === 'money') {
    return labelHtml(f) + `<div class="input-money"><input class="input" type="number" inputmode="decimal" min="0" step="any" ${common} value="${esc(v)}"></div>`;
  }
  const type = { text: 'text', email: 'email', tel: 'tel', number: 'number', date: 'date' }[f.type] || 'text';
  const extra = [
    f.autocomplete ? `autocomplete="${f.autocomplete}"` : '',
    type === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : '',
    type === 'tel' ? 'inputmode="tel"' : '',
    type === 'number' ? `inputmode="decimal" min="${f.min ?? 0}" step="${f.step || 'any'}"` : '',
    type === 'date' && f.minToday ? `min="${todayISO()}"` : '',
    f.readonly ? 'readonly' : '',
    `maxlength="${f.maxlength || 300}"`,
  ].filter(Boolean).join(' ');
  return labelHtml(f) + `<input class="input" type="${type}" ${common} ${extra} value="${esc(v)}">`;
}

function filesHtml(f) {
  const accept = (f.accept === 'images' ? FILE_RULES.images : FILE_RULES.documents).join(',') +
    (f.accept === 'images' ? ',.heic,.heif' : ',.heic,.heif,.pdf');
  return labelHtml(f, false) +
    `<label class="file-drop" data-drop="${f.id}">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
      <span><strong>Tap to choose ${f.accept === 'images' ? 'photos' : 'files'}</strong> or drag them here</span>
      <input type="file" class="sr-only" data-files="${f.id}" multiple accept="${accept}" aria-labelledby="l_${f.id}">
    </label>
    <ul class="file-list" id="fl_${f.id}"></ul>`;
}

function fileListHtml(fieldId) {
  return (state.files[fieldId] || []).map((it) => {
    const isImg = it.type.startsWith('image/') && !/hei[cf]/.test(it.type);
    const thumb = isImg ? `<img class="file-thumb" src="${it.preview}" alt="">`
      : `<span class="file-thumb">${esc((it.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4))}</span>`;
    return `<li class="file-item">${thumb}<span class="file-name">${esc(it.name)}</span>
      <span class="file-size">${(it.size / 1048576).toFixed(1)} MB</span>
      <button type="button" class="file-remove" data-remove-file="${fieldId}" data-key="${it.key}" aria-label="Remove ${esc(it.name)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></li>`;
  }).join('');
}

function signatureHtml(f) {
  return labelHtml(f, false) +
    `<p class="field-help">Draw your signature in the box using your finger, stylus or mouse.</p>
    <div class="sig-wrap"><canvas class="sig-canvas" id="sigCanvas" aria-label="Signature drawing area" role="img"></canvas>
      <div class="sig-line"></div><div class="sig-hint">Sign above the line</div></div>
    <div class="sig-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-action="sig-clear">Clear signature</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="sig-redraw">Redraw signature</button>
    </div>`;
}

function consentHtml(f) {
  return `<label class="consent" for="f_${f.id}"><input type="checkbox" id="f_${f.id}" data-consent="${f.id}"
    ${state.data[f.id] === true ? 'checked' : ''} aria-describedby="e_${f.id}">
    <span>${esc(f.text)} <span class="req" aria-hidden="true">*</span></span></label>`;
}

function reviewHtml() {
  const names = {};
  for (const [k, list] of Object.entries(state.files)) names[k] = list.map((x) => x.name);
  const sections = summarySections(state.data, names);
  const body = sections.map((s) => {
    const idx = STEPS.findIndex((st) => st.title === s.title);
    return `<div class="summary-section"><h4>${esc(s.title)}
      <button type="button" data-goto="${idx}">Edit</button></h4><dl>${s.rows.map(([k, v]) =>
      `<div class="summary-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`;
  }).join('');
  return `<details class="review"><summary>Review your answers before signing</summary><div class="review-body">${body}</div></details>`;
}

function fieldHtml(f) {
  if (f.type === 'note') {
    return `<div class="note ${f.tone || ''}" data-wrap="${f.id}">${f.tone === 'secure' ? ICON_LOCK : ICON_INFO}<span>${esc(f.text)}</span></div>`;
  }
  let inner;
  if (['cards', 'pills', 'yesno'].includes(f.type)) inner = choiceHtml(f, false);
  else if (f.type === 'multi') inner = choiceHtml(f, true);
  else if (f.type === 'files') inner = filesHtml(f);
  else if (f.type === 'signature') inner = signatureHtml(f);
  else if (f.type === 'consent') inner = consentHtml(f);
  else if (f.type === 'review') inner = reviewHtml();
  else inner = inputHtml(f);
  return `<div class="field${f.half ? ' half' : ''}" data-wrap="${f.id}">${inner}
    <p class="field-error" id="e_${f.id}" role="alert"></p></div>`;
}

function progressHtml() {
  const pct = Math.round(((state.step + 1) / STEPS.length) * 100);
  const dots = STEPS.map((s, i) => `<button type="button" class="progress-dot${i === state.step ? ' active' : i <= state.maxStep ? ' done' : ''}"
    data-goto="${i}" ${i > state.maxStep ? 'disabled' : ''} aria-label="Step ${i + 1}: ${esc(s.title)}"
    ${i === state.step ? 'aria-current="step"' : ''}>${i + 1}</button>`).join('');
  return `<div class="progress"><div class="progress-top">
      <span class="progress-step">Step ${state.step + 1} of ${STEPS.length}</span>
      <span class="progress-name">${esc(STEPS[state.step].title)}</span></div>
    <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"
      aria-label="Application progress"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-dots">${dots}</div></div>`;
}

function renderStep() {
  const step = STEPS[state.step];
  const last = state.step === STEPS.length - 1;
  const banner = state.restored
    ? `<div class="alert alert-ok draft-banner"><span>We restored the answers you saved on this device.${
      Object.values(state.files).length ? '' : ' Any attached files need to be added again.'}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-action="start-over">Start over</button></div>` : '';
  app.innerHTML = `${banner}${progressHtml()}
    <form class="card" id="appForm" novalidate>
      <h2 class="step-title" tabindex="-1" id="stepTitle">${esc(step.title)}</h2>
      <p class="step-intro">${esc(step.intro)}</p>
      <p class="req-legend">Questions marked <b>*</b> are required.</p>
      <div class="hp-field" aria-hidden="true"><label>Company website<input type="text" id="hpField" name="company_website" tabindex="-1" autocomplete="off"></label></div>
      <div class="fields">${step.fields.map(fieldHtml).join('')}</div>
      <div id="submitError"></div>
      <div class="nav-buttons">
        ${state.step > 0 ? '<button type="button" class="btn btn-ghost" data-action="back">&larr; Back</button>' : ''}
        <button type="submit" class="btn btn-primary" id="nextBtn">${last ? 'Submit Application' : 'Continue &rarr;'}</button>
      </div>
    </form>`;
  // The long introduction is only shown on the first step to save space on phones.
  document.querySelector('.app-intro').hidden = state.step > 0;
  for (const f of step.fields) if (f.type === 'files') renderFileList(f.id);
  applyVisibility();
  if (step.fields.some((f) => f.type === 'signature')) setupSignature();
}

function applyVisibility() {
  for (const f of STEPS[state.step].fields) {
    const el = app.querySelector(`[data-wrap="${f.id}"]`);
    if (el) el.hidden = !isVisible(f, state.data);
  }
}

function renderFileList(fieldId) {
  const ul = document.getElementById('fl_' + fieldId);
  if (ul) ul.innerHTML = fileListHtml(fieldId);
}

function setupSignature() {
  const canvas = document.getElementById('sigCanvas');
  sigPad = createSignaturePad(canvas, {
    onChange() {
      state.data.signature = sigPad.isEmpty() ? '' : sigPad.toDataURL();
      if (state.data.signature) clearError('signature');
      saveDraft();
    },
  });
  if (state.data.signature) sigPad.fromDataURL(state.data.signature);
  if (!state.data.signature_name && state.data.full_name) {
    state.data.signature_name = state.data.full_name;
    const inp = document.getElementById('f_signature_name');
    if (inp) inp.value = state.data.full_name;
  }
}

function setError(id, msg) {
  const wrap = app.querySelector(`[data-wrap="${id}"]`);
  const el = document.getElementById('e_' + id);
  if (!wrap || !el) return;
  wrap.classList.toggle('invalid', !!msg);
  el.textContent = msg || '';
  const input = document.getElementById('f_' + id);
  if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}
const clearError = (id) => setError(id, '');

function showErrors(errors) {
  for (const f of STEPS[state.step].fields) setError(f.id, errors[f.id] || '');
  const first = STEPS[state.step].fields.find((f) => errors[f.id]);
  if (!first) return;
  const wrap = app.querySelector(`[data-wrap="${first.id}"]`);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = wrap.querySelector('input:not([type="file"]):not(.sr-only), select, textarea, button.choice, canvas');
  if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 300);
}

let navDepth = 0; // how many steps we pushed onto the browser history

function goTo(index, { push = true } = {}) {
  state.step = Math.min(Math.max(index, 0), STEPS.length - 1);
  state.maxStep = Math.max(state.maxStep, state.step);
  state.restored = false; // the "we restored your answers" banner only shows once
  if (push) {
    navDepth++;
    history.pushState({ mvpStep: state.step }, '', location.pathname + location.search);
  }
  renderStep();
  saveDraft();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const title = document.getElementById('stepTitle');
  if (title) title.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------
// Events (attached once, delegated)
// ---------------------------------------------------------------------
function onChoice(btn) {
  const f = STEPS[state.step].fields.find((x) => x.id === btn.dataset.field);
  if (!f) return;
  const v = btn.dataset.value;
  const grid = btn.closest('.choice-grid');
  if (f.type === 'multi') {
    const cur = Array.isArray(state.data[f.id]) ? [...state.data[f.id]] : [];
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1); else cur.push(v);
    state.data[f.id] = cur;
    btn.setAttribute('aria-checked', String(i < 0));
  } else {
    // Optional single choices can be un-selected by tapping again.
    const unselect = !f.required && state.data[f.id] === v;
    state.data[f.id] = unselect ? '' : v;
    grid.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-checked', String(!unselect && b === btn)));
  }
  clearError(f.id);
  applyVisibility();
  saveDraft();
}

app.addEventListener('click', (e) => {
  const choice = e.target.closest('.choice');
  if (choice) return onChoice(choice);
  const go = e.target.closest('[data-goto]');
  if (go && !go.disabled) return goTo(Number(go.dataset.goto));
  const rm = e.target.closest('[data-remove-file]');
  if (rm) {
    const id = rm.dataset.removeFile;
    state.files[id] = (state.files[id] || []).filter((x) => x.key !== rm.dataset.key);
    state.data[id] = state.files[id].map((x) => x.name);
    renderFileList(id);
    return saveDraft();
  }
  const act = e.target.closest('[data-action]');
  if (!act) return;
  const a = act.dataset.action;
  if (a === 'back') goBack();
  else if (a === 'start-over') startOver();
  else if (a === 'sig-clear' || a === 'sig-redraw') {
    sigPad && sigPad.clear();
    if (a === 'sig-redraw') {
      document.getElementById('sigCanvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Draw your new signature in the box');
    }
  } else if (a === 'download-pdf') downloadPdf(act);
  else if (a === 'new-application') { sessionStorage.removeItem(LAST_KEY); location.reload(); }
});

function onInput(e) {
  const el = e.target;
  if (el.dataset.input) {
    state.data[el.dataset.input] = el.value;
    clearError(el.dataset.input);
    if (el.tagName === 'SELECT') applyVisibility();
    saveDraft();
  } else if (el.dataset.consent) {
    state.data[el.dataset.consent] = el.checked;
    clearError(el.dataset.consent);
    saveDraft();
  } else if (el.dataset.files && e.type === 'change') {
    addFiles(el.dataset.files, el.files);
    el.value = '';
  }
}
app.addEventListener('input', onInput);
app.addEventListener('change', onInput);

// Phone / browser back button moves between steps instead of leaving the page.
window.addEventListener('popstate', (e) => {
  if (state.done) return;
  if (e.state && typeof e.state.mvpStep === 'number') {
    navDepth = Math.max(0, navDepth - 1);
    goTo(e.state.mvpStep, { push: false });
  }
});
function goBack() {
  if (navDepth > 0) history.back();
  else {
    goTo(state.step - 1, { push: false });
    history.replaceState({ mvpStep: state.step }, '');
  }
}

function sniffType(file) {
  if (file.type) return file.type.toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return { heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', pdf: 'application/pdf' }[ext] || '';
}

function addFiles(fieldId, fileList) {
  const f = STEPS[state.step].fields.find((x) => x.id === fieldId);
  const allowed = f.accept === 'images' ? FILE_RULES.images : FILE_RULES.documents;
  const list = state.files[fieldId] || (state.files[fieldId] = []);
  const problems = [];
  for (const file of Array.from(fileList || [])) {
    const type = sniffType(file);
    if (list.length >= FILE_RULES.maxFilesPerField) { problems.push(`You can attach up to ${FILE_RULES.maxFilesPerField} files here.`); break; }
    if (!allowed.includes(type)) { problems.push(`"${file.name}" is not a supported file type.`); continue; }
    if (file.size > FILE_RULES.maxBytes) { problems.push(`"${file.name}" is larger than 10 MB.`); continue; }
    if (file.size === 0) { problems.push(`"${file.name}" is empty.`); continue; }
    list.push({ key: uuid(), file, name: file.name.slice(0, 200), size: file.size, type,
      preview: type.startsWith('image/') ? URL.createObjectURL(file) : '', path: null });
  }
  state.data[fieldId] = list.map((x) => x.name);
  renderFileList(fieldId);
  setError(fieldId, problems.join(' '));
  saveDraft();
}

app.addEventListener('dragover', (e) => {
  const drop = e.target.closest('[data-drop]');
  if (drop) { e.preventDefault(); drop.classList.add('drag'); }
});
app.addEventListener('dragleave', (e) => {
  const drop = e.target.closest('[data-drop]');
  if (drop) drop.classList.remove('drag');
});
app.addEventListener('drop', (e) => {
  const drop = e.target.closest('[data-drop]');
  if (!drop) return;
  e.preventDefault();
  drop.classList.remove('drag');
  addFiles(drop.dataset.drop, e.dataTransfer.files);
});

// ---------------------------------------------------------------------
// Continue / Submit
// ---------------------------------------------------------------------
app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.submitting) return;
  // Pick up the very latest signature before validating.
  if (sigPad && STEPS[state.step].fields.some((f) => f.type === 'signature')) {
    state.data.signature = sigPad.isEmpty() ? '' : sigPad.toDataURL();
  }
  const errors = validateStep(STEPS[state.step], state.data);
  if (Object.keys(errors).length) {
    showErrors(errors);
    toast('Please complete the highlighted questions');
    return;
  }
  if (state.step < STEPS.length - 1) return goTo(state.step + 1);
  // Last step: make sure nothing earlier became incomplete (answers can be edited).
  for (let i = 0; i < STEPS.length; i++) {
    const errs = validateStep(STEPS[i], state.data);
    if (Object.keys(errs).length) {
      goTo(i);
      showErrors(errs);
      toast('Please complete the highlighted questions');
      return;
    }
  }
  submitApplication();
});

const isNetworkError = (err) => !navigator.onLine || err instanceof TypeError ||
  /fetch|network|timeout|load failed/i.test(String(err && (err.message || err)));

function friendlyError(err) {
  if (isNetworkError(err)) {
    return 'We could not reach our server. Please check your internet connection and press “Submit Application” again. Your answers are saved on this device, so nothing is lost.';
  }
  const msg = (err && err.message) || '';
  if (/rejected|required|valid|too|already|verified|missing|signature|consent/i.test(msg)) return msg;
  return 'Something went wrong while sending your application. Please try again in a moment. Your answers are saved on this device.';
}

function setSubmitting(on) {
  state.submitting = on;
  const btn = document.getElementById('nextBtn');
  if (!btn) return;
  btn.disabled = on;
  btn.innerHTML = on ? '<span class="spinner-sm" aria-hidden="true"></span> Submitting…' : 'Submit Application';
  app.querySelectorAll('[data-action="back"]').forEach((b) => (b.disabled = on));
}

function safeFileName(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : '';
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${base}${ext ? '.' + ext : ''}`;
}

async function uploadFiles(sb, answers) {
  const out = [];
  const visibleFileFields = STEPS.flatMap((s) => s.fields).filter((f) => f.type === 'files' && isVisible(f, state.data));
  const items = visibleFileFields.flatMap((f) => (state.files[f.id] || []).map((it) => ({ f, it })));
  let done = 0;
  for (const { f, it } of items) {
    // The path is fixed before uploading so a retry never creates a duplicate copy.
    if (!it.path) it.path = `incoming/${state.clientId}/${safeFileName(it.name)}`;
    if (!it.uploaded) {
      const btn = document.getElementById('nextBtn');
      if (btn) btn.innerHTML = `<span class="spinner-sm" aria-hidden="true"></span> Uploading file ${done + 1} of ${items.length}…`;
      const { error } = await sb.storage.from(BUCKET).upload(it.path, it.file, { contentType: it.type, upsert: false });
      if (error && !/exists|duplicate/i.test(error.message || '') && String(error.statusCode) !== '409') {
        if (isNetworkError(error)) throw error;
        throw new Error(`"${it.name}" could not be uploaded. Please remove it or try a different file.`);
      }
      it.uploaded = true;
    }
    done++;
    out.push({ category: f.id, path: it.path, file_name: it.name, mime_type: it.type, size: it.size });
  }
  for (const f of visibleFileFields) {
    if ((state.files[f.id] || []).length) answers[f.id] = state.files[f.id].map((x) => x.name);
  }
  return out;
}

async function submitApplication() {
  const errBox = document.getElementById('submitError');
  errBox.innerHTML = '';
  setSubmitting(true);
  try {
    const sb = await getSupabase();
    if (!sb) {
      throw Object.assign(new Error('The application system is not connected yet. Please contact Mobile View Properties directly.'), { config: true });
    }
    const answers = cleanAnswers(state.data);
    const files = await uploadFiles(sb, answers);
    document.getElementById('nextBtn').innerHTML = '<span class="spinner-sm" aria-hidden="true"></span> Submitting…';
    const payload = {
      client_submission_id: state.clientId,
      answers,
      files,
      signature_png: state.data.signature,
      signature_name: state.data.signature_name,
      signature_date: state.data.signature_date,
      consent: state.data.consent === true,
      hp: document.getElementById('hpField')?.value || '',
      elapsed_ms: Date.now() - state.startedAt,
      user_agent: navigator.userAgent.slice(0, 300),
    };
    const { data, error } = await sb.rpc('submit_application', { payload });
    if (error) throw error;
    const result = {
      reference: data.reference,
      submitted_at: data.submitted_at,
      answers,
      signature_png: state.data.signature,
      signature_name: state.data.signature_name,
      signature_date: state.data.signature_date,
    };
    try { sessionStorage.setItem(LAST_KEY, JSON.stringify(result)); } catch { /* ignore */ }
    clearDraft();
    notifyByEmail(data.reference);
    showSuccess(result);
  } catch (err) {
    console.error('Application submission failed', err);
    errBox.innerHTML = `<div class="alert alert-error" role="alert">${esc(err.config ? err.message : friendlyError(err))}</div>`;
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSubmitting(false);
  }
}

// Ask the server to email the business (and customer). Only works when an
// email provider is configured on Vercel; the customer never depends on it.
function notifyByEmail(reference) {
  try {
    fetch('/api/notify-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, client_submission_id: state.clientId }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

function contactButtonsHtml(s) {
  const btns = [];
  if (s.phone_main) btns.push(`<a class="btn btn-ghost btn-sm" href="tel:${esc(s.phone_main.replace(/[^\d+]/g, ''))}">Call ${esc(s.phone_main)}</a>`);
  if (s.whatsapp) btns.push(`<a class="btn btn-ghost btn-sm" href="https://wa.me/${digitsOnly(s.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`);
  const tg = telegramLink(s.telegram);
  if (tg) btns.push(`<a class="btn btn-ghost btn-sm" href="${esc(tg)}" target="_blank" rel="noopener noreferrer">Telegram</a>`);
  if (s.email) btns.push(`<a class="btn btn-ghost btn-sm" href="mailto:${esc(s.email)}">Email us</a>`);
  return btns.length ? `<div class="contact-list">${btns.join('')}</div>` : '';
}

function showSuccess(result) {
  state.done = true;
  document.querySelector('.app-intro').hidden = true;
  const when = new Date(result.submitted_at);
  const s = state.settings;
  app.innerHTML = `<div class="card success">
    <div class="success-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>
    <h2 tabindex="-1" id="successTitle">Application Submitted</h2>
    <p>Thank you, ${esc((result.answers.full_name || '').split(' ')[0] || 'and welcome')}. ${esc(s.business_name || 'Mobile View Properties')} has received your application.</p>
    <div class="ref-box"><small>Your application reference</small><strong>${esc(result.reference)}</strong></div>
    <p style="font-size:.85rem">Submitted on ${esc(when.toLocaleDateString('en-US', { dateStyle: 'long' }))} at ${esc(when.toLocaleTimeString('en-US', { timeStyle: 'short' }))}</p>
    <p>Our team will review your application and contact you using your preferred contact method${
      result.answers.preferred_contact ? ` (${esc(result.answers.preferred_contact)})` : ''}. Please keep your reference number for any questions.</p>
    <p style="font-size:.82rem;color:var(--muted)">This application is not a purchase contract or financing approval. Prices, payment plans and financing are confirmed only in a separate written agreement.</p>
    <div class="success-actions">
      <button type="button" class="btn btn-primary" data-action="download-pdf">Download PDF copy</button>
      <a class="btn btn-ghost" href="/">Back to website</a>
    </div>
    ${contactButtonsHtml(s)}
    <p style="margin-top:22px"><button type="button" class="btn btn-ghost btn-sm" data-action="new-application">Start a new application</button></p>
  </div>`;
  window.scrollTo({ top: 0 });
  document.getElementById('successTitle').focus({ preventScroll: true });
}

async function downloadPdf(btn) {
  const raw = sessionStorage.getItem(LAST_KEY);
  if (!raw) return toast('Your copy is no longer available on this device');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Preparing PDF…';
  try {
    const { buildApplicationPdf } = await import('./pdf.js');
    const r = JSON.parse(raw);
    const doc = await buildApplicationPdf({ ...r, settings: state.settings });
    doc.save(`${r.reference}.pdf`);
  } catch (err) {
    console.error(err);
    toast('Sorry, the PDF could not be created. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function startOver() {
  if (!confirm('Clear all your answers and start a new application?')) return;
  clearDraft();
  Object.values(state.files).flat().forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
  Object.assign(state, { step: 0, maxStep: 0, data: {}, files: {}, clientId: null, startedAt: Date.now(), restored: false });
  applyDefaults();
  navDepth = 0;
  history.replaceState({ mvpStep: 0 }, '');
  renderStep();
  window.scrollTo({ top: 0 });
}

async function applyBranding() {
  state.settings = await getBusinessSettings();
  const s = state.settings;
  if (s.logo_url) document.getElementById('brandLogo').src = s.logo_url;
  if (s.business_name) document.getElementById('brandName').textContent = s.business_name;
  const footer = document.getElementById('footerContact');
  const bits = [s.business_address, s.phone_main, s.email].filter(Boolean).map(esc);
  if (bits.length) footer.innerHTML = `<p style="margin-bottom:6px">${bits.join(' &middot; ')}</p>`;
}

async function init() {
  window.addEventListener('offline', () => toast('You are offline. Your answers are saved on this device.'));
  window.addEventListener('online', () => toast('Back online'));
  applyBranding().catch(() => {});

  const last = sessionStorage.getItem(LAST_KEY);
  if (last) {
    try { return showSuccess(JSON.parse(last)); } catch { sessionStorage.removeItem(LAST_KEY); }
  }
  state.restored = loadDraft();
  applyDefaults();
  history.replaceState({ mvpStep: state.step }, '');
  renderStep();

  const sb = await getSupabase().catch(() => null);
  if (!sb) {
    app.insertAdjacentHTML('afterbegin', '<div class="alert alert-warn">Online submission is being set up. You can fill in the form now; your answers are saved on this device.</div>');
  }
}

window.addEventListener('beforeunload', () => {
  // Flush any pending draft save.
  if (saveTimer && !state.done) {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        v: 1, step: state.step, maxStep: state.maxStep, data: state.data,
        clientId: state.clientId, startedAt: state.startedAt, savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }
});

init();
