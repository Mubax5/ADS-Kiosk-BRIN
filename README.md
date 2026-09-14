# ADS Kiosk BRIN

Interactive BRIN kiosk and internal content-management system.

## Applications

- `apps/admin` — staff CMS. The UI uses Cloudflare Kumo components and styles.
- `apps/kiosk` — custom touch-first visitor interface.
- `apps/server` — Fastify API, SQLite persistence, media storage, publish/version service, and production static host.
- `packages/shared` — runtime schemas and TypeScript contracts shared by all applications.

## Development target

Node.js 22 or newer on Windows or a development workstation. Docker is not required.

Environment-specific IP addresses, VPN routes, passwords, device tokens, and certificates must stay outside Git. Copy `.env.example` to `.env` and fill it on the deployment machine.

The implementation follows `docs/superpowers/specs/2026-09-14-ads-kiosk-brin-design.md` and `docs/superpowers/plans/2026-09-14-ads-kiosk-brin-v1.md`.
