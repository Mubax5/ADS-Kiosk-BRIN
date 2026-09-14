# ADS Kiosk BRIN — System Design

Date: 2026-09-14
Status: Approved design for implementation planning
Repository: `Mubax5/ADS-Kiosk-BRIN`

## 1. Purpose

Build a single-kiosk interactive information system for BRIN with two user-facing surfaces:

1. **CMS Admin** for staff to manage menus, links, text, images, videos, PDFs, QR destinations, advertising media, and kiosk settings.
2. **Touch Kiosk** for visitors. The kiosk spends idle time showing advertising/media and clearly offers **Sentuh untuk Mulai**. After interaction it becomes a simple, touch-first information portal.

The first deployment targets one kiosk and one Windows CMS host. The architecture must stay simple enough to operate without Docker while preserving a clean path to future multi-kiosk support.

## 2. Confirmed Constraints

- One kiosk for the first release.
- CMS/server runs on an existing Windows PC.
- No Docker dependency.
- Node.js and Python are already available on the server PC.
- Server is connected to both the kiosk LAN and BRIN internal network.
- Remote administration is expected to work through the organization's VPN by routing to the internal CMS host. The application does not implement its own VPN.
- CMS UI **must use Cloudflare Kumo UI (`@cloudflare/kumo`) as the component and style system**.
- Kiosk UI is custom and is not required to use Kumo.
- Kiosk design must avoid generic “AI dashboard” styling: no eyebrow labels, decorative icon overload, gratuitous gradients/glassmorphism, or excessive card chrome.
- Content must continue to work as far as possible when the CMS host or network is temporarily unavailable.
- The public repository must not contain internal IP addresses, VPN routes, passwords, tokens, certificates, or other environment-specific secrets. Deployment values belong in ignored environment/config files.

## 3. Recommended Stack

### 3.1 Runtime

Use a single Node.js/TypeScript workspace with one production server process.

- **Backend:** Fastify + TypeScript
- **Database:** SQLite
- **Admin frontend:** React + Vite + Cloudflare Kumo UI
- **Kiosk frontend:** React + Vite with a custom touch-first design system
- **Validation:** shared TypeScript schemas between server and frontends
- **File storage:** local filesystem on the Windows CMS host
- **Package management:** npm workspaces to minimize workstation requirements

The server builds and serves both frontends in production, so staff do not have to operate multiple processes.

### 3.2 Repository Layout

```text
ADS-Kiosk-BRIN/
├── apps/
│   ├── admin/               # React CMS, Kumo UI only
│   ├── kiosk/               # Custom touchscreen UI
│   └── server/              # Fastify API + static serving
├── packages/
│   └── shared/              # schemas, types, shared constants
├── data/                    # runtime database; gitignored
├── storage/                 # runtime uploads; gitignored
├── docs/
│   └── superpowers/specs/
├── .env.example
├── package.json
└── README.md
```

Runtime data is not committed to Git.

## 4. Network and Deployment Model

The Windows CMS host has access to two network paths:

- kiosk LAN for direct kiosk-to-server traffic;
- BRIN internal network for staff administration and VPN-routed access.

The server listens on configured interfaces, while Windows Firewall and application allowlists restrict access.

```text
Office admin / VPN user
        │
        ▼
BRIN internal network
        │
        ▼
┌────────────────────────────┐
│ Windows CMS Host           │
│ Node server                │
│ SQLite                     │
│ local media storage        │
└─────────────┬──────────────┘
              │ kiosk LAN
              ▼
          Touch kiosk
```

Rules:

- Do not expose the CMS directly to the public internet.
- Remote access from home is **Internet → BRIN VPN → internal network → CMS**.
- Production admin access must use HTTPS when the organization provides an internal hostname/certificate or approved reverse proxy. Local development may use HTTP.
- Network addresses and allowed subnets are runtime configuration, never hardcoded in the repository.

## 5. CMS Information Architecture

The first release intentionally keeps the CMS compact.

Primary navigation:

- Dashboard
- Menu & Konten
- Ads
- Media
- Preview
- Settings

User management is available from account/settings rather than as a large standalone subsystem.

### 5.1 Dashboard

Show only operational information:

- kiosk online/offline;
- last heartbeat;
- active published version;
- last successful sync;
- draft changes waiting to publish;
- active menu count;
- active ad count;
- media storage usage.

No decorative analytics charts are required in V1.

### 5.2 Menu & Konten

Display the kiosk's menu items in a Kumo table. Seed the first installation with the existing list:

