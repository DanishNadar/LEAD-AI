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

| Token | Value | Role |
| --- | --- | --- |
| `--red` | `#CC0000` | Illinois Tech Red (Pantone 186C). Primary actions, active states, accents. |
| `--red-dark` | `#A30000` | Hover and pressed states for red surfaces. |
| `--it-gray` | `#76777B` | Illinois Tech Gray (Cool Gray 9). Secondary borders and controls. |
| `--nav` | `#111113` | Illinois Tech Black, used for the sidebar and toast. |
| `--amber` | `#FF9900` | Illinois Tech alternate (Pantone 130). Secondary accent. |
| `--ok` / `--warn` | `#17795C` / `#8A5200` | Status only: on track versus needs attention. |

Type is Source Sans 3, Source Serif 4, and Source Code Pro, which are Illinois Tech's official typefaces. They load through `next/font` in `src/app/layout.tsx`, so they are self-hosted with no external request, and are exposed to CSS as `--font-sans`, `--font-serif`, and `--font-mono`.

Red is reserved for identity and primary action. Success and warning states use the dedicated status tokens so that "needs attention" is never confused with brand colour. Every interactive element has a visible `:focus-visible` ring, animation respects `prefers-reduced-motion`, and the sidebar collapses to a keyboard-dismissable drawer below 1024px.

## Data architecture

```text
CampusGroups Data Export API
  └─ async, date-bounded export request + paginated retrieval
       └─ normalized reporting tables (local demo store today; approved database in production)
            └─ aggregate metrics + qualitative themes
                 └─ role-restricted dashboard and exported report brief
```

The `CampusGroupsExportClient` implements the API’s request → query ID → retrieval → `NextToken` pagination pattern, including the documented `updatedStart`, `updatedEnd`, and maximum page size of 999. It supports the initial reporting resources:

- Events, RSVPs, check-ins, badge completions, announcements, and budgets
- Academic experiences, work experiences, and members

