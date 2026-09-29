# LEAD-AI — Leadership Education & Analytics-Driven Autonomous Intelligence

LEAD-AI is an evidence and reporting layer for the Leadership Academy. It keeps CampusGroups/312 as the system of record, then turns approved exports into an auditable answer to three questions:

1. What did we say we would achieve?
2. What did we achieve?
3. What is in place to make improvements and achieve the required goals?

The dashboard is now backed by a persistent local reporting store that emulates the approved data boundary: the UI writes table-shaped sample data, reports are recalculated from it, and the same repository accepts normalized CampusGroups exports. It remains clearly labelled demo data until an approved institutional database is connected.

## Start locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local store is created automatically at `.lead-ai/reporting-store.json` and is ignored by Git. The read-only report contract is available at `GET /api/reports/current`, table metadata at `GET /api/data/overview`, and a health check at `GET /api/health`.

## Design system

The interface follows the Illinois Tech visual identity. All colours and type are declared once as custom properties at the top of `src/app/globals.css`; change them there rather than in component styles.

| Token             | Value                 | Role                                                                       |
| ----------------- | --------------------- | -------------------------------------------------------------------------- |
| `--red`           | `#CC0000`             | Illinois Tech Red (Pantone 186C). Primary actions, active states, accents. |
| `--red-dark`      | `#A30000`             | Hover and pressed states for red surfaces.                                 |
| `--it-gray`       | `#76777B`             | Illinois Tech Gray (Cool Gray 9). Secondary borders and controls.          |
| `--nav`           | `#111113`             | Illinois Tech Black, used for the sidebar and toast.                       |
| `--amber`         | `#FF9900`             | Illinois Tech alternate (Pantone 130). Secondary accent.                   |
| `--ok` / `--warn` | `#17795C` / `#8A5200` | Status only: on track versus needs attention.                              |

Type is Source Sans 3, Source Serif 4, and Source Code Pro, which are Illinois Tech's official typefaces. They load through `next/font` in `src/app/layout.tsx`, so they are self-hosted with no external request, and are exposed to CSS as `--font-sans`, `--font-serif`, and `--font-mono`.

Red is reserved for identity and primary action. Success and warning states use the dedicated status tokens so that "needs attention" is never confused with brand colour. Every interactive element has a visible `:focus-visible` ring, animation respects `prefers-reduced-motion`, and the sidebar collapses to a keyboard-dismissable drawer below 1024px.

## Data architecture

```text
CampusGroups Data Export API
  └─ async, date-bounded export request + paginated retrieval
       └─ Neon Postgres reporting state on Vercel (local JSON only during development)
            └─ aggregate metrics + qualitative themes
                 └─ role-restricted dashboard and exported report brief

Weekly Individual Report / Committee Check-In form
  └─ submission stored verbatim, addressed by report ID
       └─ semantic read: momentum, blockers + actions, commitments, evidence, themes
            └─ weekly roll-up: project threads across weeks, follow-through on last week
                 └─ internal brief (risks, ledger) and showcase brief (achievements, reach)
```

The `CampusGroupsExportClient` implements the API’s request → query ID → retrieval → `NextToken` pagination pattern, including the documented `updatedStart`, `updatedEnd`, and maximum page size of 999. The production sync catalog contains every resource in the supplied specification: events, RSVPs, check-ins, registration options, payments, members, users, groups, tags, academic and work experiences, budgets and transactions, surveys and submissions, rooms and reservations, badges and completions, feed posts, tracks, checklists and items, stores and products, announcements and recipients.

