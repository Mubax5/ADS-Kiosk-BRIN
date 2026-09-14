# ADS Kiosk BRIN V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved single-kiosk BRIN content platform: an internal/VPN-accessible Kumo-based CMS, a custom touch-first kiosk, versioned publishing, and offline-safe content activation on a Windows host without Docker.

**Architecture:** Use one npm-workspace TypeScript repository. A Fastify server owns SQLite, authentication, media storage, version publishing, kiosk device APIs, and production static serving. The Admin and Kiosk are separate React/Vite applications; Admin uses real Cloudflare Kumo components and Kumo styling, while Kiosk uses a custom restrained visual system and caches immutable published manifests/media before atomically activating a version.

**Tech Stack:** Node.js 22+, TypeScript, npm workspaces, Fastify, better-sqlite3, Zod, React, Vite, Cloudflare `@cloudflare/kumo`, Tailwind CSS v4 for the CMS, Vitest, Testing Library, Playwright, `file-type`, `@fastify/multipart`, `@fastify/cookie`, `@fastify/rate-limit`, `qrcode.react`, `react-pdf`, IndexedDB/Cache Storage, `vite-plugin-pwa`.

**Spec:** `docs/superpowers/specs/2026-09-14-ads-kiosk-brin-design.md`

## Global Constraints

- First release supports exactly one kiosk operationally, while preserving the `kiosk_devices` boundary for later expansion.
- Production host is Windows and must not require Docker, WSL, or a Linux VM.
- CMS/server and kiosk runtime values are environment configuration; never commit internal IP addresses, VPN routes, credentials, certificates, tokens, or secrets.
- CMS UI must use actual Cloudflare Kumo components and Kumo style tokens whenever Kumo provides the primitive.
- CMS must have no marketing hero sections, eyebrow text, decorative analytics, or icon overload.
- Kiosk UI must have no eyebrow text, meaningless per-menu icons, gratuitous gradients/glassmorphism, or excessive card chrome.
- Kiosk idle screen must always expose the persistent action `Sentuh untuk Mulai`.
- Kiosk active-session timeout defaults to 60 seconds and shows a 10-second warning with `Lanjutkan` before reset.
- Editing content must never alter the public kiosk until an explicit Publish creates an immutable version.
- Kiosk must never activate a partially downloaded content version; failure leaves the previous version active.
- Kiosk primary runtime target is a modern Chromium browser on a mini-PC/Windows player, not Android 5.1 WebView.
- Third-party frame restrictions must not be bypassed.
- V1 does not add multi-tenant management, visitor analytics, page builders, cloud object storage, public CMS exposure, VPN management, native Android 5.1 support, AI-generated content, or a large permission matrix.

---

## File Structure

```text
ADS-Kiosk-BRIN/
├── apps/
│   ├── admin/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   └── styles/
│   │   └── vite.config.ts
│   ├── kiosk/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── content/
│   │   │   ├── offline/
│   │   │   ├── session/
│   │   │   └── ui/
│   │   └── vite.config.ts
│   └── server/
│       ├── migrations/
│       └── src/
│           ├── auth/
│           ├── config/
│           ├── db/
│           ├── media/
│           ├── publish/
│           ├── routes/
│           └── services/
├── packages/
│   └── shared/src/
├── tests/e2e/
├── docs/operations/
├── data/.gitkeep
├── storage/.gitkeep
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.base.json
```

Each file should have one responsibility. Route files translate HTTP to service calls; service files own business rules; database modules own SQL access; React feature modules own one screen or content renderer.

---

### Task 1: Workspace, Shared Contracts, and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/content.ts`
- Create: `packages/shared/src/manifest.ts`
- Create: `packages/shared/src/api.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/content.test.ts`
- Create: `data/.gitkeep`
- Create: `storage/.gitkeep`
- Modify: `README.md` if present; otherwise create it.

**Interfaces:**
- Produces `ContentType`, `MenuItem`, `AdItem`, `KioskSettings`, `ManifestMedia`, `PublishedManifest`, `ApiError`, and Zod schemas exported from `@ads-kiosk/shared`.
- All later server and frontend tasks consume these exact shared types.

- [ ] **Step 1: Write the shared-contract failing test**

