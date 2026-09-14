# Backup and Restore Runbook

The database and uploaded media form one logical content state. Back them up and restore them together.

## Backup contents

Each backup directory contains:

```text
backups/
└── YYYYMMDD-HHMMSS/
    ├── kiosk.db
    ├── storage/
    │   ├── images/
    │   ├── videos/
    │   ├── pdf/
    │   └── documents/
    └── deployment-config.example   # sanitized template when available
```

The real `.env`, logs, passwords, device tokens, cookies, and certificates are not copied into the backup.

## Create a backup

For the safest operational procedure, stop the Node server first. The backup command checks the run lock and refuses to continue when the server process is still active.

From the repository root:

```powershell
npm run backup
```

The command uses SQLite's backup API for a consistent database snapshot and copies the media tree under the same backup ID.

After completion, verify that both `kiosk.db` and `storage/` exist in the printed backup directory.

## Store backups

The default backup location is configured by `BACKUP_PATH`. The operations team may copy completed backup directories to an approved internal backup target after creation.

Do not place real deployment secrets in the backup folder. Protect the backup location because uploaded documents can contain organization information even though credentials are excluded.

## Restore a backup

Restore replaces the active database and media library as one pair.

1. Stop the ADS Kiosk BRIN server or scheduled task.
2. Confirm no `node` process for this application is running.
3. Select one complete backup directory containing both `kiosk.db` and `storage/`.
4. From the repository root, run:

```powershell
npm run restore -- .\backups\YYYYMMDD-HHMMSS
```

5. Restart the server.
6. Confirm `/api/v1/health` is healthy.
7. Log in to the CMS and verify Menu & Konten, Ads, Media, and the current published version.
8. Open the kiosk and verify it can sync/heartbeat.

The restore command refuses incomplete backup directories and refuses to run while the live server PID lock belongs to a running process.

## Recovery validation

After restore, check at minimum:

- media referenced by menu/ads opens normally;
- the CMS published version history is present;
- user accounts expected at the backup point can authenticate;
- the kiosk receives or continues using a valid published version;
- new edits can be saved as draft and published.

## What a backup does not include

A content backup does not recreate infrastructure. Keep these separately according to BRIN operational policy:

- the real `.env` values;
- internal DNS/reverse proxy configuration;
- Windows Firewall rules;
- VPN/routing configuration;
- HTTPS certificates/private keys;
- Windows Task Scheduler credentials/settings.

Never commit those values to the public source repository.
