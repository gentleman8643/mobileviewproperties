-- =====================================================================
-- Give the "gentleman" login administrator access.
-- ---------------------------------------------------------------------
-- BEFORE running this:
--   1. Supabase > Authentication > Users > "Add user" > "Create new user"
--   2. Email:    gentleman@mobileviewproperties.vercel.app
--      Password: choose a strong password (do NOT write it in any file)
--      Tick "Auto Confirm User"
--   3. Then paste this file into SQL Editor and press Run.
-- Safe to run more than once.
-- =====================================================================

insert into public.admin_users (user_id, username, role)
select id, 'gentleman', 'admin'
  from auth.users
 where email = 'gentleman@mobileviewproperties.vercel.app'
on conflict (user_id) do nothing;

-- Check it worked: you should see one row with username "gentleman".
select a.username, a.role, u.email, a.created_at
  from public.admin_users a
  join auth.users u on u.id = a.user_id;
