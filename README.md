# Great Rooms Tracker

A daily money tracker for Lakeland, Winter Haven and Clearwater, plus an
automated Store of the Month / Salesperson of the Month / Collections of the
Month engine that emails you a results email at month-end.

- Each store opens a link, enters their PIN, and types in that day's running
  totals (same numbers as your revenue tracker spreadsheet).
- You (admin) see all three stores side by side on a dashboard.
- At month-end: upload the company Daily Report PDF (auto-parsed), type in
  each store's handwritten EOM checklist, and the app computes the winners
  using the same point system as your SOM.xlsx (verified to reproduce your
  July numbers exactly: Lakeland 280/160 points, winning both awards).
- "Finalize" the month, then "Email me the award" sends you a results email.

## 1. Create accounts (5 minutes, one-time)

1. **Netlify** -- go to https://app.netlify.com and sign up (free tier is fine).
2. **Resend** (sends the award email) -- go to https://resend.com and sign
   up (free tier: 100 emails/day, plenty). You don't need to verify your own
   domain to start -- Resend's shared `onboarding@resend.dev` sender works
   immediately, or verify `greatroomscentral.com` later if you want the
   email to come from your own domain.
   - After signing up: **API Keys** -> **Create API Key** -> copy it.

## 2. Deploy to Netlify

**Important:** don't use netlify.com/drop (drag-and-drop) for this project.
Drag-and-drop only uploads static files -- it never runs `npm install`, so
the functions' dependencies (`@netlify/blobs`, etc.) never get installed and
every function crashes with a 502. This project has to be deployed through
a real build, either of these two ways:

**Option A -- GitHub (recommended, no terminal needed):**
1. Create a free GitHub account at https://github.com if you don't have one.
2. Create a new repository (green "New" button), any name (e.g.
   `great-rooms-tracker`).
3. On the repo's page, click **Add file -> Upload files**, then drag this
   entire unzipped project folder's contents in (select all files/folders
   at once) and commit.
4. In Netlify: **Add new site -> Import an existing project -> Deploy with
   GitHub**, authorize it, and pick that repo. Netlify will detect the
   build settings from `netlify.toml` automatically (build command
   `npm install`, publish directory `public`, functions directory
   `netlify/functions`) -- just click **Deploy**.
5. If you already have a live site (e.g. `grmoney.netlify.app`) from a
   drag-and-drop attempt, you don't need a new one: go to that site's
   **Site configuration -> Build & deploy -> Link repository**, connect
   the same GitHub repo instead, and redeploy. This keeps your existing URL.

**Option B -- Netlify CLI (faster if you're comfortable in Terminal):**
```
npm install -g netlify-cli
cd path/to/great-rooms-tracker
npm install
netlify login
netlify link        # choose "grmoney" (or your existing site) if you have one
netlify deploy --prod
```
This builds functions from your local `node_modules`, so it works even
without connecting GitHub.

Either way, after this step your site's functions should respond -- you can
check by visiting `https://yoursite.netlify.app/api/public-stores`, which
should return JSON like `{"stores":[...]}` rather than an error.

## 3. Set environment variables

In Netlify: **Site settings -> Environment variables**, add:

| Key | Value |
|---|---|
| `JWT_SECRET` | any long random string (e.g. generate one at https://1password.com/password-generator, 40+ characters) |
| `ADMIN_PASSWORD` | the password you'll use to log in as admin |
| `RESEND_API_KEY` | the API key from Resend |
| `AWARD_EMAIL_TO` | jciesicki@gmail.com |
| `AWARD_EMAIL_FROM` | `Great Rooms Tracker <onboarding@resend.dev>` (or your verified domain once set up) |

After adding these, trigger a redeploy (**Deploys -> Trigger deploy -> Deploy
site**) so the functions pick them up.

## 4. First login

Open your site's URL.

- **Stores**: click Lakeland / Winter Haven / Clearwater and enter the PIN
  (defaults: Lakeland `4943`, Winter Haven `1130`, Clearwater `1289` --
  change these anytime in Admin -> Stores).
- **Admin**: use the password you set as `ADMIN_PASSWORD`.

Share the site link with each store manager -- they only need the link and
their PIN, no separate account.

## How the numbers flow

- **Daily tab (stores)**: each morning, a store types in that day's
  *running month-to-date totals* for Rental Revenue, Damage Waivers, Renewal
  Fees, Agreement Fees, Club Fees, IHC Fees and Cash Sales, plus current
  Customers/PARR/BOR/APU -- exactly like your Clearwater revenue tracker
  screenshot. They set "Beginning of month" figures once, at the start of
  the month.
- **Admin -> Stores**: set each store's *monthly budget per revenue
  category* (Rental Revenue, Damage Waivers, Renewal Fees, Agreement Fees,
  Club Fees, IHC Fees, Cash Sales) -- these drive both the dashboard's % of
  Budget and the Store of the Month fee-rate scoring below.
- **Admin -> Dashboard**: shows every store's latest numbers side by side,
  plus % of total monthly budget.
- **Admin -> Month-End & Awards**:
  1. Upload the Daily Report PDF dated the last day of the month. It's
     parsed automatically for PARR growth, customer growth, % GM collected,
     new customers, and YTD PARR growth per store.
  2. Type in each store's EOM checklist (associates & rents, Saturday
     Close %, Monday Close %, Saturday Over 15% average) -- this is a
     handwritten form, so it's manual entry rather than OCR (more reliable
     than trying to read handwriting automatically). You can still attach a
     photo/PDF of the checklist for your records.
  3. The Store of the Month screen computes automatically, using the same
     ranked-points system as your SOM.xlsx (best store on a metric gets top
     points, worst gets fewest; for three stores that's 30/20/10, and it'll
     scale itself to 40/30/20/10 if you add a fourth store). Verified against
     your actual July numbers: Lakeland scores 280/160 and wins both Store
     of the Month and Collections of the Month, matching your spreadsheet.
  4. **Fee rates** (Trip Fee, Club Fee, Agreement Fee, Renewal Fee) are each
     that category's % of Budget at month end -- actual $ from that store's
     last daily entry, divided by the budget you set in Admin -> Stores.
     "Trip Fee" specifically pulls from the IHC Fees line. These compute
     automatically; the boxes are still editable on the Store of the Month
     screen in case a number needs a one-off correction before finalizing.
  5. Click **Finalize**, then **Email me the award**.

## Adding a future store

Admin -> Stores -> "Add a store": give it a key (e.g. `tampa`), name and
PIN, then set its category budgets in the list below. It immediately
appears on the login screen and in the dashboard/scoring.

## Notes on security

Store access is PIN-only, not a full login system -- anyone with the link
and PIN can enter that store's numbers, and the PINs are visible to whoever
you give them to. That matches what you asked for (simple, no accounts to
manage). If you want stronger protection later, Netlify's paid tiers offer
site-wide password protection or IP allowlisting you can layer on top
without changing this app.

## Local development

```
npm install
npx netlify-cli dev
```

This runs the site + functions locally (Netlify Blobs works locally too,
backed by a local emulator) at http://localhost:8888.