1. RADMON
2. ELSA
3. ELIRA
4. HIRADC
5. PENGADUAN
6. RAPAT
7. WAC PADAT
8. WAC ZRTTD
9. WAC CAIR
10. WAC BBNB
11. WEB BRIN
12. WAC SEMI CAIR
13. IKM KUNJUNGAN
14. IKM PKL/KP/TA
15. BUKU TAMU

The names are editable; they are seed data, not hardcoded UI labels.

Each item has:

- name;
- optional short description;
- content type;
- content configuration;
- active/inactive state;
- display order;
- optional media reference.

Supported content types:

- `website`
- `pdf`
- `qr`
- `image`
- `video`
- `text`

The editor is adaptive: selecting a content type reveals only the fields relevant to that type.

### 5.3 Website Content

Website content stores a validated `http`/`https` URL.

Kiosk behavior:

1. Attempt controlled embedding when the target permits framing.
2. If the target blocks embedding using CSP or `X-Frame-Options`, do not use unsafe proxy/header-bypass tricks.
3. Show a clean fallback with the site title, short explanation, generated QR code, retry action, and return-to-menu action.

This preserves kiosk control and avoids trapping visitors on an external site with no kiosk navigation.

### 5.4 PDF Content

CMS allows PDF selection/upload from Media Library. Kiosk reader supports:

- vertical scroll;
- zoom controls sized for touch;
- reset zoom;
- back to menu.

The PDF is part of the published content package so the last published version can continue working offline.

### 5.5 QR Content

Admin stores a destination URL plus optional title/instructions. QR images do not need to be manually uploaded; the application generates them from the configured destination.

### 5.6 Text, Image, and Video Content

- `text`: formatted informational page with a deliberately limited editor.
- `image`: full-content image with optional caption.
- `video`: local video with basic play/pause/replay behavior suitable for touch.

Avoid a general-purpose page builder in V1.

## 6. CMS UI Rules — Kumo

The CMS must use actual Kumo components instead of imitating Kumo in custom CSS.

Use Kumo for available primitives such as:

- Button
- Input and field APIs
- Select
- Checkbox/Switch
- Dialog
- Table
- Badge
- Toast/feedback
- Sidebar/navigation
- Layer/Surface components

Kumo's styles and tokens are the CMS style foundation. Custom CSS is limited to application layout, BRIN-specific branding, and cases Kumo does not cover.

Follow Kumo's current integration guidance:

```css
@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
@import "@cloudflare/kumo/styles/tailwind";
@import "tailwindcss";
```

The exact relative `@source` path must match the admin app's final stylesheet location.

CMS visual principles:

- utility-first work interface;
- information-dense enough for desktop administration;
- no marketing-style hero sections;
- no eyebrow text;
- icons only where they improve recognition or actions;
- clear destructive-action confirmation;
- clear draft versus published state.

## 7. Ads / Idle Content Manager

Ads Manager controls what the kiosk shows while idle.

Supported items:

- image/poster;
- video.

Each ad has:

- active state;
- display order;
- duration for still images;
- optional start/end date;
- media reference.

Video normally follows its media duration. The system may allow an explicit maximum later, but this is not required in V1.

Admin can reorder the playlist without renaming files.

## 8. Kiosk UX

### 8.1 Idle Screen

The idle screen prioritizes advertising/media while always making interactivity obvious.

Required persistent action:

**Sentuh untuk Mulai**

The call to action may use a restrained motion/pulse to signal touchability, but it must not obstruct ad content.

### 8.2 Home Screen

After touch:

- transition quickly from idle to home;
- show BRIN identity and a simple heading such as **Pilih layanan**;
- show large touch targets for menu items;
- use text labels as the primary information;
- do not assign meaningless icons to every menu;
- keep the visual hierarchy flat and obvious.

Functional icons are acceptable for universal controls such as Home, Back, and volume.

### 8.3 Session Timeout

Default idle timeout while a visitor session is active: 60 seconds, configurable in CMS.

Before ending a session, show a 10-second warning:

- message that the session will end;
- `Lanjutkan` action.

No interaction:

1. close content view;
2. reset transient session state;
3. return to the idle ad playlist.

The next visitor must not inherit history, zoom level, form state, or other transient data from the previous visitor.

### 8.4 Error States

Never expose raw browser/server errors to visitors.

Network-dependent content uses a kiosk-safe error screen with:

- plain-language message;
- `Coba Lagi`;
- `Kembali ke Menu`.

## 9. Draft, Preview, and Publish

Editing content must not immediately change the public kiosk.

State model:

```text
Draft changes
     │
     ├── Save Draft
     │
     ├── Preview
     │
     ▼
Publish
     │
     ▼
Immutable published version
     │
     ▼
Kiosk stages version
     │
     ▼
Verify all required assets
     │
     ▼
Atomic activation
```