```ts
import { describe, expect, it } from "vitest";
import { menuItemSchema } from "./content";

describe("menuItemSchema", () => {
  it("rejects a website item with a non-http URL", () => {
    const result = menuItemSchema.safeParse({
      id: "menu-1",
      name: "WEB BRIN",
      description: null,
      contentType: "website",
      content: { url: "javascript:alert(1)", title: "BRIN" },
      mediaId: null,
      active: true,
      sortOrder: 1,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm the contract does not exist yet**

Run: `npm test --workspace @ads-kiosk/shared -- --run src/content.test.ts`
Expected: FAIL because workspace/test configuration or `menuItemSchema` is not defined.

- [ ] **Step 3: Create workspace configuration and shared discriminated schemas**

Implement `ContentType` as `website | pdf | qr | image | video | text`, with discriminated content objects:

```ts
export const contentConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("website"), url: z.string().url().refine(isHttpUrl), title: z.string().min(1).max(120) }),
  z.object({ type: z.literal("pdf"), mediaId: z.string().uuid(), title: z.string().min(1).max(120) }),
  z.object({ type: z.literal("qr"), url: z.string().url().refine(isHttpUrl), title: z.string().min(1).max(120), instructions: z.string().max(300).default("Scan QR dengan ponsel Anda") }),
  z.object({ type: z.literal("image"), mediaId: z.string().uuid(), caption: z.string().max(300).nullable() }),
  z.object({ type: z.literal("video"), mediaId: z.string().uuid(), title: z.string().max(120).nullable() }),
  z.object({ type: z.literal("text"), title: z.string().min(1).max(120), body: z.string().min(1).max(20_000) }),
]);
```

`PublishedManifest` must include `version`, `publishedAt`, `menuItems`, `ads`, `settings`, and `media`, where each media entry includes `id`, `url`, `mimeType`, `byteSize`, and SHA-256 `checksum`.

- [ ] **Step 4: Add root scripts and ignore runtime data**

Root scripts must include `dev`, `build`, `test`, `test:unit`, `test:e2e`, and `typecheck`. Ignore `.env`, `data/*`, `storage/*`, `logs/*`, build output, coverage, and `node_modules`, while keeping `.gitkeep` files.

- [ ] **Step 5: Run shared tests and typecheck**

Run: `npm install && npm test --workspace @ads-kiosk/shared -- --run && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore .env.example README.md packages data storage
git commit -m "chore: scaffold kiosk workspace and shared contracts"
```

---

### Task 2: SQLite Schema, Migrations, Seed Data, and Repositories

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/migrations/001_initial.sql`
- Create: `apps/server/src/config/env.ts`
- Create: `apps/server/src/db/database.ts`
- Create: `apps/server/src/db/migrate.ts`
- Create: `apps/server/src/db/seed.ts`
- Create: `apps/server/src/db/repositories/menuRepository.ts`
- Create: `apps/server/src/db/repositories/mediaRepository.ts`
- Create: `apps/server/src/db/repositories/publishRepository.ts`
- Create: `apps/server/src/db/database.test.ts`

**Interfaces:**
- Consumes shared schemas from `@ads-kiosk/shared`.
- Produces `openDatabase(path: string): Database`, `migrate(db)`, `seedInitialContent(db)`, and repository functions used by later services.

- [ ] **Step 1: Write the migration/seed failing test**

```ts
it("creates all required tables and seeds the 15 initial menu labels", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  seedInitialContent(db);
  const names = db.prepare("select name from menu_items order by sort_order").all().map((row: any) => row.name);
  expect(names).toEqual([
    "RADMON", "ELSA", "ELIRA", "HIRADC", "PENGADUAN", "RAPAT", "WAC PADAT", "WAC ZRTTD",
    "WAC CAIR", "WAC BBNB", "WEB BRIN", "WAC SEMI CAIR", "IKM KUNJUNGAN", "IKM PKL/KP/TA", "BUKU TAMU",
  ]);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test --workspace @ads-kiosk/server -- --run src/db/database.test.ts`
Expected: FAIL because database modules/tables do not exist.

- [ ] **Step 3: Implement the initial schema**

`001_initial.sql` must create `users`, `sessions`, `menu_items`, `ads`, `media`, `settings`, `published_versions`, `audit_logs`, and `kiosk_devices`. Add `can_publish` to `users` so Admin can explicitly grant publish rights to an Editor. Store menu content config and manifest snapshots as JSON text. Use foreign keys where appropriate and enable `PRAGMA foreign_keys = ON`.

- [ ] **Step 4: Implement idempotent migrations and initial seed**

Create a `schema_migrations` table and apply each migration once in a transaction. Seed exactly the 15 approved menu names only when no menu rows exist. Seed settings `sessionTimeoutSeconds=60`, `sessionWarningSeconds=10`, and `deviceDisplayName=Kiosk Utama` only when missing.

- [ ] **Step 5: Implement focused repositories**

Repositories must expose typed methods rather than leaking SQL to routes, including:

```ts
menuRepository.list(): MenuItem[];
menuRepository.get(id: string): MenuItem | null;
menuRepository.upsert(input: MenuItem): MenuItem;
menuRepository.remove(id: string): void;
publishRepository.latest(): PublishedManifest | null;
publishRepository.get(version: number): PublishedManifest | null;
publishRepository.insert(manifest: PublishedManifest, publishedBy: string): void;
```

- [ ] **Step 6: Run server DB tests**

Run: `npm test --workspace @ads-kiosk/server -- --run src/db/database.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server
 git commit -m "feat: add sqlite schema repositories and seed data"
```

---

### Task 3: Fastify Core, Authentication, CSRF, Roles, and Audit Log

**Files:**
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/auth/password.ts`
- Create: `apps/server/src/auth/sessionService.ts`
- Create: `apps/server/src/auth/guards.ts`
- Create: `apps/server/src/services/auditService.ts`
- Create: `apps/server/src/routes/auth.ts`
- Create: `apps/server/src/routes/auth.test.ts`
- Create: `apps/server/src/scripts/createAdmin.ts`

**Interfaces:**
- Produces `buildApp(options)` for integration tests.
- Produces `requireUser`, `requireAdmin`, and `requirePublisher` Fastify pre-handlers.
- `request.cmsUser` is `{ id: string; username: string; role: "admin" | "editor"; canPublish: boolean }` after authentication.

- [ ] **Step 1: Write login/session/authorization failing tests**

```ts
it("sets a server-side session cookie and returns a CSRF token after valid login", async () => {
  const app = await buildTestAppWithUser({ username: "admin", password: "correct", role: "admin" });
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "admin", password: "correct" } });
  expect(response.statusCode).toBe(200);
  expect(response.cookies.some((cookie) => cookie.name === "cms_session" && cookie.httpOnly)).toBe(true);
  expect(response.json().csrfToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
});
```

Also test wrong password returns 401, logout invalidates session, Editor is rejected by an Admin-only guard, and Editor without `can_publish` is rejected by `requirePublisher`.

- [ ] **Step 2: Run auth tests and verify failure**

Run: `npm test --workspace @ads-kiosk/server -- --run src/routes/auth.test.ts`
Expected: FAIL because app/auth routes do not exist.

- [ ] **Step 3: Implement password hashing with built-in `crypto.scrypt`**

Store `scrypt$N$r$p$salt$hash` strings. Generate a random 16-byte salt and use constant-time comparison. Do not use reversible encryption.

- [ ] **Step 4: Implement server-side sessions and CSRF**

Generate a random opaque session ID and random CSRF token. Store only the session record in SQLite with expiry. Cookie is `HttpOnly`, `SameSite=Strict`, signed, and `Secure` only when `COOKIE_SECURE=true`. Require `x-csrf-token` for authenticated state-changing CMS requests.

- [ ] **Step 5: Add login rate limiting and audit entries**

Register `@fastify/rate-limit` with a stricter policy on login. Audit successful login, failed login summary, logout, user changes, content changes, settings, media, publish, and rollback without logging passwords/tokens/cookies.

- [ ] **Step 6: Implement `createAdmin` bootstrap command**

Read `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` from process environment, refuse an empty password, create/update the admin, then print only the username and success status.

- [ ] **Step 7: Run auth tests and all server tests**

Run: `npm test --workspace @ads-kiosk/server -- --run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src
 git commit -m "feat: secure cms authentication and audit logging"
```

---

### Task 4: Media Library Upload, Validation, Serving, and Safe Deletion

**Files:**
- Create: `apps/server/src/media/mediaService.ts`
- Create: `apps/server/src/media/mediaValidation.ts`
- Create: `apps/server/src/routes/adminMedia.ts`
- Create: `apps/server/src/routes/media.ts`
- Create: `apps/server/src/routes/adminMedia.test.ts`

**Interfaces:**
- Produces `mediaService.store(stream, originalName): Promise<MediaRecord>` and `mediaService.remove(id): Promise<void>`.
- Public media endpoint is `GET /media/:id` and uses the generated stored filename, never the original upload path.

- [ ] **Step 1: Write upload rejection and checksum failing tests**

```ts
it("stores a valid PNG under a generated name and records a SHA-256 checksum", async () => {
  const response = await authenticatedMultipartUpload(app, "pixel.png", validPngBytes);
  expect(response.statusCode).toBe(201);
  const media = response.json();
  expect(media.originalName).toBe("pixel.png");
  expect(media.storedName).not.toContain("pixel.png");
  expect(media.checksum).toMatch(/^[a-f0-9]{64}$/);
});

it("rejects an executable renamed to .png", async () => {
  const response = await authenticatedMultipartUpload(app, "fake.png", Buffer.from("MZ..."));
  expect(response.statusCode).toBe(415);
});
```

- [ ] **Step 2: Run media tests and verify failure**

Run: `npm test --workspace @ads-kiosk/server -- --run src/routes/adminMedia.test.ts`
Expected: FAIL because media routes/services do not exist.

- [ ] **Step 3: Implement allowlisted media validation**

Use `file-type` magic-byte detection plus extension checks. V1 allowlist: PNG/JPEG/WebP images, MP4/WebM video, PDF documents. Enforce configurable maximum upload bytes before persistence. Reject executables and unsupported files even when the client MIME claims otherwise.

- [ ] **Step 4: Stream to generated storage names and hash while writing**

Generate UUID-based stored names, pick the category directory from validated content, calculate SHA-256, store metadata in SQLite, and ensure partial files are removed on failure.

- [ ] **Step 5: Implement safe media serving and deletion rules**

Serve by media ID with the stored MIME type and `X-Content-Type-Options: nosniff`. Refuse deletion with 409 while a media ID is referenced by a draft menu/ad or any published manifest; otherwise remove DB row and binary together.

- [ ] **Step 6: Run media tests**

Run: `npm test --workspace @ads-kiosk/server -- --run src/routes/adminMedia.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/media apps/server/src/routes
 git commit -m "feat: add validated local media library"
```

---

### Task 5: CMS Draft APIs for Menu, Ads, Settings, Users, and Dashboard

**Files:**
- Create: `apps/server/src/services/menuService.ts`
- Create: `apps/server/src/services/adService.ts`
- Create: `apps/server/src/services/settingsService.ts`
- Create: `apps/server/src/services/userService.ts`
- Create: `apps/server/src/services/dashboardService.ts`
- Create: `apps/server/src/routes/adminMenu.ts`
- Create: `apps/server/src/routes/adminAds.ts`
- Create: `apps/server/src/routes/adminSettings.ts`
- Create: `apps/server/src/routes/adminUsers.ts`
- Create: `apps/server/src/routes/adminDashboard.ts`
- Create: `apps/server/src/routes/adminDrafts.test.ts`

**Interfaces:**
- Admin APIs live under `/api/v1/admin/*` and require session + CSRF for mutations.
- Any successful draft mutation increments `draftRevision` in settings.
- Dashboard returns `{ kiosk, publishedVersion, lastSync, hasUnpublishedChanges, menuCount, activeAdCount, mediaBytes }`.

- [ ] **Step 1: Write draft API failing tests**

Test that Admin can CRUD menu items, Editor can edit content, invalid content config gets 400, only Admin can manage users, settings enforce timeout bounds, and a successful draft mutation changes `hasUnpublishedChanges` to true.

```ts
expect((await getDashboard(app, adminSession)).hasUnpublishedChanges).toBe(false);
await putMenu(app, editorSession, validTextMenu);
expect((await getDashboard(app, adminSession)).hasUnpublishedChanges).toBe(true);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test --workspace @ads-kiosk/server -- --run src/routes/adminDrafts.test.ts`
Expected: FAIL because draft APIs are missing.

- [ ] **Step 3: Implement adaptive menu validation through shared schemas**

Reject content payloads whose discriminant and fields do not match. Validate only `http`/`https` for website/QR URLs. Require referenced media IDs to exist and to match the expected category.

- [ ] **Step 4: Implement Ads and Settings rules**

Ads accept image/video media only, integer sort order, still-image duration from 3 to 3600 seconds, optional ISO start/end timestamps with start before end. Settings accept session timeout 30–900 seconds and fixed warning 10 seconds for V1.

- [ ] **Step 5: Implement User management and Dashboard**

Admin can create, disable, reset password, set role, and set `canPublish` for Editor. Dashboard online status is `last_seen_at` within 90 seconds; storage usage is the sum of media bytes, not a filesystem crawl.

- [ ] **Step 6: Run draft API tests**

Run: `npm test --workspace @ads-kiosk/server -- --run src/routes/adminDrafts.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src
 git commit -m "feat: add cms draft management APIs"
```

---

### Task 6: Publish, Immutable Manifests, Rollback, Kiosk Authentication, and Heartbeat

**Files:**
- Create: `apps/server/src/publish/manifestBuilder.ts`
- Create: `apps/server/src/publish/publishService.ts`
- Create: `apps/server/src/auth/kioskAuth.ts`
- Create: `apps/server/src/routes/adminPublish.ts`
- Create: `apps/server/src/routes/kiosk.ts`
- Create: `apps/server/src/routes/publish.test.ts`

**Interfaces:**
- `buildManifest(db, version, publishedAt): PublishedManifest` creates a complete snapshot.
- `publishService.publish(userId): PublishedManifest` inserts the next version transactionally and sets `publishedRevision=draftRevision`.
- `publishService.rollback(sourceVersion, userId)` creates a new version whose snapshot is copied from `sourceVersion`; it never mutates old versions.
- Kiosk uses `Authorization: Bearer <device-token>` for manifest/heartbeat APIs.

- [ ] **Step 1: Write manifest/versioning failing tests**

```ts
it("publishes an immutable manifest with referenced media metadata", async () => {
  const v1 = await publishService.publish(adminId);
  mutateDraftMenuName(db, "RADMON 2");
  const old = publishRepository.get(v1.version)!;
  expect(old.menuItems[0].name).toBe("RADMON");
  expect(old.media.every((m) => /^[a-f0-9]{64}$/.test(m.checksum))).toBe(true);
});
```

Also test `rollback(1)` creates version 3 after versions 1 and 2, kiosk without bearer token gets 401, valid heartbeat updates last seen/current version, and publish rejects Editor without permission.

- [ ] **Step 2: Run publish tests and verify failure**

Run: `npm test --workspace @ads-kiosk/server -- --run src/routes/publish.test.ts`
Expected: FAIL because publishing/kiosk routes are missing.

- [ ] **Step 3: Build manifest snapshots transactionally**

Manifest must contain only active menu items ordered by `sortOrder`, active ad definitions ordered by `sortOrder`, current kiosk settings, and de-duplicated referenced media with relative URLs `/media/<id>`, byte size, MIME type, and checksum.

- [ ] **Step 4: Implement immutable version history and rollback**

Allocate `max(version)+1` inside a transaction. Store full JSON snapshot. Rollback copies a selected historical snapshot into a newly numbered manifest and records an audit entry naming source and new version.

- [ ] **Step 5: Implement kiosk device bootstrap and bearer auth**

On startup, if the configured kiosk row has no credential and `KIOSK_DEVICE_TOKEN` exists, store SHA-256 of the high-entropy token and never store/log the plaintext. Authenticate with constant-time hash comparison.

- [ ] **Step 6: Implement kiosk manifest and heartbeat endpoints**

`GET /api/v1/kiosk/manifest` returns latest published manifest or 404 before first publish. `POST /api/v1/kiosk/heartbeat` accepts `{ softwareVersion, activeVersion, lastSyncStatus }` and updates device status.

- [ ] **Step 7: Run publish tests and full server test suite**

Run: `npm test --workspace @ads-kiosk/server -- --run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src
 git commit -m "feat: add versioned publishing and kiosk device api"
```

---

### Task 7: Admin React App Shell with Cloudflare Kumo

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/vite.config.ts`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/styles/app.css`
- Create: `apps/admin/src/api/client.ts`
- Create: `apps/admin/src/auth/AuthProvider.tsx`
- Create: `apps/admin/src/layouts/AdminLayout.tsx`
- Create: `apps/admin/src/pages/LoginPage.tsx`
- Create: `apps/admin/src/pages/DashboardPage.tsx`
- Create: `apps/admin/src/layouts/AdminLayout.test.tsx`

**Interfaces:**
- `apiClient` sends credentials and `x-csrf-token` for mutations.
- `AuthProvider` exposes `{ user, csrfToken, login, logout }`.
- `AdminLayout` provides primary navigation: Dashboard, Menu & Konten, Ads, Media, Preview, Settings.

- [ ] **Step 1: Write the Kumo shell failing test**

```tsx
render(<AdminLayout><div>Konten</div></AdminLayout>);
expect(screen.getByRole("navigation")).toBeInTheDocument();
expect(screen.getByText("Menu & Konten")).toBeInTheDocument();
expect(screen.queryByText(/welcome to|explore/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run Admin tests and verify failure**

Run: `npm test --workspace @ads-kiosk/admin -- --run src/layouts/AdminLayout.test.tsx`
Expected: FAIL because Admin app does not exist.

- [ ] **Step 3: Install and configure Kumo exactly as documented**

Install `@cloudflare/kumo`, React, Tailwind CSS v4, and Kumo peer dependencies. In `src/styles/app.css`, use the correct workspace-relative source path:

```css
@source "../../../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
@import "@cloudflare/kumo/styles/tailwind";
@import "tailwindcss";
```

Use actual Kumo `Sidebar`, `Button`, `Input`, `LayerCard`/surface primitives, `Badge`, and feedback components. Do not recreate Kumo controls with custom HTML/CSS when a Kumo primitive exists.

- [ ] **Step 4: Implement Login, AuthProvider, and route protection**

Login uses Kumo Input/Button fields. Successful login stores the CSRF token only in React memory; the authenticated session stays in HttpOnly cookie. On reload, call `/api/v1/auth/me` to obtain a fresh CSRF token.

- [ ] **Step 5: Implement a restrained Dashboard**

Use Kumo surfaces to show kiosk status, last seen, content version, draft state, menu/ad count, and storage usage. Do not add decorative charts.

- [ ] **Step 6: Run Admin tests and build**

Run: `npm test --workspace @ads-kiosk/admin -- --run && npm run build --workspace @ads-kiosk/admin`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin
 git commit -m "feat: add Kumo-based cms shell and authentication"
```

---

### Task 8: Admin CMS Screens for Content, Ads, Media, Preview, Publish, Settings, and Users

**Files:**
- Create: `apps/admin/src/features/menu/MenuTable.tsx`
- Create: `apps/admin/src/features/menu/MenuEditor.tsx`
- Create: `apps/admin/src/features/ads/AdsManager.tsx`
- Create: `apps/admin/src/features/media/MediaLibrary.tsx`
- Create: `apps/admin/src/features/publish/PublishPanel.tsx`
- Create: `apps/admin/src/pages/MenuPage.tsx`
- Create: `apps/admin/src/pages/AdsPage.tsx`
- Create: `apps/admin/src/pages/MediaPage.tsx`
- Create: `apps/admin/src/pages/PreviewPage.tsx`
- Create: `apps/admin/src/pages/SettingsPage.tsx`
- Create: `apps/admin/src/features/menu/MenuEditor.test.tsx`
- Create: `apps/admin/src/features/publish/PublishPanel.test.tsx`

**Interfaces:**
- `MenuEditor` receives/returns the shared `MenuItem` shape and conditionally renders controls based on `content.type`.
- Preview iframe uses `/kiosk/?preview=1`; in preview mode the kiosk requests `/api/v1/admin/preview-manifest` with the Admin session rather than the device token.

- [ ] **Step 1: Write adaptive-editor and publish-confirmation failing tests**

```tsx
render(<MenuEditor value={websiteItem} onSave={save} media={[]} />);
expect(screen.getByLabelText("URL")).toBeInTheDocument();
expect(screen.queryByLabelText("Pilih PDF")).not.toBeInTheDocument();
```

Also verify selecting PDF replaces URL fields with media selection; QR shows URL + instructions; Publish requires explicit confirmation and clearly names the next version.

- [ ] **Step 2: Run feature tests and verify failure**

Run: `npm test --workspace @ads-kiosk/admin -- --run src/features`
Expected: FAIL because feature screens are missing.

- [ ] **Step 3: Build Menu & Konten with Kumo Table and adaptive Kumo forms**

Use Kumo `Table`, built-in Input field API, Select, Switch/Checkbox, Dialog, Button, Badge, and feedback. Sort/reorder through explicit order controls; do not add a drag-and-drop framework in V1.

- [ ] **Step 4: Build Ads Manager and Media Library**

Ads list supports add/remove/activate/order/duration/schedule. Media Library supports upload, category filters, size display, and delete confirmation. Use Kumo Dialog for destructive actions.

- [ ] **Step 5: Build Preview and Publish flow**

Preview embeds kiosk in an iframe sized to the kiosk viewport using draft data. Publish panel shows current published version and whether draft changes exist, then invokes Publish only after Kumo confirmation Dialog.

- [ ] **Step 6: Build Settings and User controls**

Settings include session timeout, kiosk display name, kiosk status, last seen, active version, and storage summary. Admin-only account section supports user role/active state/Editor publish permission and password reset.

- [ ] **Step 7: Run Admin tests and build**

Run: `npm test --workspace @ads-kiosk/admin -- --run && npm run build --workspace @ads-kiosk/admin`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin
 git commit -m "feat: complete Kumo cms content workflows"
```

---

### Task 9: Custom Touch Kiosk UI and Session State

**Files:**
- Create: `apps/kiosk/package.json`
- Create: `apps/kiosk/tsconfig.json`
- Create: `apps/kiosk/vite.config.ts`
- Create: `apps/kiosk/index.html`
- Create: `apps/kiosk/src/main.tsx`
- Create: `apps/kiosk/src/ui/kiosk.css`
- Create: `apps/kiosk/src/session/sessionMachine.ts`
- Create: `apps/kiosk/src/ui/IdleScreen.tsx`
- Create: `apps/kiosk/src/ui/HomeScreen.tsx`
- Create: `apps/kiosk/src/ui/TimeoutWarning.tsx`
- Create: `apps/kiosk/src/content/WebsiteContent.tsx`
- Create: `apps/kiosk/src/content/PdfContent.tsx`
- Create: `apps/kiosk/src/content/QrContent.tsx`
- Create: `apps/kiosk/src/content/ImageContent.tsx`
- Create: `apps/kiosk/src/content/VideoContent.tsx`
- Create: `apps/kiosk/src/content/TextContent.tsx`
- Create: `apps/kiosk/src/ui/KioskApp.tsx`
- Create: `apps/kiosk/src/session/sessionMachine.test.ts`
- Create: `apps/kiosk/src/ui/KioskApp.test.tsx`

**Interfaces:**
- Session states are `idle | home | content | warning`.
- Any pointer/keyboard interaction calls `session.activity()`.
- `session.tick(now)` enters warning at `timeout - 10s`; no response at timeout resets to `idle` and clears transient content state.

- [ ] **Step 1: Write session and idle-to-home failing tests**

```ts
const session = createSessionMachine({ timeoutSeconds: 60, warningSeconds: 10 });
session.start(0);
session.activity(1_000);
expect(session.tick(51_000).state).toBe("warning");
expect(session.tick(61_000).state).toBe("idle");
```

```tsx
render(<KioskApp manifest={manifestFixture} />);
expect(screen.getByRole("button", { name: "Sentuh untuk Mulai" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Sentuh untuk Mulai" }));
expect(screen.getByText("Pilih layanan")).toBeInTheDocument();
```

- [ ] **Step 2: Run kiosk tests and verify failure**

Run: `npm test --workspace @ads-kiosk/kiosk -- --run`
Expected: FAIL because kiosk app does not exist.

- [ ] **Step 3: Implement the restrained visual system**

Use custom CSS with large typography, high-contrast touch targets, generous spacing, and minimal surface chrome. Do not use eyebrow text. Do not give each menu a decorative icon. Only universal controls such as Kembali/Beranda may use a functional icon.

- [ ] **Step 4: Implement Idle and Home screens**

Idle plays the active ad playlist fullscreen and keeps `Sentuh untuk Mulai` visible above it. Still images use configured duration; video advances on `ended`. Home lays out menu labels as large touch targets and uses text labels as primary information.

- [ ] **Step 5: Implement six content renderers**

- Website: sandboxed/controlled iframe plus always-available QR fallback and `Kembali ke Menu`; if loading fails/times out, show `Konten belum dapat dibuka`, `Coba Lagi`, and `Kembali ke Menu`.
- PDF: `react-pdf`, vertical pages, touch-size zoom in/out/reset, back action.
- QR: `qrcode.react`, large QR, title, instructions.
- Image: contain-fit media plus optional caption.
- Video: local media with play/pause/replay.
- Text: render constrained Markdown with raw HTML disabled.

- [ ] **Step 6: Implement timeout warning and session reset**

Warning copy is `Sesi akan berakhir dalam 10 detik` with `Lanjutkan`. Reset clears selected menu, website retry state, PDF scale/page state, video state, and any temporary form/history state before returning to idle.

- [ ] **Step 7: Run kiosk tests and build**

Run: `npm test --workspace @ads-kiosk/kiosk -- --run && npm run build --workspace @ads-kiosk/kiosk`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/kiosk
 git commit -m "feat: add touch-first kiosk experience"
```

---

### Task 10: Kiosk Offline Cache, Atomic Version Activation, Preview Source, and Heartbeat

**Files:**
- Create: `apps/kiosk/src/api/kioskClient.ts`
- Create: `apps/kiosk/src/offline/db.ts`
- Create: `apps/kiosk/src/offline/checksum.ts`
- Create: `apps/kiosk/src/offline/versionManager.ts`
- Create: `apps/kiosk/src/offline/versionManager.test.ts`
- Create: `apps/kiosk/src/sw.ts`
- Modify: `apps/kiosk/src/ui/KioskApp.tsx`
- Modify: `apps/kiosk/vite.config.ts`
- Create: `apps/server/src/routes/adminPreview.ts`
- Create: `apps/server/src/routes/adminPreview.test.ts`

**Interfaces:**
- `stageAndActivate(manifest): Promise<{ activated: boolean; version: number }>` is the single atomic content activation entry point.
- IndexedDB keys: `activeManifest`, `activeVersion`.
- Cache names: `content-v<version>`.
- Production kiosk client sends bearer device token; preview client uses Admin cookie + CSRF-safe GET to preview endpoint.

- [ ] **Step 1: Write interrupted-download atomicity failing test**

```ts
it("keeps version 1 active when any version 2 asset fails verification", async () => {
  await seedActiveVersion(1, manifestV1);
  mockFetchMedia(manifestV2.media[0], { ok: true, bytes: validBytes });
  mockFetchMedia(manifestV2.media[1], { ok: false });
  const result = await stageAndActivate(manifestV2);
  expect(result.activated).toBe(false);
  expect(await readActiveVersion()).toBe(1);
  expect(await caches.has("content-v1")).toBe(true);
});
```

- [ ] **Step 2: Run offline tests and verify failure**

Run: `npm test --workspace @ads-kiosk/kiosk -- --run src/offline/versionManager.test.ts`
Expected: FAIL because offline manager does not exist.

- [ ] **Step 3: Implement checksum-verified staging**

For every manifest media entry, fetch the response, verify HTTP success, byte length, and SHA-256 with `crypto.subtle.digest`, then store a cloned Response in `content-vN`. On any failure, delete `content-vN` and leave IndexedDB active pointer untouched.

- [ ] **Step 4: Implement atomic activation and stale-cache cleanup**

After every required asset verifies, write `activeManifest` and `activeVersion` in one IndexedDB transaction. Only then remove content caches older than the active and immediately previous version. Request persistent browser storage when available.

- [ ] **Step 5: Add app-shell service worker and startup fallback**

Configure `vite-plugin-pwa` with an inject-manifest service worker for app-shell assets. On startup, attempt network manifest sync; if unavailable, load `activeManifest` from IndexedDB and all local content from Cache Storage.

- [ ] **Step 6: Add preview data source and heartbeat**

`?preview=1` uses `/api/v1/admin/preview-manifest` and disables persistent version activation. Production mode sends heartbeat every 30 seconds with software version, active content version, and last sync status.

- [ ] **Step 7: Run offline + server preview tests**

Run: `npm test --workspace @ads-kiosk/kiosk -- --run && npm test --workspace @ads-kiosk/server -- --run src/routes/adminPreview.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/kiosk apps/server/src/routes/adminPreview*
 git commit -m "feat: add offline-safe kiosk version activation"
```

---

### Task 11: Production Static Serving, Security Headers, Windows Operation, and Backup Docs

**Files:**
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/src/config/paths.ts`
- Create: `apps/server/src/services/backupService.ts`
- Create: `apps/server/src/scripts/backup.ts`
- Create: `apps/server/src/scripts/restore.ts`
- Create: `docs/operations/windows-deployment.md`
- Create: `docs/operations/backup-restore.md`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Production server serves Admin at `/admin/`, Kiosk at `/kiosk/`, APIs at `/api/v1/`, and media at `/media/`.
- Backup script creates a timestamped directory containing one SQLite snapshot, media tree, and a sanitized deployment-config template; it never copies logs or secret values.

- [ ] **Step 1: Write static-route and backup consistency failing tests**

Test that production-mode app returns Admin/Kiosk index files, API routes remain API responses, missing assets do not fall through to the wrong SPA, and backup creates both database and media snapshot under one backup ID.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test --workspace @ads-kiosk/server -- --run`
Expected: FAIL for missing production/backup behavior.

- [ ] **Step 3: Add production builds and static serving**

Root `npm run build` builds shared, Admin, Kiosk, then Server. Server uses explicit static roots and SPA fallbacks only under `/admin/*` and `/kiosk/*`.

- [ ] **Step 4: Add security headers and network-safe defaults**

Use `@fastify/helmet` with separate CSP behavior for Admin and Kiosk. Keep frame policies compatible with Admin preview iframe but do not weaken third-party frame protections. Default `HOST=127.0.0.1` in `.env.example`; deployment docs explain that binding to internal interfaces and Windows Firewall allowlists must be configured by the BRIN environment, not hardcoded.

- [ ] **Step 5: Add logs and Windows auto-start instructions**

Use rotating local log files plus console output. Document Task Scheduler setup: trigger `At startup`, action `node <absolute-path>\apps\server\dist\index.js`, working directory repository deployment path, restart on failure, and run under the approved service account. Do not require Docker.

- [ ] **Step 6: Implement consistent backup/restore**

Use SQLite backup API/transaction-safe snapshot, then copy the media directory into the same backup ID. Restore requires the server stopped, validates expected files, restores DB and media together, and refuses to restore into a running process lock.

- [ ] **Step 7: Run production build and tests**

Run: `npm run build && npm test -- --run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server docs package.json .env.example README.md
 git commit -m "ops: add Windows production and recovery workflow"
```

---

### Task 12: Browser End-to-End Coverage and Release Gate

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/admin.spec.ts`
- Create: `tests/e2e/kiosk.spec.ts`
- Create: `tests/e2e/offline.spec.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- CI is the release gate: install from lockfile, typecheck, unit/integration tests, production build, then Chromium E2E.

- [ ] **Step 1: Write the happy-path E2E**

Automate: Admin login → edit one seeded menu to text content → upload an image ad → Preview → Publish → kiosk sync → `Sentuh untuk Mulai` → Home → open edited menu → return → timeout warning → idle.

- [ ] **Step 2: Write offline/update E2E cases**

Cover all required cases from the spec:

1. valid new version activates;
2. one staged asset fails and previous version remains active;
3. CMS/server becomes unavailable while kiosk runs;
4. browser reload while server is unavailable uses the last cached version;
5. restored server completes sync;
6. invalid media is rejected;
7. production process can be restarted and health endpoint returns OK.

Use Playwright request interception for deterministic asset failure/offline simulation. The Windows Task Scheduler step remains a documented manual acceptance test because CI is not the BRIN workstation.

- [ ] **Step 3: Run E2E locally against production build**

Run: `npm run build && npm run test:e2e`
Expected: PASS in Chromium.

- [ ] **Step 4: Add GitHub Actions CI**

CI steps must be `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run build`, install Playwright Chromium, then `npm run test:e2e`. Do not inject production secrets; tests bootstrap temporary credentials/databases.

- [ ] **Step 5: Run full release verification**

Run:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests playwright.config.ts .github README.md
 git commit -m "test: add end-to-end release gate"
```

---

## Self-Review Against the Spec

- CMS uses actual Kumo components and documented Kumo/Tailwind integration: Tasks 7–8.
- One Windows server process, no Docker: Tasks 1–3 and 11.
- Local SQLite + filesystem media, no secrets/internal IPs in Git: Tasks 2, 4, 11.
- Dashboard, Menu & Konten, Ads, Media, Preview, Settings, Admin/Editor: Tasks 5, 7–8.
- Six kiosk content types: Tasks 1, 5, 9.
- `Sentuh untuk Mulai`, restrained kiosk visuals, timeout warning/reset: Task 9.
- Draft vs Publish, immutable manifests, rollback: Tasks 5–6.
- Offline media cache and atomic activation: Task 10.
- Media magic-byte validation/checksums: Task 4.
- Server sessions, CSRF, rate limiting, roles, audit: Task 3.
- Kiosk device credential and heartbeat: Task 6 and Task 10.
- Windows auto-start, logs, backup/restore: Task 11.
- Required unit/API/frontend/offline/end-to-end coverage: Tasks 1–12.
- V1 non-goals remain excluded.

No implementation step may add committed internal network addresses or deployment secrets. Any discovered requirement that needs such a value must become an environment/deployment setting instead.
