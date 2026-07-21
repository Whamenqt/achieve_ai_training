# Achieve AI Training Database

An invite-only training & project-management portal. Learners propose, develop and
submit AI projects; admins supervise and review; a Superadmin oversees the whole
programme. Front end is plain HTML/JS (no build step). Data, auth and security live
in **Supabase**. Hosting is **Netlify**.

---

## What you need

- A free **Supabase** account — https://supabase.com
- A free **Netlify** account — https://netlify.com
- Your GitHub repo (already created): `Whamenqt/achieve_ai_training`

Total setup time: ~15 minutes of clicking. No coding required.

---

## Step 1 — Create the Supabase project

1. Go to https://supabase.com → **New project**.
2. Name it (e.g. `achieve-ai-training`), choose a region near you, set a database
   password (keep it in your password manager — you won't need it in the app).
3. Wait ~2 minutes for it to finish provisioning.

## Step 2 — Run the database script

1. In your Supabase project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the **entire** file, paste it in.
3. Click **Run**. You should see "Success". This creates every table, all security
   rules, storage buckets, and your Superadmin invitation.
   - It's safe to run again later if you make changes.

## Step 3 — Turn OFF email confirmation (for the training)

So invited people can set a password and log in instantly:

1. Supabase → **Authentication** → **Providers** → **Email**.
2. Turn **"Confirm email"** OFF. Save.
   - (You can turn it back on later if you want email verification.)

## Step 4 — Get your two public keys

1. Supabase → **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` in this repo and paste them in:

   ```js
   window.ACHIEVE_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGci...."
   };
   ```

   These two values are **public** and safe to commit. Never put the `service_role`
   key or the database password here.

## Step 5 — Push to GitHub, deploy on Netlify

1. Commit `config.js` (with your keys) and push all files to your repo.
2. Go to https://netlify.com → **Add new site** → **Import an existing project** →
   pick `Whamenqt/achieve_ai_training`.
3. Leave build command blank, publish directory `.` (the included `netlify.toml`
   already sets this). Click **Deploy**.
4. Netlify gives you a live URL like `https://achieve-ai-training.netlify.app`.

## Step 6 — Allow the Netlify URL in Supabase

1. Supabase → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your Netlify URL, and add it under **Redirect URLs**
   (add `https://your-site.netlify.app/**`). Save. (Needed for password reset links.)

## Step 7 — Become the Superadmin

1. Open your live Netlify URL.
2. Click **"First time? Create your password"**.
3. Enter `maryke.kennard@gmail.com` (already seeded as Superadmin) and choose a
   password. You're in — with full Superadmin access.
   - To use a different Superadmin email, change it in `schema.sql` (near the bottom)
     before running, or add a row to the `invitations` table.

---

## How to use it

### Invite people (Superadmin)
**Users** page → *Invite a user*: enter name, email, role, and (for learners) their
supervising admin. This creates an invitation. Tell that person to open the portal,
click **"First time? Create your password"**, and use that exact email. They land on
the right dashboard automatically. No passwords are ever seen or stored by you.

### The learner workflow
Ideas (submit three) → supervisor reviews & selects one → learner writes the scope →
supervisor approves → building → testing → final submission → supervisor approves.
The learner dashboard always shows **"What do I need to do next?"**.

### The admin workflow
**My Learners** shows everyone assigned to you and what's waiting on you. Open a
learner to review their three ideas, **select** one, approve or return the scope,
comment, move status, and score with the evaluation rubric.

### The superadmin
Sees everything: **Programme** overview, **Users**, **Settings** (deadlines,
categories, announcements), **Audit** history, and CSV **Export**. Can override any
status.

---

## Security model (important)

Security is enforced by **Row Level Security in the database**, not by hiding buttons.
Even if someone crafts a direct request:

- Learners can only read/write **their own** project, ideas, scope, comments.
- Admins can only see learners **assigned to them**.
- Superadmin sees everything.
- Status changes go through a controlled function that rejects illegal jumps
  (e.g. Not Started → Approved) and records who changed what, when.
- Every key action is written to an audit log that learners/admins cannot edit.

## File overview

| File | Purpose |
|------|---------|
| `index.html` | App shell (loads Supabase + Tailwind from CDN) |
| `config.js` | **You edit this** — your Supabase URL + anon key |
| `config.example.js` | Template for the above |
| `app.js` | The whole application (auth, routing, all dashboards) |
| `netlify.toml` | Netlify hosting config |
| `supabase/schema.sql` | Database: tables, security, triggers, seed |

## Optional: local preview

From this folder: `python3 -m http.server 8080` then open http://localhost:8080
(add `http://localhost:8080/**` to Supabase Redirect URLs first).

## Troubleshooting

- **"Almost there" screen** → you haven't filled in `config.js`.
- **Can't log in after creating password** → email confirmation is still ON
  (Step 3), or you used a different email than the invitation.
- **"Account inactive"** → no invitation exists for that email. Invite them first.
- **Password reset email not arriving** → Supabase's built-in email is rate-limited;
  for a class, just re-invite or have the Superadmin reset. For production add SMTP.
