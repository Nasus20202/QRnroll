## QRnroll

Mobile-first QR scanner built with TanStack Start and Cloudflare Workers. It saves scanned codes to KV with a short TTL, lists live codes, and auto-opens the latest codes on the `/enroll` page.

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

### Deploy (Cloudflare Workers)

```bash
pnpm run build && pnpm wrangler deploy
```

### Key routes

- `/` – scanner + live list
- `/enroll` – polls valid codes and opens them in new tabs
- `/enroll/test` – pop-up permission check

### Notes

- Requires KV binding `CODES` (see `wrangler.jsonc`).
- Pop-up blockers can stop `/enroll` from opening codes; allow pop-ups for this site.
