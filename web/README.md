# Web app

This folder contains the Next.js app (App Router) plus the BullMQ worker.

Start here: [../README.md](../README.md)

For day-to-day usage and latest feature behavior, see:
- App usage and role navigation: [../README.md#how-to-use-the-app-current-behavior](../README.md#how-to-use-the-app-current-behavior)
- Task import schema and dynamic extra columns: [../README.md#task-file-import-schema-important](../README.md#task-file-import-schema-important)
- Worker throughput tuning: [../README.md#worker-throughput-tuning-for-concurrency](../README.md#worker-throughput-tuning-for-concurrency)

Most runtime configuration lives in:
- [./.env.example](./.env.example)  copy to `web/.env` for local dev

If running from this folder directly:
- `npm run dev:fresh` (applies migrations + seeds default admin, then starts Next dev)
- `npm run dev` (starts Next dev only; assumes DB is already initialized)

