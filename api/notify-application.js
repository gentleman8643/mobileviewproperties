// POST /api/notify-application  { reference, client_submission_id }
// Sends the "new application" email to the business and (optionally) a
// confirmation email to the customer, using Resend (free tier).
// If the email variables are not set, it does nothing and says so.
// Each email is sent at most once per application.

const REF_RE = /^MVP-\d{6}-[0-9A-F]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function supabaseHeaders(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`; // legacy JWT keys
  return h;
}

async function sendEmail(apiKey, message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

function row(label, value) {
  return value ? `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${esc(label)}</td><td style="padding:6px 0">${esc(value)}</td></tr>` : '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const env = process.env;
  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  const resendKey = env.RESEND_API_KEY || '';
  const from = env.NOTIFY_FROM_EMAIL || '';
  const adminTo = env.ADMIN_NOTIFY_EMAIL || '';
  const sendCustomer = String(env.SEND_CUSTOMER_CONFIRMATION || '').toLowerCase() === 'true';

  if (!supabaseUrl || !serviceKey || !resendKey || !from || !adminTo) {
    res.status(200).json({ sent: false, reason: 'Email notifications are not configured.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const reference = String(body?.reference || '');
  const clientId = String(body?.client_submission_id || '');
  if (!REF_RE.test(reference) || !UUID_RE.test(clientId)) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  const headers = supabaseHeaders(serviceKey);
  const q = new URLSearchParams({
    reference: `eq.${reference}`,
    client_submission_id: `eq.${clientId}`,
    select: 'id,reference,full_name,email,phone,preferred_contact,home_type,bedrooms,budget,purchase_method,purchase_readiness,needed_by,submitted_at,admin_notified_at,customer_notified_at',
  });
  const appRes = await fetch(`${supabaseUrl}/rest/v1/applications?${q}`, { headers });
  const rows = appRes.ok ? await appRes.json() : [];
  const app = rows[0];
  // Only for real applications submitted in the last hour.
  if (!app || Date.now() - new Date(app.submitted_at).getTime() > 60 * 60 * 1000) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const settingsRes = await fetch(`${supabaseUrl}/rest/v1/business_settings?id=eq.1&select=*`, { headers });
  const settings = (settingsRes.ok ? (await settingsRes.json())[0] : null) || {};
  const business = settings.business_name || 'Mobile View Properties';
  const site = (env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
  const result = { sent: true, admin: false, customer: false };

  // Claim the "notified" flag first so two calls can never send twice.
  async function claim(column) {
    const r = await fetch(`${supabaseUrl}/rest/v1/applications?id=eq.${app.id}&${column}=is.null`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ [column]: new Date().toISOString() }),
    });
    return r.ok && (await r.json()).length === 1;
  }
  async function release(column) {
    await fetch(`${supabaseUrl}/rest/v1/applications?id=eq.${app.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ [column]: null }),
    });
  }

  const summary = `<table style="border-collapse:collapse;font-size:14px">
    ${row('Reference', app.reference)}${row('Name', app.full_name)}${row('Phone', app.phone)}${row('Email', app.email)}
    ${row('Preferred contact', app.preferred_contact)}${row('Home type', app.home_type)}${row('Bedrooms', app.bedrooms)}
    ${row('Budget', app.budget)}${row('Purchase method', app.purchase_method)}${row('Readiness', app.purchase_readiness)}
    ${row('Needed', app.needed_by)}</table>`;

  try {
    if (await claim('admin_notified_at')) {
      try {
        await sendEmail(resendKey, {
          from, to: adminTo.split(',').map((s) => s.trim()).filter(Boolean), reply_to: app.email,
          subject: `New application ${app.reference} - ${app.full_name}`,
          html: `<div style="font-family:Arial,sans-serif;color:#111"><h2 style="margin:0 0 12px">New customer application</h2>
            ${summary}<p style="margin-top:18px"><a href="${esc(site)}/admin" style="background:#f59e0b;color:#000;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open admin dashboard</a></p></div>`,
        });
        result.admin = true;
      } catch (e) {
        await release('admin_notified_at');
        throw e;
      }
    }
    if (sendCustomer && (await claim('customer_notified_at'))) {
      try {
        const contact = [settings.phone_main && `Phone: ${settings.phone_main}`, settings.whatsapp && `WhatsApp: ${settings.whatsapp}`,
          settings.email && `Email: ${settings.email}`].filter(Boolean).map(esc).join('<br>');
        await sendEmail(resendKey, {
          from, to: [app.email], reply_to: settings.email || undefined,
          subject: `We received your application (${app.reference})`,
          html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5"><h2 style="margin:0 0 12px">Thank you, ${esc(app.full_name)}</h2>
            <p>${esc(business)} has received your home purchase &amp; building preference application.</p>
            <p style="font-size:18px">Your reference: <strong>${esc(app.reference)}</strong></p>
            <p>Our team will review your information and contact you${app.preferred_contact ? ` by ${esc(app.preferred_contact)}` : ''}.</p>
            ${contact ? `<p>${contact}</p>` : ''}
            <p style="font-size:12px;color:#666">This application is not a purchase contract or financing approval. Prices, payment plans and financing are confirmed only in a separate written agreement.</p></div>`,
        });
        result.customer = true;
      } catch (e) {
        await release('customer_notified_at');
        throw e;
      }
    }
  } catch (e) {
    console.error('notify-application failed:', e.message);
    res.status(502).json({ sent: false, reason: 'The email provider returned an error.' });
    return;
  }
  res.status(200).json(result);
}
