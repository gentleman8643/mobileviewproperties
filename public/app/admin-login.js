import { getSupabase, usernameToEmail, escapeHtml as esc } from './supabase.js';

const form = document.getElementById('loginForm');
const msg = document.getElementById('loginMsg');
const btn = document.getElementById('loginBtn');
const pw = document.getElementById('password');

const show = (text, kind = 'error') => {
  msg.innerHTML = text ? `<div class="alert alert-${kind}" role="alert">${esc(text)}</div>` : '';
};

document.getElementById('pwToggle').addEventListener('click', (e) => {
  const visible = pw.type === 'text';
  pw.type = visible ? 'password' : 'text';
  e.currentTarget.textContent = visible ? 'Show' : 'Hide';
  e.currentTarget.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
});

async function isAdmin(sb) {
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

async function init() {
  const sb = await getSupabase();
  if (!sb) {
    show('The admin system is not connected to Supabase yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel (see the setup guide).', 'warn');
    btn.disabled = true;
    return;
  }
  const { data } = await sb.auth.getSession();
  if (data.session && (await isAdmin(sb))) location.replace('/admin');
  if (new URLSearchParams(location.search).get('denied')) show('That account does not have administrator access.');
  if (new URLSearchParams(location.search).get('signedout')) show('You have been signed out.', 'ok');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    if (!username || !pw.value) return show('Please enter your username and password.');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    show('');
    const { error } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password: pw.value });
    if (error) {
      btn.disabled = false;
      btn.textContent = 'Sign in';
      return show(/rate|many/i.test(error.message) ? 'Too many attempts. Please wait a few minutes and try again.'
        : 'Incorrect username or password.');
    }
    if (!(await isAdmin(sb))) {
      await sb.auth.signOut();
      btn.disabled = false;
      btn.textContent = 'Sign in';
      return show('That account does not have administrator access.');
    }
    pw.value = '';
    location.replace('/admin');
  });
}

init();
