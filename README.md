## QRnroll

Mobile-first QR scanner built with TanStack Start. It uses an in-memory store with a short TTL, lists live codes, and auto-opens the latest codes on the `/enroll` page. Optional webhooks can fan out scans (e.g., to Discord) via `WEBHOOK_URLS`.

### Run locally

```bash
pnpm install
pnpm dev
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Docker

Build and run with Docker/Compose (exposes on 8080):

```bash
docker compose up --build
```

### Environment

- `WEBHOOK_URLS` (optional): comma-separated webhook endpoints for scan notifications.
  - Example: `WEBHOOK_URLS=https://discord.com/api/webhooks/...`
- `TRACKING_SCRIPT` (optional): raw `<script>` snippet injected into the app shell.
  - Example: `TRACKING_SCRIPT='<script src="https://app.rybbit.io/api/script.js" data-site-id="abc" defer></script>'`

### Key routes

- `/` – scanner + live list
- `/enroll` – polls valid codes and opens them in new tabs

### Notes

- Storage is in-memory; data resets on restart.
- Pop-up blockers can stop `/enroll` from opening codes; allow pop-ups for this site.
- `/enroll` can display browser notifications (with the app icon) once users grant permission.
