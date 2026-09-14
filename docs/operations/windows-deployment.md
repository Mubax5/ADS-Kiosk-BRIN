# Windows Deployment Runbook

This deployment targets one Windows CMS host and one Chromium-based kiosk player. Docker, WSL, and a Linux VM are not required.

## 1. Prerequisites

- Windows account approved to run the internal service.
- Node.js 22 or newer.
- Git, or a release archive copied to the host.
- Network access from the CMS host to the kiosk LAN and the approved BRIN internal/VPN network.
- Windows Firewall rules approved by the local IT/network team.
- A modern Chromium browser on the kiosk player.

Do not publish the CMS directly to the public internet. Remote administration is expected to use the organization's VPN and internal routing.

## 2. Install the application

Open PowerShell in the deployment directory and run:

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` on the deployment machine. Never commit `.env`.

Important values:

- `HOST`: keep `127.0.0.1` until the intended internal interface/firewall policy is ready. To accept approved LAN/internal connections, set the bind address according to the BRIN network design.
- `PORT`: internal HTTP port used by the Node server.
- `DATABASE_PATH`, `STORAGE_PATH`, `BACKUP_PATH`, `LOG_PATH`: persistent paths. Keep them outside disposable build output.
- `COOKIE_SECRET`: long random server secret.
- `COOKIE_SECURE=true`: use when the CMS is served through the approved internal HTTPS hostname/reverse proxy.
- `KIOSK_DEVICE_TOKEN`: high-entropy device credential used by the server.
- `VITE_KIOSK_DEVICE_TOKEN`: must contain the same device credential **when the kiosk bundle is built**. This credential only authorizes kiosk manifest/heartbeat APIs; never reuse a CMS password or higher-privilege secret.
- `BOOTSTRAP_ADMIN_PASSWORD`: temporary bootstrap input. Remove it from `.env` after the Admin account has been created if local operating procedure permits.

No internal IP address, VPN subnet, certificate, or real token belongs in the public repository.

## 3. Build

The kiosk token is a build-time Vite value, so finish `.env` before the production build.

```powershell
npm run build
```

The build order is shared contracts → CMS → kiosk → server.

## 4. Create the first administrator

From the repository root:

```powershell
npm run bootstrap:admin
```

The command creates or resets the configured bootstrap username as an active Admin. It does not print the password.

## 5. Start manually for acceptance testing

```powershell
$env:NODE_ENV = "production"
npm start
```

Check:

- `/api/v1/health` returns `{ "ok": true }`.
- `/admin/` displays the Kumo-based CMS login.
- `/kiosk/` displays the kiosk application.
- Admin can log in, edit a draft, preview it, and publish a version.
- The kiosk can authenticate, download a published version, and send heartbeat status.

Stop the process with Ctrl+C before changing persistent files or performing restore operations.

## 6. Windows Firewall and network exposure

The application itself does not configure the BRIN network, VPN, or firewall. Coordinate these values with the local IT/network owner.

Recommended policy:

1. Allow the configured server port only from the kiosk LAN and approved BRIN internal/VPN source ranges.
2. Do not create public internet port forwarding.
3. Prefer an approved internal DNS hostname and HTTPS reverse proxy/certificate for CMS traffic.
4. Keep the kiosk device credential separate from CMS user credentials.

## 7. Start automatically with Task Scheduler

Use Task Scheduler rather than leaving a terminal open.

Create a task with:

- **Trigger:** At startup.
- **User:** approved Windows service/operator account.
- **Run whether user is logged on or not:** enabled when permitted.
- **Start in:** absolute deployment repository path.
- **Program/script:** absolute path to `node.exe`.
- **Arguments:** absolute path to `apps\server\dist\index.js`.
- **Restart on failure:** enabled, for example every 1 minute with a reasonable retry count.

The Node process creates a PID lock at `RUN_LOCK_PATH`. Backup/restore scripts use this to refuse unsafe recovery operations while the server is live.

## 8. Logs

Production logs are newline-delimited JSON in `LOG_PATH` using daily files named:

```text
server-YYYY-MM-DD.log
```

The application keeps a small rolling set of recent daily logs. Logs are not part of content backup and must never contain plaintext passwords, session cookies, or device tokens.

## 9. Kiosk browser setup

Use a current Chromium-based browser and launch the kiosk URL in fullscreen/kiosk mode using the deployment machine's approved internal address/hostname.

Recommended operational settings:

- browser auto-start after Windows login/startup as allowed by policy;
- fullscreen/kiosk mode;
- disable sleep for the kiosk display during operating hours;
- keep browser storage enabled so IndexedDB, Cache Storage, and the service worker can preserve the last verified content version;
- do not clear site data on every browser restart.

The built-in Android 5.1 browser/WebView is not the supported primary runtime for this V1 frontend.

## 10. Updating the software

Before an application upgrade:

1. Stop the server.
2. Create a backup using the documented backup procedure.
3. Update/copy the application files.
4. Run `npm ci` when dependencies changed.
5. Rebuild with `npm run build`.
6. Restart the scheduled task/server.
7. Verify health, CMS login, Preview, Publish, and kiosk heartbeat.

Application upgrades must not replace the configured `data/`, `storage/`, `backups/`, or `.env` runtime data.
