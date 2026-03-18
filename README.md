# VA Contribution Platform

Next.js + Postgres + MinIO (S3-compatible) + Redis/BullMQ + Python (FastAPI) worker.

## Quickstart (local dev)

Prereqs:
- Docker + Docker Compose
- Node.js (LTS recommended)

1) Start from the repo root:

```bash
npm run dev
```

If you want the NISQA-enabled pyworker (recommended when running in a Linux `amd64` environment):

```bash
npm run dev:nisqa
```

That script:
- boots docker services (Postgres/Redis/MinIO/Pyworker)
- installs `web/` deps
- runs Prisma migrations + seeds the default admin
- starts the Next.js dev server + BullMQ worker

2) Open:
- App: http://localhost:3000
- MinIO console: http://localhost:9001
- Pyworker health: http://localhost:8000/health

Optional smoke tests:

```bash
curl -s http://localhost:8000/health | python -m json.tool
curl -s http://localhost:8000/nisqa/selftest | python -m json.tool
```

## How to use the app (current behavior)

### Login

- Open `/login`
- Default seeded admin (if using seed defaults):
  - email: `admin@example.com`
  - password: `admin123`

### Agent flow

1. Go to `/agent` → **Start Tasks**
2. Open `/agent/tasks` and pick an assigned project
3. On `/agent/tasks/[projectId]`:
   - system locks one task for the current agent
   - record audio with live waveform
   - stop and review recorded waveform/timeline
   - submit recording (creates `Recording` + enqueues scoring job)

Notes:

- only assigned agents can access a project task stream
- upload + recording creation are server-side guarded by lock + assignment checks

### Agent rejected-task correction flow

1. Go to `/agent` → **Review Rejected Tasks**
2. Open `/agent/rejected-tasks` and select a project
3. On `/agent/rejected-tasks/[projectId]`:
   - previous rejected recording is shown for reference
   - re-record and submit correction
   - system loads next rejected task until none remain

### Notifications

- A bell icon is available in the top-right auth area.
- Notifications are user-scoped.
- Rejection events (manager review or external feedback adapter) create a notification for the affected user.

### Manager/Admin flow

- `/manager/projects`
  - create project
  - open **Manage** modal with tabs:
    - **General**: title/description/language
    - **Project Access**: assign/unassign agents
    - **Import Data**: upload script file
    - **Advanced**: tune `targetMos` and `nisqaMinScore`
- `/manager/projects/[projectId]`
  - view details + script count
  - assign agents
  - import scripts
  - export accepted data/audio bundle

## Task file import schema (important)

The project import UI accepts:

- `.csv`
- `.tsv`
- `.json` (array/object with line objects)
- `.jsonl`

For all supported formats:

- required field: `text`
- optional field: `context`

### Dynamic extra columns (now supported)

Any additional columns/keys are persisted into `ScriptLine.details` and shown in the agent recorder prompt automatically.

Examples of extra fields:

- `emotion`
- `speed`
- `volume`
- `style`

Behavior:

- `text` renders as primary prompt block
- every column/key other than `text` (including `context`) renders as a dynamic secondary detail block
- empty values are ignored

### Example CSV

```csv
text,context,emotion,speed,volume
Hello there,Cheerful greeting,happy,medium,normal
Please read this slowly,Instructional,neutral,slow,low
```

### Example JSON

```json
[
   {
      "text": "Hello there",
      "context": "Cheerful greeting",
      "emotion": "happy",
      "speed": "medium"
   }
]
```

## Environment variables

There are **two places** env vars live:

1) Repo root `.env` / `.env.example`
   - Used primarily by `docker compose` (local service defaults)

2) `web/.env` / `web/.env.example`
   - Used by the Next.js app + BullMQ worker process (the Node processes)
   - This is where `EXPORT_S3_*` must be set

### Web app env (`web/.env`)

Create your local file:

```bash
cp web/.env.example web/.env
```

If you start the web app directly (without the root `npm run dev` helper), use:

```bash
npm --prefix web run dev:fresh
```

That guarantees Prisma migrations are applied and the default admin is seeded.

Key variables:
- `DATABASE_URL`: Postgres connection string (local default works with docker-compose)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`: auth config
- `S3_*`: source S3-compatible storage (MinIO in local dev)
- `EXPORT_S3_*`: destination S3 for project exports (optional unless you use export)
- `REDIS_URL`: BullMQ
- `PYWORKER_URL`: FastAPI analysis service

Recommended local MinIO settings (host-side, used by the Node processes):
- `S3_ENDPOINT=http://localhost:9000`
- `S3_REGION=us-east-1`
- `S3_ACCESS_KEY_ID=minio`
- `S3_SECRET_ACCESS_KEY=minio123456`
- `S3_BUCKET=va-platform`

Important: the pyworker must be able to read from the same bucket/key that the web app writes to.

