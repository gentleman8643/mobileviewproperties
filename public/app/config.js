// Public Supabase connection details for the application form and admin pages.
//
// These two values are SAFE to be public: the "publishable" key can only do
// what the database security rules (Row Level Security) allow.
//
// NEVER put the "secret" / "service_role" key (sb_secret_...) in this file.
// The secret key belongs ONLY in Vercel > Settings > Environment Variables.
//
// If SUPABASE_URL / SUPABASE_ANON_KEY are also set in Vercel, these values
// here take priority.
window.MVP_CONFIG = window.MVP_CONFIG || {
  supabaseUrl: 'https://arbcipzxglxaipdrzppf.supabase.co',
  supabaseAnonKey: 'sb_publishable_eXs74NC8KOOjqj2iTIR3Bg_MXRSwiIQ',
};