The official API requires `updatedStart` and `updatedEnd`, a school code, and an API secret; it returns asynchronous query results and pages them with a token. See the [CampusGroups Data Export API documentation](https://docs-prod-us-east-1.service.campusgroups.com/service-data/index.html).

## Connecting CampusGroups

1. Copy `.env.example` to `.env.local`.
2. Add the approved `CG_SCHOOL_CODE` and `CG_API_SECRET`. Do not commit these values or use a `NEXT_PUBLIC_` prefix.
3. Add `CG_REPORTING_GROUP_IDS` as the comma-separated CampusGroups group ID(s) that define the Leadership Academy cohort. Production live sync refuses to run without it, rather than calculating leadership indicators across the entire school.
4. Add a long `INTERNAL_SYNC_TOKEN` before exposing the sync route outside local development.
5. Call `POST /api/campusgroups/sync` with `x-lead-sync-token` and a body such as:

```json
{
  "resource": "events",
  "updatedStart": "2026-08-01T00:00:00Z",
  "updatedEnd": "2026-09-01T00:00:00Z"
}
```

Every completed export records its resource, received count, retained count, and timestamp in the reporting store. The dashboard receives only aggregate-ready fields and pull metadata: it never receives raw CampusGroups rows. Event, RSVP, check-in, member, badge-completion, and survey-submission fields feed the leadership report; other resources are accounted for as source coverage until their institution-approved metric definition is added. Use the admin sync or Vercel Cron for production syncs rather than a browser request.

## Local demo workflow

Open **Data settings** in the dashboard to inspect the local reporting tables, record a touchpoint, run a simulated CampusGroups sync, or reset the sample records. A touchpoint writes an event plus linked RSVP and check-in rows; the dashboard then receives a freshly calculated aggregate report. The simulated sync uses the same event → RSVP → check-in upsert order as the live adapter.

The mutable demo endpoints are intentionally disabled in production unless their matching `LEAD_ALLOW_DEMO_*` flags are set. Live production sync fails closed unless a `DATABASE_URL` is available, so source data cannot silently land in ephemeral serverless memory.

## Committee check-ins: individual reports and the weekly roll-up

The Weekly Individual Report and Committee Check-In forms ask the same questions with slightly different labels, so both normalize into one submission shape. Each submission is stored **verbatim** and addressed by an ID such as `IR-260921-SN-1` (`IR-<yymmdd of the Monday>-<committee code>-<sequence>`). Reporting weeks snap to their Monday, so submissions made on different days land in the same week, and a scholar who re-files for the same week and committee replaces their earlier report and keeps its ID.

Individual reports are the evidence; the weekly roll-up is only a reading of them. Every aggregate claim carries the report IDs behind it, and the dashboard makes each one clickable back to the submission.

### What is read from the free text

`src/lib/lead/semantics.ts` reads the four free-text answers with an explicit lexicon rather than a black box. It is deterministic and auditable: every derived claim keeps the scholar's own sentence, and every classification records why it was reached. Signals are derived on read, not stored, so improving a lexicon improves past weeks too.

| Signal      | What it answers                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Momentum    | Did this week ship, advance, plan, stall, or stop — and on the strength of which phrase?       |
| Blockers    | Which of nine kinds of problem is described, at what severity, **and the move that clears it** |
| Commitments | Next steps split into separately trackable actions, with any due date and named owner          |
| Evidence    | Named artifacts, counts, dates, people credited, links, and attachments                        |
| Specificity | 0–100: how concretely the week is evidenced, capped for one-line updates                       |
| Themes      | Which of eleven programme areas the work concentrated on                                       |
| Follow-ups  | Thin or vague answers worth a question rather than a metric                                    |

Two readings run across reports rather than within one:

- **Project threads** cluster the same piece of work across weeks on word overlap, so wording drift between submissions still threads, and a thread with no completed item for two weeks surfaces on the watchlist.
- **Follow-through** compares last week's stated next steps against this week's updates. A commitment that reappears in an update was _kept_, one that only reappears in next steps was _restated_, one that appears nowhere was _dropped_. This is what catches a commitment going quietly missing — and it corroborates blockers reported elsewhere, such as an approval another committee said it was waiting on.

Blockers declared in the issues field outrank ones inferred from an update, and an inferred blocker must also carry a problem signal, so "approved two of the three committee budgets" is not read as a funding problem.

### Internal and showcase wording

The weekly report is written for internal use and generates two versions from the same evidence:

- **Internal** names the silent committees, the blockers with their recommended actions, the follow-through ledger, and the follow-up prompts for chairs.
- **Showcase** keeps the achievements, the verbatim quotes, the themes, and the reach, and carries no blockers and no critical attribution — so the same week can be shown outside the Academy without being rewritten.

### Endpoints

| Route                                                              | Purpose                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `GET /api/reports/individual?week=&committee=&scholar=&q=`         | Retrieval index; `q` searches every answer             |
| `POST /api/reports/individual`                                     | Intake, with the published form's word limits enforced |
| `GET /api/reports/individual/[id]`                                 | One submission as written, plus its derived signals    |
| `GET /api/reports/weekly`                                          | Week index plus the most recent roll-up                |
| `GET /api/reports/weekly/[week]`                                   | One week's roll-up; any date inside the week resolves  |
| `GET /api/reports/weekly/[week]/brief?audience=internal\|showcase` | Downloadable Markdown brief                            |

A check-in names the scholar who wrote it, so it sits on the other side of the data boundary from the aggregate program report: locally the demo stays open, but on a deployment retrieval requires an admin session (`src/lib/lead/report-access.ts`). The dashboard's **Weekly digest** and **Committee check-ins** views and the Overview pulse band all respect that gate.

## Admin access, Gmail OTP, and scheduled syncs

The admin console is deliberately not linked from the dashboard. Go directly to `/admin`, enter an approved email address, and the app sends a six-digit code through Gmail SMTP. Codes expire after 10 minutes, accept at most five attempts, and the resulting admin session is a signed, HttpOnly cookie lasting eight hours. The request endpoint gives the same success response for unknown addresses, so it does not disclose who is an administrator.

Configure these secrets in `.env.local` locally and in the Vercel project for production; none may use a `NEXT_PUBLIC_` prefix:

| Variable                          | Purpose                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ADMIN_EMAILS`                    | Comma-separated addresses allowed to request an admin code.                                                  |
| `ADMIN_SESSION_SECRET`            | Long random secret used to protect OTP challenges and session signatures.                                    |
| `GMAIL_USER`                      | Gmail or Google Workspace mailbox used as the sender.                                                        |
| `GMAIL_APP_PASSWORD`              | A 16-character [Google App Password](https://myaccount.google.com/apppasswords), never the mailbox password. |
| `CRON_SECRET`                     | Long random value Vercel sends to authenticate scheduled requests.                                           |
| `CG_SCHOOL_CODE`, `CG_API_SECRET` | CampusGroups credentials required when the sync mode is **Live**.                                            |

For Gmail, enable two-step verification on the sender account, create an App Password for “Mail,” and put that generated value in `GMAIL_APP_PASSWORD`. Google Workspace administrators may need to allow App Passwords for the sender account.

`vercel.json` invokes `/api/cron/campusgroups-sync` daily at 06:00 UTC, which every plan accepts. The admin console stores the enabled state, source mode, resources, lookback window, cadence, and UTC start hour; the protected cron route evaluates that saved configuration and skips invocations that are not due. This makes admin schedule changes effective without a redeployment, because Vercel's cron declaration itself remains static.

Hobby projects are limited to one cron run per day, and Vercel only promises to fire it somewhere inside the scheduled hour, so `isSyncDue` matches on the UTC hour and never on an exact minute. Keep the **UTC start hour** in `/admin` on the same hour as the `vercel.json` schedule. On Pro you can change the schedule to `0 * * * *`, which makes the hourly and six-hourly cadences meaningful.

The admin “Run sync now” button and Vercel Cron use the same normalized import workflow. The demo JSON store is intentionally only a local-development stand-in; serverless filesystem storage is not durable on Vercel. Connect the repository to the approved institutional database before enabling live or scheduled production syncs.

## Deploy to Vercel

### Sync local variables to Vercel

The script reads `.env.local` by default, falling back to `.env` for an existing local setup. The safe default previews names only and makes no network changes:

```bash
npm run env:push -- --dry-run
```

Log in and link the intended project once, then upload to production. Values are sent to the Vercel CLI over stdin, never echoed by the script, and overwrite variables with the same target name:

```bash
npx vercel@latest login
npx vercel@latest link
npm run env:push -- --write --environment production
```

Use `--all` only when each environment is approved to receive the same values. In particular, do not copy production CampusGroups or database credentials to Preview by default.

The project builds and runs on Vercel as-is. Two platform constraints shape how it behaves there.

**Storage is durable after Neon is connected.** Local development uses `.lead-ai/reporting-store.json`. On Vercel, connect Neon through the Vercel Marketplace; its `DATABASE_URL` activates the durable Postgres reporting store. Production live sync returns a configuration error instead of writing to serverless memory when that variable is absent.

**Mutating demo endpoints fail closed in production.** Without the flags below, recording a touchpoint and resetting the tables return `403`, and those buttons render disabled rather than erroring. The public `POST /api/campusgroups/sync` route stays closed on every deployment regardless of flags, because a browser cannot hold the service token. Run syncs from `/admin`, or let the cron run them.

### Steps

1. Create the GitHub repository and push:

   ```bash
   gh repo create lead-ai --private --source=. --remote=origin --push
   ```

2. At [vercel.com/new](https://vercel.com/new), import the repository. Leave the framework preset on **Next.js** and the root directory at `./`. The build and output settings need no changes.

3. In the project’s Vercel dashboard, open **Storage** (or **Marketplace**) and create/connect a **Neon** store. Approve it only if it meets your institutional data requirements. Vercel injects `DATABASE_URL`; do not create that value by hand.

4. Open **Settings → Environment Variables** and add the variables below for **Production**, **Preview**, and **Development** as appropriate. None may use a `NEXT_PUBLIC_` prefix. For a showcase deployment only the first block matters:

   | Variable                           | Value                                                     | Needed for                                       |
   | ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
   | `LEAD_ALLOW_DEMO_WRITES`           | `true`                                                    | Enabling **Record touchpoint**                   |
   | `LEAD_ALLOW_DEMO_RESET`            | `true`                                                    | Enabling **Reset sample tables**                 |
   | `LEAD_ALLOW_DEMO_SYNC`             | `true`                                                    | Letting `/admin` run the demo export batch       |
   | `ADMIN_EMAILS`                     | your address                                              | Signing in at `/admin`                           |
   | `ADMIN_SESSION_SECRET`             | long random value                                         | Signing in at `/admin`                           |
   | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | sender mailbox and app password                           | Delivering the `/admin` sign-in code             |
   | `CRON_SECRET`                      | long random value                                         | The scheduled sync                               |
   | `CG_SCHOOL_CODE`, `CG_API_SECRET`  | CampusGroups credentials                                  | Live sync mode                                   |
   | `CG_REPORTING_GROUP_IDS`           | Comma-separated Leadership Academy CampusGroups group IDs | Prevents school-wide metrics                     |
   | `DATABASE_URL`                     | Auto-provisioned by the Neon Marketplace integration      | Durable Vercel reporting store                   |
   | `CG_INITIAL_SYNC_START`            | ISO timestamp, such as `2024-08-01T00:00:00Z`             | Optional first full historical export            |
   | `LEAD_RETAIN_SURVEY_TEXT`          | `true` only with data-governance approval                 | Optional de-identified qualitative survey themes |

   Generate each secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

5. Deploy. Confirm `GET /api/health` returns `{"status":"ok"}`, open `/admin`, use the email code to sign in, select **Live CampusGroups export**, and run the first sync. The dashboard’s **Data settings** page must show `27/27 retrieved` before treating the initial export as complete.

Leave every `LEAD_ALLOW_DEMO_*` flag unset for a read-only showcase. Redeploy after changing environment variables, because the running functions were built against the previous values.

## Reporting standard

Each stated outcome must have a target, reporting period, owner, source of evidence, actual result, and improvement action. Every Leadership Academy meeting/touchpoint should be recorded with an event, RSVP/check-in evidence, an agenda or intent, and an outcome reflection. This is the “Principle of Chairs: Triangulation of Data” in operational form.

Leadership indicators are cohort-level growth signals, not automated rankings of individual students. Officer involvement in other organizations should be scoped to approved CampusGroups roles, handled with consent and institutional policy, and reviewed by a human before any consequential decision. Individual records and sensitive free text should remain role-restricted; administrative exports should default to aggregation or de-identification.

## Current scope and next decisions

- The UI is functional with labelled seed data, a persistent local reporting store, dynamic touchpoint entry, a visible table workbench, and exportable three-question briefs.
- Committee check-ins add the qualitative half: individual reports retrievable by ID, a weekly roll-up that reads them, and internal/showcase briefs. The extraction lexicons in `src/lib/lead/semantics.ts` are the part to tune against real submissions — they are deliberately conservative, so a missed blocker is more likely than an invented one.
- The sync adapter implements all supplied CampusGroups export resources, records all completed pulls, and writes aggregate-ready fields to Neon on Vercel.
- Before live rollout, confirm Neon is approved by the institution, set the retention period and access-review process, and obtain data-governance approval before enabling qualitative survey-text retention.
- AILA can later consume de-identified, approved program aggregates through a separate integration boundary; it should not receive raw student records by default.
