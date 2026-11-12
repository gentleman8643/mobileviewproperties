// Shared Supabase connection for the application form and admin pages.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

let configPromise;
let client;

export function getConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      const local = window.MVP_CONFIG || {};
      if (local.supabaseUrl && local.supabaseAnonKey) return local;
      try {
        const res = await fetch('/api/public-config', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.supabaseUrl && json.supabaseAnonKey) return json;
        }
      } catch {
        /* fall through */
      }
      return null;
    })();
  }
  return configPromise;
}

// Returns a Supabase client, or null when the site is not connected yet.
export async function getSupabase() {
  if (client) return client;
  const cfg = await getConfig();
  if (!cfg) return null;
  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mvp-admin-auth' },
  });
  return client;
}

// Public business contact details (empty values are simply not shown).
export async function getBusinessSettings() {
  const sb = await getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.from('business_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return {};
  return data;
}

// Admins sign in with a short username (e.g. "gentleman"). Supabase Auth needs
// an email, so the username is turned into <username>@ADMIN_EMAIL_DOMAIN.
// The address never receives mail; it is only the login identifier.
export const ADMIN_EMAIL_DOMAIN = 'mobileviewproperties.vercel.app';
export function usernameToEmail(u) {
  const s = String(u || '').trim().toLowerCase();
  return s.includes('@') ? s : `${s}@${ADMIN_EMAIL_DOMAIN}`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

export function telegramLink(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return /^https:\/\/(t\.me|telegram\.me)\//i.test(s) ? s : '';
  if (/^\+?[0-9\s()-]{6,}$/.test(s)) return 'https://t.me/+' + digitsOnly(s);
  return 'https://t.me/' + encodeURIComponent(s.replace(/^@/, ''));
}
