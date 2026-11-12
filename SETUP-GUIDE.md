# Mobile View Properties – Customer Application & Admin Setup Guide

Your links (they work once steps 1–6 are done and the site is deployed):

- Customer form: https://mobileviewproperties.vercel.app/customer-application
- Admin login: https://mobileviewproperties.vercel.app/admin/login
- Admin dashboard: https://mobileviewproperties.vercel.app/admin

Your existing website pages are not changed by any of these steps.

A few words used below:

- **Supabase** is the free online database. It stores the applications, signatures and files.
- **Vercel** is where your website lives.
- An **environment variable** is a named setting you type into Vercel, like a labelled box holding a value.

---

## A. Create a free Supabase account

1. Go to https://supabase.com and click **Start your project**.
2. Sign up with GitHub or with your email address.
3. Confirm your email if Supabase asks you to.

## B. Create a Supabase project

Your website did not use Supabase before, so there is no existing data to affect. You are making a brand new, empty project.

1. In Supabase, click **New project**.
2. **Name:** `mobile-view-properties`.
3. **Database password:** click **Generate a password**, then save it in a password manager. You will rarely need it.
4. **Region:** choose the one closest to your customers (for example *East US*).
5. **Plan:** Free.
6. Click **Create new project** and wait about 2 minutes.

## C. Find your Project URL and public key

1. In your project, click the **gear icon (Project Settings)** at the bottom left.
2. Click **Data API** and copy the **Project URL**. It looks like `https://abcdxyz.supabase.co`.
3. Click **API Keys** and copy the **publishable** key, which starts with `sb_publishable_`. In older projects this is the **anon public** key, which starts with `eyJ`.
4. Do **not** use the **secret** or **service_role** key for this step. That key is like a master password.

## D. Paste the values into Vercel

> Already done for you: your Project URL and publishable key are saved in `public/app/config.js`, so this step is optional. Only do it if you ever switch to a different Supabase project.

1. Go to https://vercel.com, open your **mobileviewproperties** project.
2. Click **Settings** → **Environment Variables**.
3. Add these two, ticking **Production**, **Preview** and **Development** for each:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | your Project URL from step C2 |
| `SUPABASE_ANON_KEY` | your publishable / anon key from step C3 |

4. Click **Save**.

If you edit the site in Bolt, these values still belong in **Vercel**, because that is where the site runs. The file `public/app/config.js` may only ever contain the **publishable** key, never the secret key.

## E. Create the database tables (run the SQL)

1. In Supabase, click **SQL Editor** in the left menu, then **New query**.
2. In your project folder, open `supabase/migrations/20261112000000_customer_applications.sql`. Copy **everything** in it.
3. Paste it into the Supabase SQL Editor and click **Run**.
4. You should see **Success. No rows returned**.

The script only *adds* things and is safe to run again. It creates:

- the applications tables
- private file storage that only admins can open
- the security rules

## F. Create the administrator account (username `gentleman`)

1. In Supabase, go to **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email:** `gentleman@mobileviewproperties.vercel.app`. This is only your login name behind the scenes; it never receives mail.
3. **Password:** type a strong password that you have **never written in a chat, note or file**. Use 12 or more characters with letters, numbers and a symbol.
4. Tick **Auto Confirm User**, then click **Create user**.
5. Go back to **SQL Editor** → **New query**. Paste everything from `supabase/create-admin.sql` and click **Run**.
6. You should see one row: `gentleman | admin`.
7. Turn off public sign-ups: **Authentication** → **Sign In / Providers**. Switch **Allow new users to sign up** to **off**, then click **Save**. Only you can add admins after this.

> Security note: you included a password in the project brief you shared. Treat that password as exposed and choose a **different** one in step 3.

## G. Open the admin dashboard

1. Go to https://mobileviewproperties.vercel.app/admin/login
2. **Username:** `gentleman`. **Password:** the one you chose in step F3.
3. Click **Sign in**.
4. Open the **Business Settings** tab and fill in your real contact details: phone, WhatsApp, Telegram, email, address and logo. Then click **Save settings**. These details appear on the customer form, the confirmation screen and the PDFs. Empty fields are simply hidden.

## H. View customer applications

- The cards at the top show your totals. Click a card to filter the table.
- Use the search box (name, reference, phone or email) and the filters (status, payment preference, home type, dates).
- Click any row to open the full application. You'll see:
  - every answer
  - the signature
  - uploaded photos and documents
  - contact buttons: Call, Copy phone number, WhatsApp, Telegram and Email
- Inside an application you can:
  - change the **status** and click **Update status**. Every change is recorded in the status history.
  - add **internal notes**. Customers never see them.

## I. Download and print signed applications

Open an application, then:

- **Download PDF** saves a printable PDF with your branding, every answer and the signature.
- **Print application** opens your printer window with a clean black-on-white layout.

Customers can also download their own PDF copy on the confirmation screen.

## J. Change the administrator password

- **If you can log in:** go to the dashboard, open the **Account** tab, type the new password twice and click **Change password**.
- **If you forgot it:**
  1. Open `supabase/reset-admin-password.sql`.
  2. Replace `CHOOSE-A-NEW-STRONG-PASSWORD` with your new password.
  3. Paste it into the Supabase **SQL Editor** and click **Run**.
  4. Clear the editor afterwards. Don't save the password anywhere.

## K. Deploy the changes to Vercel

The new files need to reach Vercel:

- **If your Vercel project is connected to GitHub (most common):** commit and push the changes to your main branch. Vercel deploys automatically within 1–2 minutes.
- **If you upload another way (Bolt, Vercel CLI):** publish or redeploy as you normally do.

After adding or changing environment variables (step D), redeploy: Vercel → **Deployments** → **⋯** on the latest one → **Redeploy**.

Check that it worked:

1. Open https://mobileviewproperties.vercel.app/api/public-config. It should show your Supabase URL, not empty quotes.
2. Open the customer form and submit a test application.
3. Check that the test application appears in the admin dashboard.

## L. Copy and send the customer application link

- In the dashboard, click **Copy customer form link**. Or copy this: `https://mobileviewproperties.vercel.app/customer-application`
- Paste it into WhatsApp, Telegram, a text message, an email or your social media.
- Customers don't need an account. If they lose their connection or close the page, their answers stay saved on their phone and they can finish later. Files they attached need to be added again in that case.

---

## Optional: email notifications (free)

Without this, applications are still saved, and you see them in the dashboard. The site never claims an email was sent.

1. Create a free account at https://resend.com (3,000 emails a month free). Create an **API key**.
2. In Supabase, copy the **secret** key: Project Settings → API Keys → **Secret keys**. This key goes **only** into Vercel, never into code.
3. In Vercel → Settings → Environment Variables, add:

| Name | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (keep private) |
| `RESEND_API_KEY` | your Resend API key |
| `NOTIFY_FROM_EMAIL` | `Mobile View Properties <onboarding@resend.dev>` until you verify your own domain in Resend |
| `ADMIN_NOTIFY_EMAIL` | the email address that should receive new applications |
| `SEND_CUSTOMER_CONFIRMATION` | `true` to also email customers. This only works after you verify a domain in Resend. |

4. Redeploy.

## Running costs

Everything above runs on free tiers:

- **Vercel Hobby:** free.
- **Supabase Free:** 500 MB database and 1 GB file storage. Free projects pause after 1 week with no activity; open the dashboard to wake one up.
- **Resend Free:** 3,000 emails a month.