### 9.1 Published Manifest

Each publish creates an immutable manifest containing:

- version number;
- publish timestamp;
- menu snapshot;
- ads snapshot;
- kiosk settings snapshot;
- referenced media IDs;
- media size and checksum information.

Published manifests remain available for rollback and troubleshooting.

### 9.2 Atomic Kiosk Update

Kiosk must not activate a partially downloaded version.

For version `N`:

1. retrieve manifest;
2. stage changed assets into a version-specific browser cache;
3. verify successful responses plus expected size/checksum where available;
4. mark version `N` ready;
5. atomically change the active-version pointer stored in IndexedDB;
6. remove stale caches only after activation succeeds.

If any required asset fails, continue running version `N-1`.

## 10. Offline Strategy

Target runtime for the kiosk is a modern Chromium-based browser on a mini-PC/Windows player. The built-in Android 5.1 browser/WebView is not a supported primary target for the modern kiosk frontend.

Use a service worker plus Cache Storage/IndexedDB:

- application shell cached locally;
- currently active manifest cached locally;
- published PDFs/images/videos cached by version;
- active version pointer persisted in IndexedDB;
- request persistent browser storage where supported.

When CMS/network is unavailable:

- home/menu stays available;
- ads already cached continue playing;
- cached PDFs/images/videos/text remain available;
- previously generated QR data remains available;
- external websites may be unavailable and show the standard network error state.

The kiosk does not silently swap to incomplete content.

## 11. Media Library

Media Library is the single source for uploaded files.

Categories:

- images;
- videos;
- PDFs;
- documents reserved for future CMS use.

Store media metadata in SQLite and binaries on disk.

Suggested runtime layout:

```text
storage/
├── images/
├── videos/
├── pdf/
└── documents/
```

File names on disk use generated IDs rather than trusting the original upload name. Preserve the original filename only as metadata.

Validation:

- allowlisted MIME types and extensions;
- configurable upload size limits;
- reject path traversal and executable uploads;
- checksum each file;
- do not trust client-provided MIME type alone.

## 12. Authentication and Authorization

V1 supports two roles:

- **Admin** — all CMS functions including users/settings/publish.
- **Editor** — content/media edits and preview; publish permission may be enabled explicitly by Admin.

Authentication requirements:

- password hashes produced with a modern salted password KDF;
- server-side authenticated sessions;
- secure, HttpOnly cookies in HTTPS deployments;
- SameSite protection;
- login rate limiting;
- CSRF protection for state-changing browser requests;
- session expiration;
- no credentials or session secrets in Git.

The kiosk uses a separate device credential for kiosk API calls. It is deployment configuration, not source code.

## 13. Audit Log

Record important CMS actions:

- login success/failure summary;
- create/edit/delete content;
- media upload/delete;
- settings changes;
- publish;
- rollback;
- user changes.

Audit entries contain actor, action, target, timestamp, and a compact change summary. Never record plaintext passwords, tokens, or full session cookies.

## 14. Data Model

Core entities:

### `users`

- id
- username
- password_hash
- role
- active
- created_at
- updated_at

### `menu_items`

- id
- name
- description
- content_type
- content_config_json
- media_id nullable
- active
- sort_order
- updated_by
- updated_at

### `ads`

- id
- media_id
- active
- sort_order
- display_duration_seconds
- starts_at nullable
- ends_at nullable
- updated_at

### `media`

- id
- original_name
- stored_name
- category
- mime_type
- byte_size
- checksum
- created_by
- created_at

### `settings`

Key/value application settings including session timeout and device display name.

### `published_versions`

- id/version
- manifest_json
- published_by
- published_at

### `audit_logs`

- id
- user_id nullable
- action
- target_type
- target_id nullable
- summary_json
- created_at

### `kiosk_devices`

V1 contains one row but keeps the boundary explicit for future expansion:

- id
- name
- credential_hash
- last_seen_at
- last_ip
- current_version
- last_sync_at

## 15. Kiosk Heartbeat

Kiosk sends a lightweight heartbeat at a conservative interval.

CMS dashboard can show:

- online/offline;
- last seen;
- kiosk software version;
- active content version;
- last sync result.

This is operational status, not visitor analytics.

## 16. API Boundaries

Keep APIs separated by responsibility.

Examples:

```text
/api/v1/auth/*
/api/v1/admin/menu-items
/api/v1/admin/ads
/api/v1/admin/media
/api/v1/admin/settings
/api/v1/admin/publish
/api/v1/admin/versions
/api/v1/kiosk/manifest
/api/v1/kiosk/heartbeat
/media/<generated-id>
```

