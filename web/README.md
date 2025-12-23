# Web app

This folder contains the Next.js app (App Router) plus the BullMQ worker.

Start here: [../README.md](../README.md)

Most runtime configuration lives in:
- [./.env.example](./.env.example)  copy to `web/.env` for local dev

If running from this folder directly:
- `npm run dev:fresh` (applies migrations + seeds default admin, then starts Next dev)
- `npm run dev` (starts Next dev only; assumes DB is already initialized)