### Docker env (root `.env`)

For local dev, the docker-compose defaults are already in [docker-compose.yml](docker-compose.yml).
If you want a local `.env` for docker, start from:

```bash
cp .env.example .env
```

## Default admin user

On first run, Prisma seed creates a single default admin:
- Email: `admin@example.com`
- Password: `admin123`

Override via env vars when running `npm --prefix web run db:seed`:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_FIRST_NAME`
- `SEED_ADMIN_LAST_NAME`
- `SEED_ADMIN_PASSWORD`

You can also bulk-seed users with `SEED_USERS_JSON`.

## Where to set `EXPORT_S3_*`

Set them in `web/.env` (local dev) or your deployment environment (prod). The export code reads them via [web/src/lib/config.ts](web/src/lib/config.ts).

If you **do not** set any `EXPORT_S3_*` variables, export will fall back to the primary `S3_*` settings.
Set `EXPORT_S3_*` only if you want to export to a different bucket/account/endpoint.

Minimum required for export:
- `EXPORT_S3_BUCKET` (unless you want to reuse `S3_BUCKET`)
- `EXPORT_S3_REGION` (unless you want to reuse `S3_REGION`)
- `EXPORT_S3_ACCESS_KEY_ID` (unless you want to reuse `S3_ACCESS_KEY_ID`)
- `EXPORT_S3_SECRET_ACCESS_KEY` (unless you want to reuse `S3_SECRET_ACCESS_KEY`)

Optional:
- `EXPORT_S3_PREFIX` (defaults to `exports`)
- `EXPORT_S3_ENDPOINT` (needed for MinIO/other S3-compatible destinations; omit for AWS)
- `EXPORT_S3_FORCE_PATH_STYLE` (defaults to `true`; keep `true` for most MinIO setups)

## How the S3 “sync” works

The “export” is a **server-side copy**, not continuous replication.

When you click **Export project** (manager/admin UI), the server route:
- queries recordings for that project (by default: approved OR auto-passed, excluding rejected)
- for each recording:
  - downloads the object from the source S3 (MinIO) using the normal `S3_*` client
  - uploads that same object body to the destination S3 using the `EXPORT_S3_*` client
- returns a CSV or JSON metadata file as a browser download

You can control the selection with query param `include=`:
- `approved` (status = APPROVED)
- `auto` (autoPassed = true and not rejected)
- `approved_or_auto` (default)
- `all_non_rejected`

This works for:
- MinIO <-> AWS S3
- MinIO <-> another MinIO (set `EXPORT_S3_ENDPOINT` accordingly)
- AWS S3 <-> AWS S3 (omit `EXPORT_S3_ENDPOINT`)

Implementation reference:
- Export route: [web/src/app/api/projects/[projectId]/export/route.ts](web/src/app/api/projects/%5BprojectId%5D/export/route.ts)
- Export upload helper: [web/src/lib/s3Export.ts](web/src/lib/s3Export.ts)

## NISQA (linux/amd64)

This repo supports running NISQA inside the pyworker container via a compose override.

Use:

```bash
npm run dev:nisqa
```

Under the hood this sets `USE_NISQA=1` which makes [scripts/dev.sh](scripts/dev.sh) run docker compose with:
- [docker-compose.yml](docker-compose.yml)
- [docker-compose.nisqa.yml](docker-compose.nisqa.yml)

Notes:
- The NISQA pyworker override sets `platform: linux/amd64`. On Apple Silicon this will run via emulation.
- The pyworker image includes a small endpoint to validate the NISQA install: `GET /nisqa/selftest`.

## Recordings log pagination

Defaults are configurable via `web/.env`:
- `RECORDINGS_LOG_PAGE_SIZE` (default `10`)
- `RECORDINGS_LOG_MAX_PAGE_SIZE` (default `50`)

## Worker throughput tuning (for concurrency)

The recordings worker supports configurable concurrency:
- `RECORDINGS_WORKER_CONCURRENCY` (default `2`, clamped to `1..32`)

Related sweeper settings:
- `WORKER_SWEEP_INTERVAL_SEC` (default `60`)
- `WORKER_SWEEP_BATCH` (default `50`)

If you target ~20 concurrent users, start with:
- `RECORDINGS_WORKER_CONCURRENCY=2`
- increase gradually to `3` or `4` while monitoring queue backlog and pyworker latency.

## External feedback adapter (recording rejection)

You can reject recordings from an external pipeline using:
- `POST /api/integrations/feedback/reject`

Auth:
- Header `x-feedback-secret: <FEEDBACK_PIPELINE_SECRET>`

Body:

```json
{
   "recordingId": "<recording-id>",
   "reason": "ASR mismatch with expected script",
   "source": "external-feedback"
}
```

Effect:
- recording status is set to `REJECTED`
- a user notification is created
- task appears in rejected-task review flow