Admin routes require authenticated CMS sessions. Kiosk routes require the device credential where appropriate.

Use schema validation for request bodies, query strings, params, and serialized responses.

## 17. Windows Operation

Production should behave like an appliance rather than requiring a terminal every morning.

Requirements:

- one start command for development;
- production build creates admin, kiosk, and server artifacts;
- Node server starts automatically with Windows using an approved startup method such as Task Scheduler or a Windows service wrapper;
- restart on failure;
- logs written to a predictable local log directory with rotation;
- SQLite and uploads live outside build output so application upgrades do not erase data.

No Docker, WSL, or Linux VM is required.

## 18. Backup and Recovery

Back up together:

- SQLite database;
- upload/media storage;
- deployment configuration excluding ephemeral logs.

A backup is only valid when database and media correspond to the same point in time.

V1 must document a manual backup/restore procedure. Automated remote backup is outside initial scope unless infrastructure is provided later.

## 19. Testing Strategy

### Unit tests

- content validators;
- manifest construction;
- URL validation;
- content-type configuration validation;
- permissions;
- timeout/state reducers;
- checksum/version logic.

### API integration tests

- login/session lifecycle;
- Admin vs Editor authorization;
- CRUD menu/media/ads;
- upload rejection cases;
- publish/versioning;
- kiosk manifest/device authentication;
- heartbeat.

### Frontend tests

Admin:

- Kumo forms;
- adaptive content editor;
- draft indicator;
- preview/publish confirmation;
- destructive dialogs.

Kiosk:

- Idle → Sentuh untuk Mulai → Home;
- each content type;
- Back/Home;
- timeout warning and reset;
- website unavailable;
- PDF navigation;
- QR display;
- ad playlist transitions.

### Offline/update tests

Required end-to-end cases:

1. publish a new valid version and activate it;
2. interrupt an asset download and confirm the prior version remains active;
3. stop the CMS server while kiosk is running;
4. restart kiosk browser while CMS is unavailable and load last cached version;
5. restore network and complete sync;
6. reject corrupt/invalid media;
7. restart Windows server and confirm CMS auto-start behavior.

## 20. Security Baseline

- CMS is internal/VPN only, not publicly port-forwarded.
- Secrets live in environment/deployment config and `.gitignore`.
- Validate every upload and input server-side.
- Generate stored filenames; do not use client file paths.
- Apply size limits to request bodies and uploads.
- Add security headers suitable for CMS and kiosk surfaces.
- Escape/sanitize administrator-authored rich text; V1 should prefer a constrained content format rather than arbitrary HTML.
- Do not attempt to bypass third-party website frame policies.
- Do not log sensitive authentication material.
- Keep dependencies pinned through the lockfile and review dependency updates.

## 21. V1 Non-Goals

Do not add these unless requirements change:

- multi-site/multi-tenant management;
- complex analytics or visitor tracking;
- drag-and-drop page builder;
- cloud object storage;
- public internet CMS exposure;
- CMS-managed VPN;
- Docker/Kubernetes;
- native Android 5.1 application;
- AI-generated content features;
- large role/permission matrix.

## 22. Future Expansion Path

The first release keeps a `kiosk_devices` boundary and versioned manifests so a later release can add multiple kiosks without rewriting content semantics.

Possible later additions:

- device groups;
- publish to selected kiosks;
- per-device schedules;
- remote screenshots/health diagnostics;
- richer content scheduling;
- centralized backup;
- controlled visitor analytics if formally required.

These are explicitly deferred from V1.

## 23. Definition of Done for V1

V1 is complete when:

- CMS runs on the Windows server without Docker;
- CMS uses Kumo components/styles throughout the administrative UI;
- staff can securely sign in from approved internal/VPN network paths;
- staff can create/edit/reorder/disable the seeded menu items;
- staff can manage website, PDF, QR, text, image, and video content;
- staff can manage the idle ad playlist;
- staff can preview drafts and explicitly publish a version;
- kiosk clearly shows **Sentuh untuk Mulai** during idle;
- kiosk provides a clean touch-first home screen without decorative icon clutter or eyebrow text;
- kiosk handles all six content types;
- kiosk session timeout reliably resets to idle;
- kiosk keeps the prior version when an update fails;
- cached content survives temporary CMS/network loss;
- dashboard shows basic kiosk status/heartbeat;
- Windows restart brings the server back automatically;
- core unit, integration, frontend, and offline/update test cases pass;
- repository contains no deployment secrets or internal network details.