The official API requires `updatedStart` and `updatedEnd`, a school code, and an API secret; it returns asynchronous query results and pages them with a token. See the [CampusGroups Data Export API documentation](https://docs-prod-us-east-1.service.campusgroups.com/service-data/index.html).

## Connecting CampusGroups

1. Copy `.env.example` to `.env.local`.
2. Add the approved `CG_SCHOOL_CODE` and `CG_API_SECRET`. Do not commit these values or use a `NEXT_PUBLIC_` prefix.
3. Add a long `INTERNAL_SYNC_TOKEN` before exposing the sync route outside local development.
4. Call `POST /api/campusgroups/sync` with `x-lead-sync-token` and a body such as:

```json
{
  "resource": "events",
  "updatedStart": "2026-08-01T00:00:00Z",
  "updatedEnd": "2026-09-01T00:00:00Z"
}
```

The route normalizes approved fields and upserts them into the repository; it returns counts and aggregates, never raw student data. The initial mappings cover Events, RSVPs, Check-ins, Members, and Badge Completions. Sources without an approved mapping remain available for export but are not persisted. Use a scheduled background job for production syncs rather than invoking a long export from a browser request.

## Local demo workflow

Open **Data settings** in the dashboard to inspect the local reporting tables, record a touchpoint, run a simulated CampusGroups sync, or reset the sample records. A touchpoint writes an event plus linked RSVP and check-in rows; the dashboard then receives a freshly calculated aggregate report. The simulated sync uses the same event → RSVP → check-in upsert order as the live adapter.

The mutable demo endpoints are intentionally disabled in production unless their matching `LEAD_ALLOW_DEMO_*` flags are set. Replace `src/lib/lead/mock-database.ts` with the institution’s approved database repository before enabling live records, and add authentication/role checks at that boundary.

## Admin access, Gmail OTP, and scheduled syncs

The admin console is deliberately not linked from the dashboard. Go directly to `/admin`, enter an approved email address, and the app sends a six-digit code through Gmail SMTP. Codes expire after 10 minutes, accept at most five attempts, and the resulting admin session is a signed, HttpOnly cookie lasting eight hours. The request endpoint gives the same success response for unknown addresses, so it does not disclose who is an administrator.

Configure these secrets in `.env.local` locally and in the Vercel project for production; none may use a `NEXT_PUBLIC_` prefix:

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated addresses allowed to request an admin code. |
| `ADMIN_SESSION_SECRET` | Long random secret used to protect OTP challenges and session signatures. |
| `GMAIL_USER` | Gmail or Google Workspace mailbox used as the sender. |
| `GMAIL_APP_PASSWORD` | A 16-character [Google App Password](https://myaccount.google.com/apppasswords), never the mailbox password. |
| `CRON_SECRET` | Long random value Vercel sends to authenticate scheduled requests. |
| `CG_SCHOOL_CODE`, `CG_API_SECRET` | CampusGroups credentials required when the sync mode is **Live**. |

For Gmail, enable two-step verification on the sender account, create an App Password for “Mail,” and put that generated value in `GMAIL_APP_PASSWORD`. Google Workspace administrators may need to allow App Passwords for the sender account.

`vercel.json` invokes `/api/cron/campusgroups-sync` daily at 06:00 UTC, which every plan accepts. The admin console stores the enabled state, source mode, resources, lookback window, cadence, and UTC start hour; the protected cron route evaluates that saved configuration and skips invocations that are not due. This makes admin schedule changes effective without a redeployment, because Vercel's cron declaration itself remains static.

Hobby projects are limited to one cron run per day, and Vercel only promises to fire it somewhere inside the scheduled hour, so `isSyncDue` matches on the UTC hour and never on an exact minute. Keep the **UTC start hour** in `/admin` on the same hour as the `vercel.json` schedule. On Pro you can change the schedule to `0 * * * *`, which makes the hourly and six-hourly cadences meaningful.

The admin “Run sync now” button and Vercel Cron use the same normalized import workflow. The demo JSON store is intentionally only a local-development stand-in; serverless filesystem storage is not durable on Vercel. Connect the repository to the approved institutional database before enabling live or scheduled production syncs.

## Deploy to Vercel

The project builds and runs on Vercel as-is. Two platform constraints shape how it behaves there.

**Storage is not durable on Vercel.** `src/lib/lead/mock-database.ts` writes a JSON file locally, but a serverless filesystem is read-only outside `/tmp` and instances do not share state. On Vercel the same data is held in memory for the life of the instance, so the demo stays interactive while writes disappear on a cold start. The dashboard reads "In-memory demo database" in that mode. Connect an approved database before treating any of it as evidence.

**Mutating demo endpoints fail closed in production.** Without the flags below, recording a touchpoint and resetting the tables return `403`, and those buttons render disabled rather than erroring. The public `POST /api/campusgroups/sync` route stays closed on every deployment regardless of flags, because a browser cannot hold the service token. Run syncs from `/admin`, or let the cron run them.

### Steps

1. Create the GitHub repository and push:

   ```bash
   gh repo create lead-ai --private --source=. --remote=origin --push
   ```

2. At [vercel.com/new](https://vercel.com/new), import the repository. Leave the framework preset on **Next.js** and the root directory at `./`. The build and output settings need no changes.

3. Add environment variables under **Settings -> Environment Variables**. None may use a `NEXT_PUBLIC_` prefix. For a showcase deployment only the first block matters:

   | Variable | Value | Needed for |
   | --- | --- | --- |
   | `LEAD_ALLOW_DEMO_WRITES` | `true` | Enabling **Record touchpoint** |
   | `LEAD_ALLOW_DEMO_RESET` | `true` | Enabling **Reset sample tables** |
   | `LEAD_ALLOW_DEMO_SYNC` | `true` | Letting `/admin` run the demo export batch |
   | `ADMIN_EMAILS` | your address | Signing in at `/admin` |
   | `ADMIN_SESSION_SECRET` | long random value | Signing in at `/admin` |
   | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | sender mailbox and app password | Delivering the `/admin` sign-in code |
   | `CRON_SECRET` | long random value | The scheduled sync |
   | `CG_SCHOOL_CODE`, `CG_API_SECRET` | CampusGroups credentials | Live sync mode |

   Generate each secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

4. Deploy. Confirm `GET /api/health` returns `{"status":"ok"}`, then open the dashboard.

Leave every `LEAD_ALLOW_DEMO_*` flag unset for a read-only showcase. Redeploy after changing environment variables, because the running functions were built against the previous values.

## Reporting standard

Each stated outcome must have a target, reporting period, owner, source of evidence, actual result, and improvement action. Every Leadership Academy meeting/touchpoint should be recorded with an event, RSVP/check-in evidence, an agenda or intent, and an outcome reflection. This is the “Principle of Chairs: Triangulation of Data” in operational form.

Leadership indicators are cohort-level growth signals, not automated rankings of individual students. Officer involvement in other organizations should be scoped to approved CampusGroups roles, handled with consent and institutional policy, and reviewed by a human before any consequential decision. Individual records and sensitive free text should remain role-restricted; administrative exports should default to aggregation or de-identification.

## Current scope and next decisions

- The UI is functional with labelled seed data, a persistent local reporting store, dynamic touchpoint entry, a visible table workbench, and exportable three-question briefs.
- The sync adapter implements CampusGroups’ asynchronous export status and writes normalized, approved fields to the demo repository. It is designed to swap to an approved data store before live rollout.
- Before live rollout, choose the institutional database, authentication/roles, retention period, access-review process, and the finalized definition of each leadership metric.
- AILA can later consume de-identified, approved program aggregates through a separate integration boundary; it should not receive raw student records by default.
