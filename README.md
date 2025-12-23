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

That script:
- boots docker services (Postgres/Redis/MinIO/Pyworker)
- installs `web/` deps
- runs Prisma migrations + seeds the default admin
- starts the Next.js dev server + BullMQ worker

2) Open:
- App: http://localhost:3000
- MinIO console: http://localhost:9001
- Pyworker health: http://localhost:8000/health

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
- queries recordings for that project where `autoPassed=true` and `status!=REJECTED`
- for each recording:
  - downloads the object from the source S3 (MinIO) using the normal `S3_*` client
  - uploads that same object body to the destination S3 using the `EXPORT_S3_*` client
- returns a CSV or JSON metadata file as a browser download

This works for:
- MinIO 00 AWS S3
- MinIO 00 another MinIO (set `EXPORT_S3_ENDPOINT` accordingly)
- AWS S3 00 AWS S3 (omit `EXPORT_S3_ENDPOINT`)

Implementation reference:
- Export route: [web/src/app/api/projects/[projectId]/export/route.ts](web/src/app/api/projects/%5BprojectId%5D/export/route.ts)
- Export upload helper: [web/src/lib/s3Export.ts](web/src/lib/s3Export.ts)

## Recordings log pagination

Defaults are configurable via `web/.env`:
- `RECORDINGS_LOG_PAGE_SIZE` (default `10`)
- `RECORDINGS_LOG_MAX_PAGE_SIZE` (default `50`)
