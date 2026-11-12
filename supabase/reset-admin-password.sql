-- =====================================================================
-- EMERGENCY ONLY: use this if you forgot the admin password and can no
-- longer log in. (If you can log in, change it from the dashboard's
-- "Account" tab instead.)
--
-- 1. Replace  CHOOSE-A-NEW-STRONG-PASSWORD  below with your new password.
-- 2. Paste into Supabase > SQL Editor > Run.
-- 3. Delete the password from the SQL editor afterwards. Never save it.
-- =====================================================================

update auth.users
   set encrypted_password = extensions.crypt('CHOOSE-A-NEW-STRONG-PASSWORD', extensions.gen_salt('bf')),
       updated_at = now()
 where email = 'gentleman@mobileviewproperties.vercel.app';
