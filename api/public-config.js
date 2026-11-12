// GET /api/public-config
// Gives the browser the PUBLIC Supabase URL + anon/publishable key that are
// stored in Vercel environment variables. The secret service-role key is
// never sent, even if it was pasted into the wrong variable by mistake.

function looksSecret(key) {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return true;
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

export default function handler(req, res) {
  const env = process.env;
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (looksSecret(key)) {
    res.status(500).json({ supabaseUrl: '', supabaseAnonKey: '',
      error: 'SUPABASE_ANON_KEY contains a SECRET key. Replace it with the anon / publishable key.' });
    return;
  }
  res.status(200).json({ supabaseUrl, supabaseAnonKey: key });
}
