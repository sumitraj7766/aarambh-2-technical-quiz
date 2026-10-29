# Aarambh 2.0 Technical Quiz

A React + Vite timed quiz frontend with Supabase database functions and an organizer results dashboard.

## Features

- Student name, roll number, branch, exam date
- Exactly 50 active multiple-choice questions on one page
- 20-minute deadline created by the database
- Manual submission and automatic submission when the deadline expires
- Score calculation on the database side
- One attempt per normalized roll number
- Password-protected organizer dashboard with question editing
- Admin can edit question text, all four options and the correct answer without redeploying
- CSV export (opens in Excel)

> The SQL seeds 50 starter questions across basic electronics, digital logic, programming, databases, and networking. Replace these with the final Aarambh event questions before launch.

## 1. Create Supabase project

1. Visit https://supabase.com and create a free project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Open `supabase/setup.sql` from this project.
4. Replace `CHANGE-THIS-TO-A-LONG-UNIQUE-PASSWORD` with a long, unique organizer password.
5. Run the SQL.
6. Confirm the query inserted 50 rows into `aarambh_questions`.

**Important:** The dashboard password is stored in a private table, and the table has RLS enabled with no public table access. Keep the password private. Use a different password from any personal account.

## 2. Configure local environment

1. Install Node.js LTS from https://nodejs.org if it is not already installed.
2. Extract the ZIP.
3. Copy `.env.example` to `.env` in the project root.
4. In Supabase, open **Project Settings → API** (or **Connect**) and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` / publishable public key → `VITE_SUPABASE_ANON_KEY`
5. Put those values into `.env`.

Do not put a `service_role` key in a frontend environment variable. The browser only uses the public anon/publishable key.

## 3. Run locally

Open a terminal in the extracted `aarambh-quiz` folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

Before the event, test:
- Start an attempt and submit it.
- Try the same roll number again; it should be rejected.
- Check the organizer dashboard.
- Export CSV and open it in Excel.
- For a quick timer test, use a temporary test version of the SQL function with a shorter deadline, then restore 20 minutes before launch.

## 4. Deploy to Vercel for a public link

1. Create a GitHub repository and upload the project files, or import the project folder into a repository.
2. Visit https://vercel.com and sign in with GitHub.
3. Select **Add New → Project** and import the repository.
4. Framework preset: **Vite**. Build command `npm run build`; output directory `dist`.
5. In Vercel project **Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/publishable key
6. Deploy. Vercel gives you a public URL such as `your-project.vercel.app`.
7. After changing environment variables, redeploy the project.

## 5. Update the quiz questions

The database starts with 50 sample questions. To change them, go to Supabase → Table Editor → `aarambh_questions`. Edit `question_text`, the four `options` JSON entries, and `correct_option_id`. The option `id` must match the correct option ID (A, B, C, or D).

Keep exactly 50 rows with `is_active = true`. The correct answer is not returned by the public questions RPC. Do not include the correct answer in the option labels.

## Organizer question editing

1. Open the public site and click **Organizer dashboard**.
2. Enter the organizer password configured in `supabase/setup.sql`.
3. The dashboard shows submissions and a **Question editor** section.
4. Edit question text, option labels, and choose the correct answer with the radio button.
5. Click **Save all 50 questions**. The changes apply to new exam attempts; existing submitted scores are not recalculated.
6. Click **Export CSV** to download the results sheet. Excel opens the downloaded `.csv` file. If you need an `.xlsx` workbook, open the CSV in Excel and choose **Save As → Excel Workbook (.xlsx)**.

The organizer password is sent to Supabase RPC functions for validation; never put the Supabase `service_role` key in the frontend.

## Important operating notes

- The server/database deadline is authoritative; the browser timer is only a display. The app submits when the deadline is reached.
- A roll number can only start one attempt. If a student accidentally closes the tab, the attempt remains reserved; an organizer may need to handle it manually.
- This starter does not implement full identity verification, invigilation, or prevention of students sharing answers. A public link cannot prove who is taking the exam.
- The organizer dashboard uses a shared password. Do not share it with students. For a high-stakes or very large event, use a proper admin authentication system and review the implementation before launch.
- The current app submits answers supplied by the browser, and the database computes the score against the answer key. The database functions should be reviewed and tested before a live competition.
