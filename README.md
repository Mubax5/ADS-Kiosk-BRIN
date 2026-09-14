# ADS Kiosk BRIN

Interactive BRIN kiosk and internal content-management system for one touchscreen kiosk.

## Applications

- `apps/admin` — staff CMS built with React and real Cloudflare Kumo components/styles.
- `apps/kiosk` — custom touch-first visitor interface with ads idle mode, `Sentuh untuk Mulai`, six content types, session timeout, and offline content cache.
- `apps/server` — Fastify API, SQLite persistence, authentication, media storage, publish/version service, heartbeat, and production static host.
- `packages/shared` — runtime schemas and TypeScript contracts shared by all applications.

## Requirements

- Node.js 22 or newer.
- Windows is the target production host; development can run on another supported Node workstation.
- Docker, WSL, and a Linux VM are not required.
- A modern Chromium-based browser is the supported kiosk runtime.

Environment-specific IP addresses, VPN routes, passwords, device tokens, certificates, and other secrets must stay outside Git. Copy `.env.example` to `.env` and fill it only on the deployment machine.

## Install and verify

```bash
npm ci
npm run typecheck
npm run test:unit
npm run build
```

For a fresh checkout before the lockfile exists during early development, `npm install` may be used once to generate it; committed builds and CI use `npm ci`.

## Development

```bash
npm install
npm run dev
```

The Admin and Kiosk are separate Vite apps. The Fastify server owns the API and production hosting.

## Production build

Set the deployment `.env` first, including a high-entropy kiosk device token. `KIOSK_DEVICE_TOKEN` is read by the server and `VITE_KIOSK_DEVICE_TOKEN` is embedded into the dedicated kiosk bundle; for a deployment they must contain the same device token. This device credential grants kiosk manifest/heartbeat access only and must never reuse an Admin password.

```bash
npm run build
npm run bootstrap:admin
npm start
```

Production routes:

- `/admin/` — CMS
- `/kiosk/` — visitor kiosk
- `/api/v1/` — API
- `/media/` — validated local media

## Content workflow

CMS changes are drafts. They do not change the public kiosk until an authorized publisher confirms Publish.

A publish creates an immutable manifest. The kiosk downloads all referenced media into a version-specific cache, verifies byte size and SHA-256 checksum, then atomically changes the active version. A failed or interrupted staging operation leaves the previous version active.

## Operations

- Windows deployment and Task Scheduler: `docs/operations/windows-deployment.md`
- Backup and restore: `docs/operations/backup-restore.md`
- Design: `docs/superpowers/specs/2026-09-14-ads-kiosk-brin-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-14-ads-kiosk-brin-v1.md`

The CMS should be reachable only from approved internal/VPN networks. The application does not configure BRIN VPN, firewall, routing, DNS, or certificates itself.
