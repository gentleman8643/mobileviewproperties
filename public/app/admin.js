// Mobile View Properties - admin dashboard
import { getSupabase, escapeHtml as esc, digitsOnly, telegramLink } from './supabase.js';
import { STATUS_OPTIONS, statusLabel, summarySections, findField, optValue, formatDate } from './schema.js';

const LIST_COLUMNS = 'id,reference,status,full_name,email,phone,home_type,bedrooms,land_size,budget,purchase_method,purchase_readiness,needed_by,submitted_at';
const CATEGORY_LABELS = { land_photos: 'Land photo', land_documents: 'Property document', design_images: 'Inspiration image', extra_documents: 'Other document' };

const $ = (id) => document.getElementById(id);
let sb;
let admin;
let rows = [];
let statFilter = '';
let settings = {};
let current = null; // application open in the drawer

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const badge = (s) => `<span class="badge s-${esc(s)}">${esc(statusLabel(s))}</span>`;

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied`);
  } catch {
    prompt(`Copy the ${label.toLowerCase()}:`, text);
  }
}

// ---------------------------------------------------------------------
// Login guard - nothing is shown or loaded until the admin is verified.
// The database itself also refuses to return data to non-admins (RLS).
// ---------------------------------------------------------------------
async function guard() {
  sb = await getSupabase();
  if (!sb) {
    $('authCheck').innerHTML = '<div class="card" style="max-width:520px">The admin system is not connected to Supabase yet. Add <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b> in Vercel, then redeploy. See SETUP-GUIDE.md.</div>';
    return false;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace('/admin/login');
    return false;
  }
  const { data, error } = await sb.from('admin_users').select('username,role').eq('user_id', session.user.id).maybeSingle();
  if (error || !data) {
    await sb.auth.signOut();
    location.replace('/admin/login?denied=1');
    return false;
  }
  admin = data;
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') location.replace('/admin/login?signedout=1');
  });
  $('adminName').textContent = admin.username;
  document.body.classList.remove('auth-pending');
  return true;
}

// ---------------------------------------------------------------------
// Dashboard: stats + table
// ---------------------------------------------------------------------
const STAT_CARDS = [
  ['total', 'Total applications', () => true],
  ['new_7_days', 'New (last 7 days)', (r) => Date.now() - new Date(r.submitted_at) < 7 * 864e5],
  ['awaiting_contact', 'Awaiting contact', (r) => r.status === 'new'],
  ['under_review', 'Under review', (r) => r.status === 'under_review'],
  ['quotation_sent', 'Quotations prepared / sent', (r) => ['quotation_prepared', 'quotation_sent', 'negotiating'].includes(r.status)],
  ['approved', 'Approved / in progress', (r) => ['approved', 'in_progress'].includes(r.status)],
  ['completed', 'Completed projects', (r) => r.status === 'completed'],
  ['cancelled', 'Rejected / cancelled', (r) => r.status === 'cancelled'],
];

async function loadStats() {
  const { data, error } = await sb.rpc('application_stats');
  const stats = error ? {} : data;
  $('stats').innerHTML = STAT_CARDS.map(([k, label]) =>
    `<button type="button" class="stat${statFilter === k ? ' active' : ''}" data-stat="${k}"><b>${stats[k] ?? '–'}</b><span>${esc(label)}</span></button>`).join('');
}

async function loadApplications() {
  $('appRows').innerHTML = '<tr><td class="empty" colspan="13">Loading…</td></tr>';
  const { data, error } = await sb.from('applications').select(LIST_COLUMNS).order('submitted_at', { ascending: false }).limit(2000);
  if (error) {
    $('appRows').innerHTML = `<tr><td class="empty" colspan="13">Could not load applications: ${esc(error.message)}</td></tr>`;
    return;
  }
  rows = data;
  renderTable();
}

function filtered() {
  const q = $('search').value.trim().toLowerCase();
  const qDigits = digitsOnly(q);
  const st = $('fStatus').value;
  const pay = $('fPayment').value;
  const home = $('fHome').value;
  const from = $('fFrom').value;
  const to = $('fTo').value;
  const statFn = (STAT_CARDS.find(([k]) => k === statFilter) || [])[2];
  return rows.filter((r) => {
    if (statFn && !statFn(r)) return false;
    if (st && r.status !== st) return false;
    if (pay && r.purchase_method !== pay) return false;
    if (home && r.home_type !== home) return false;
    const day = r.submitted_at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!q) return true;
    return [r.reference, r.full_name, r.email].some((v) => (v || '').toLowerCase().includes(q)) ||
      (qDigits.length >= 3 && digitsOnly(r.phone).includes(qDigits));
  });
}

function renderTable() {
  const list = filtered();
  $('resultCount').textContent = `Showing ${list.length} of ${rows.length} application${rows.length === 1 ? '' : 's'}`;
  if (!list.length) {
    $('appRows').innerHTML = `<tr><td class="empty" colspan="13">${rows.length ? 'No applications match your filters.' : 'No applications yet. Share the customer form link to start receiving applications.'}</td></tr>`;
    return;
  }
  $('appRows').innerHTML = list.map((r) => `<tr tabindex="0" data-id="${r.id}" aria-label="Open application ${esc(r.reference)}">
    <td class="ref">${esc(r.reference)}</td><td>${esc(r.full_name)}</td><td style="white-space:nowrap">${esc(r.phone)}</td>
    <td>${esc(r.email)}</td><td>${esc(r.home_type)}</td><td>${esc(r.bedrooms)}</td><td>${esc(r.land_size || '—')}</td>
    <td>${esc(r.budget)}</td><td>${esc(r.purchase_method)}</td><td>${esc(r.purchase_readiness)}</td><td>${esc(r.needed_by)}</td>
    <td style="white-space:nowrap">${esc(fmtDateTime(r.submitted_at))}</td><td>${badge(r.status)}</td></tr>`).join('');
}

function setupFilters() {
  $('fStatus').insertAdjacentHTML('beforeend', STATUS_OPTIONS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(''));
  $('fPayment').insertAdjacentHTML('beforeend', findField('purchase_method').options.map((o) => `<option>${esc(optValue(o))}</option>`).join(''));
  $('fHome').insertAdjacentHTML('beforeend', findField('home_type').options.map((o) => `<option>${esc(optValue(o))}</option>`).join(''));
  ['search', 'fStatus', 'fPayment', 'fHome', 'fFrom', 'fTo'].forEach((id) => $(id).addEventListener('input', renderTable));
  $('clearFilters').addEventListener('click', () => {
    ['search', 'fStatus', 'fPayment', 'fHome', 'fFrom', 'fTo'].forEach((id) => ($(id).value = ''));
    statFilter = '';
    loadStats();
    renderTable();
  });
  $('stats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stat]');
    if (!b) return;
    statFilter = statFilter === b.dataset.stat || b.dataset.stat === 'total' ? '' : b.dataset.stat;
    document.querySelectorAll('.stat').forEach((s) => s.classList.toggle('active', s.dataset.stat === statFilter));
    renderTable();
  });
  $('appRows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) openApplication(tr.dataset.id);
  });
  $('appRows').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openApplication(tr.dataset.id); }
  });
  $('refreshBtn').addEventListener('click', () => { loadStats(); loadApplications(); });
  $('copyLinkBtn').addEventListener('click', () => copy(`${location.origin}/customer-application`, 'Customer form link'));
}

// ---------------------------------------------------------------------
// Application detail
// ---------------------------------------------------------------------
function openDrawer(html) {
  $('drawerPanel').innerHTML = html;
  $('drawer').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  $('drawer').hidden = true;
  document.body.style.overflow = '';
  current = null;
}

async function openApplication(id) {
  openDrawer('<div class="drawer-body"><p style="color:var(--text2)">Loading application…</p></div>');
  const [appRes, docRes, histRes, noteRes] = await Promise.all([
    sb.from('applications').select('*').eq('id', id).single(),
    sb.from('application_documents').select('*').eq('application_id', id).order('uploaded_at'),
    sb.from('application_status_history').select('*').eq('application_id', id).order('changed_at', { ascending: false }),
    sb.from('application_notes').select('*').eq('application_id', id).order('created_at', { ascending: false }),
  ]);
  if (appRes.error) {
    openDrawer(`<div class="drawer-body"><div class="alert alert-error">Could not open this application: ${esc(appRes.error.message)}</div>
      <button class="btn btn-ghost" data-close>Close</button></div>`);
    return;
  }
  const docs = docRes.data || [];
  if (docs.length) {
    const { data: signed } = await sb.storage.from('application-files').createSignedUrls(docs.map((d) => d.storage_path), 3600);
    (signed || []).forEach((s, i) => { docs[i].url = s.signedUrl; });
  }
  current = { app: appRes.data, docs, history: histRes.data || [], notes: noteRes.data || [] };
  renderDetail();
}

function contactActions(a) {
  const ans = a.answers || {};
  const tel = a.phone.replace(/[^\d+]/g, '');
  const wa = digitsOnly(ans.whatsapp_number || a.phone);
  const tg = telegramLink(ans.telegram || a.telegram);
  const subject = encodeURIComponent(`Your Mobile View Properties application ${a.reference}`);
  const waText = encodeURIComponent(`Hello ${a.full_name.split(' ')[0]}, this is Mobile View Properties regarding your application ${a.reference}.`);
  return `<a class="btn btn-ghost btn-sm" href="tel:${esc(tel)}">Call customer</a>
    <button type="button" class="btn btn-ghost btn-sm" data-act="copy-phone">Copy phone number</button>
    <a class="btn btn-ghost btn-sm" href="https://wa.me/${wa}?text=${waText}" target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
    ${tg ? `<a class="btn btn-ghost btn-sm" href="${esc(tg)}" target="_blank" rel="noopener noreferrer">Open Telegram</a>` : ''}
    <a class="btn btn-ghost btn-sm" href="mailto:${esc(a.email)}?subject=${subject}">Send email</a>`;
}

function docsHtml(docs) {
  if (!docs.length) return '<p style="color:var(--muted);font-size:.85rem">No files were uploaded.</p>';
  return `<div class="doc-grid">${docs.map((d) => {
    const isImg = (d.mime_type || '').startsWith('image/') && !/hei[cf]/.test(d.mime_type);
    const preview = isImg && d.url ? `<img src="${esc(d.url)}" alt="${esc(d.file_name)}" loading="lazy">`
      : `<div class="doc-icon">${esc((d.file_name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4))}</div>`;
    return `<a class="doc" href="${esc(d.url || '#')}" target="_blank" rel="noopener noreferrer">${preview}
      <div class="doc-meta"><span class="doc-cat">${esc(CATEGORY_LABELS[d.category] || d.category)}</span>${esc(d.file_name)}</div></a>`;
  }).join('')}</div><p style="color:var(--muted);font-size:.75rem;margin-top:8px">File links are private and expire after 1 hour. Reopen the application to refresh them.</p>`;
}

function fileNamesFromDocs(docs) {
  const out = {};
  for (const d of docs) (out[d.category] = out[d.category] || []).push(d.file_name);
  return out;
}

function renderDetail() {
  const { app: a, docs, history, notes } = current;
  const sections = summarySections(a.answers || {}, fileNamesFromDocs(docs));
  const answersHtml = sections.map((s) => `<div class="summary-section"><h4>${esc(s.title)}</h4><dl>${s.rows.map(([k, v]) =>
    `<div class="summary-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`).join('');
  const statusOpts = STATUS_OPTIONS.map(([v, l]) => `<option value="${v}"${v === a.status ? ' selected' : ''}>${esc(l)}</option>`).join('');
  openDrawer(`
    <div class="drawer-head">
      <div class="drawer-head-top">
        <div><div class="ref">${esc(a.reference)}</div><h2 id="drawerTitle">${esc(a.full_name)}</h2>
          <div style="font-size:.82rem;color:var(--text2)">Submitted ${esc(fmtDateTime(a.submitted_at))} &middot; ${badge(a.status)}</div></div>
        <button type="button" class="drawer-close" data-close aria-label="Close">&times;</button>
      </div>
      <div class="actions no-print">
        <button type="button" class="btn btn-primary btn-sm" data-act="pdf">Download PDF</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="print">Print application</button>
        ${contactActions(a)}
      </div>
    </div>
    <div class="drawer-body">
      <div class="panel no-print"><h3>Status</h3>
        <div class="status-row"><select class="input" id="statusSelect" aria-label="Application status">${statusOpts}</select>
        <button type="button" class="btn btn-primary btn-sm" data-act="save-status">Update status</button></div></div>
      <div class="panel"><h3>Contact information</h3><dl>
        ${[['Phone', a.phone], ['Alternative phone', a.alt_phone], ['Email', a.email], ['Preferred contact', a.preferred_contact],
          ['WhatsApp', a.answers?.whatsapp_number], ['Telegram', a.answers?.telegram]].filter(([, v]) => v)
          .map(([k, v]) => `<div class="summary-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>
      <div class="panel"><h3>All submitted answers</h3>${answersHtml}</div>
      <div class="panel"><h3>Customer signature</h3>
        <div class="sig-view"><img src="${esc(a.signature_png)}" alt="Signature of ${esc(a.signature_name)}"></div>
        <p style="font-size:.85rem;margin-top:8px">Signed by <b>${esc(a.signature_name)}</b> on ${esc(formatDate(a.signature_date))}. Consent given: ${a.consent ? 'Yes' : 'No'}</p></div>
      <div class="panel"><h3>Uploaded documents & photos</h3>${docsHtml(docs)}</div>
      <div class="panel"><h3>Internal notes</h3>
        <div class="no-print"><label class="sr-only" for="noteText">New internal note</label>
          <textarea class="input" id="noteText" rows="3" maxlength="5000" placeholder="Add a private note (customers never see this)"></textarea>
          <div style="margin-top:8px"><button type="button" class="btn btn-ghost btn-sm" data-act="add-note">Add note</button></div></div>
        <div>${notes.length ? notes.map((n) => `<div class="note-item"><small>${esc(n.author_name || 'Admin')} &middot; ${esc(fmtDateTime(n.created_at))}</small>${esc(n.note)}</div>`).join('')
          : '<p style="color:var(--muted);font-size:.85rem;margin-top:8px">No notes yet.</p>'}</div></div>
      <div class="panel"><h3>Status history</h3><ul class="timeline">${history.map((h) => `<li>${h.old_status ? `${esc(statusLabel(h.old_status))} &rarr; ` : 'Submitted as '}<b>${esc(statusLabel(h.new_status))}</b><small>${esc(fmtDateTime(h.changed_at))}</small></li>`).join('')}</ul></div>
    </div>`);
}

async function drawerAction(act, btn) {
  if (!current) return;
  const a = current.app;
  if (act === 'copy-phone') return copy(a.phone, 'Phone number');
  if (act === 'print') {
    document.body.classList.add('printing');
    window.print();
    return;
  }
  if (act === 'pdf') {
    btn.disabled = true;
    try {
      const { buildApplicationPdf } = await import('./pdf.js');
      const doc = await buildApplicationPdf({ ...a, fileNames: fileNamesFromDocs(current.docs), settings });
      doc.save(`${a.reference}.pdf`);
    } catch (e) {
      console.error(e);
      toast('The PDF could not be created. Please try again.');
    } finally {
      btn.disabled = false;
    }
    return;
  }
  if (act === 'save-status') {
    const status = $('statusSelect').value;
    if (status === a.status) return toast('Status is unchanged');
    btn.disabled = true;
    const { error } = await sb.from('applications').update({ status }).eq('id', a.id);
    btn.disabled = false;
    if (error) return toast('Could not update status: ' + error.message);
    toast(`Status updated to ${statusLabel(status)}`);
    const row = rows.find((r) => r.id === a.id);
    if (row) row.status = status;
    renderTable();
    loadStats();
    return openApplication(a.id);
  }
  if (act === 'add-note') {
    const note = $('noteText').value.trim();
    if (!note) return toast('Type a note first');
    btn.disabled = true;
    const { error } = await sb.from('application_notes').insert({ application_id: a.id, note, author_name: admin.username });
    btn.disabled = false;
    if (error) return toast('Could not save note: ' + error.message);
    toast('Note added');
    return openApplication(a.id);
  }
}

window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
$('drawer').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return closeDrawer();
  const b = e.target.closest('[data-act]');
  if (b) drawerAction(b.dataset.act, b);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('drawer').hidden) closeDrawer();
});

// ---------------------------------------------------------------------
// Business settings
// ---------------------------------------------------------------------
const SETTING_FIELDS = [
  ['business_name', 'Business name', 'text', ''],
  ['business_address', 'Business address', 'text', 'full'],
  ['phone_main', 'Main calling number', 'tel', ''],
  ['phone_alt', 'Alternative calling number', 'tel', ''],
  ['whatsapp', 'WhatsApp number (with country code, e.g. +1 213 555 0100)', 'tel', ''],
  ['telegram', 'Telegram username or link', 'text', ''],
  ['email', 'Business email', 'email', ''],
  ['website_url', 'Website URL', 'url', ''],
];

async function loadSettings() {
  const { data } = await sb.from('business_settings').select('*').eq('id', 1).maybeSingle();
  settings = data || {};
}

function renderSettings() {
  const s = settings;
  $('tab-settings').innerHTML = `<h1 class="admin-h1" style="margin-bottom:6px">Business contact settings</h1>
    <p class="step-intro">These details appear on the customer application page, the confirmation screen and PDFs. Leave a field empty to hide it.</p>
    <form class="card" id="settingsForm" novalidate><div class="settings-grid">
      ${SETTING_FIELDS.map(([k, label, type, cls]) => `<div class="field ${cls}"><label class="field-label" for="s_${k}">${esc(label)}</label>
        <input class="input" id="s_${k}" name="${k}" type="${type}" value="${esc(s[k] || '')}" maxlength="300"></div>`).join('')}
      <div class="field full"><span class="field-label">Business logo</span>
        <img class="logo-preview" id="logoPreview" src="${esc(s.logo_url || '/public/images/logo.webp')}" alt="Current logo">
        <p class="field-help">${s.logo_url ? 'Custom logo in use.' : 'Using the website logo.'} PNG, JPG or WebP, up to 2 MB.</p>
        <div class="actions"><label class="btn btn-ghost btn-sm" for="logoFile">Upload new logo</label>
          <input type="file" id="logoFile" class="sr-only" accept="image/png,image/jpeg,image/webp">
          ${s.logo_url ? '<button type="button" class="btn btn-ghost btn-sm" id="logoReset">Use website logo</button>' : ''}</div></div>
    </div>
    <div id="settingsMsg" style="margin-top:16px"></div>
    <div class="nav-buttons"><button type="submit" class="btn btn-primary">Save settings</button></div></form>`;

  $('settingsForm').addEventListener('submit', saveSettings);
  $('logoFile').addEventListener('change', uploadLogo);
  $('logoReset')?.addEventListener('click', async () => {
    const { error } = await sb.from('business_settings').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast('Could not reset logo: ' + error.message);
    settings.logo_url = null;
    renderSettings();
    toast('Now using the website logo');
  });
}

async function saveSettings(e) {
  e.preventDefault();
  const msg = $('settingsMsg');
  const update = {};
  for (const [k] of SETTING_FIELDS) update[k] = $('s_' + k).value.trim() || null;
  if (!update.business_name) update.business_name = 'Mobile View Properties';
  if (update.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(update.email)) {
    msg.innerHTML = '<div class="alert alert-error">Please enter a valid business email.</div>';
    return;
  }
  if (update.website_url && !/^https?:\/\//i.test(update.website_url)) update.website_url = 'https://' + update.website_url;
  update.updated_at = new Date().toISOString();
  const { error } = await sb.from('business_settings').update(update).eq('id', 1);
  if (error) {
    msg.innerHTML = `<div class="alert alert-error">Could not save: ${esc(error.message)}</div>`;
    return;
  }
  Object.assign(settings, update);
  msg.innerHTML = '<div class="alert alert-ok">Settings saved. The customer form now shows these details.</div>';
}

async function uploadLogo(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return toast('Please choose a PNG, JPG or WebP image');
  if (file.size > 2 * 1024 * 1024) return toast('The logo must be 2 MB or smaller');
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
  const path = `logo-${Date.now()}.${ext}`;
  toast('Uploading logo…');
  const { error } = await sb.storage.from('branding').upload(path, file, { contentType: file.type, upsert: false });
  if (error) return toast('Upload failed: ' + error.message);
  const { data } = sb.storage.from('branding').getPublicUrl(path);
  const { error: e2 } = await sb.from('business_settings').update({ logo_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
  if (e2) return toast('Could not save logo: ' + e2.message);
  settings.logo_url = data.publicUrl;
  renderSettings();
  toast('Logo updated');
}

// ---------------------------------------------------------------------
// Account (change password)
// ---------------------------------------------------------------------
function renderAccount() {
  $('tab-account').innerHTML = `<h1 class="admin-h1" style="margin-bottom:6px">Account</h1>
    <p class="step-intro">Signed in as <b>${esc(admin.username)}</b>.</p>
    <form class="card" id="pwForm" style="max-width:480px" novalidate>
      <h2 class="step-title" style="font-size:1.05rem;margin-bottom:14px">Change password</h2>
      <div class="field" style="margin-bottom:14px"><label class="field-label" for="newPw">New password</label>
        <input class="input" id="newPw" type="password" autocomplete="new-password" minlength="12"></div>
      <div class="field" style="margin-bottom:8px"><label class="field-label" for="newPw2">Type the new password again</label>
        <input class="input" id="newPw2" type="password" autocomplete="new-password"></div>
      <p class="field-help" style="margin:6px 0 14px">At least 12 characters, with letters and numbers. Avoid passwords you use elsewhere.</p>
      <div id="pwMsg"></div>
      <button type="submit" class="btn btn-primary">Change password</button>
    </form>`;
  $('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('newPw').value;
    const p2 = $('newPw2').value;
    const msg = $('pwMsg');
    const fail = (t) => { msg.innerHTML = `<div class="alert alert-error">${esc(t)}</div>`; };
    if (p1.length < 12 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)) return fail('Use at least 12 characters, including letters and numbers.');
    if (p1 !== p2) return fail('The two passwords do not match.');
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return fail(error.message);
    $('newPw').value = $('newPw2').value = '';
    msg.innerHTML = '<div class="alert alert-ok">Password changed. Use the new password next time you sign in.</div>';
  });
}

// ---------------------------------------------------------------------
// Tabs, sign out, start
// ---------------------------------------------------------------------
function showTab(name) {
  document.querySelectorAll('.admin-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  ['applications', 'settings', 'account'].forEach((n) => { $('tab-' + n).hidden = n !== name; });
  if (name === 'settings') renderSettings();
  if (name === 'account') renderAccount();
}

async function start() {
  if (!(await guard())) return;
  document.querySelector('.admin-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) showTab(t.dataset.tab);
  });
  $('signOutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.replace('/admin/login?signedout=1');
  });
  setupFilters();
  await Promise.all([loadSettings(), loadStats(), loadApplications()]);
}

start();
