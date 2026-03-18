# QRnroll – Agent Guide

## What is this project?

QRnroll is a mobile-first, full-stack QR code attendance scanner built with **TanStack Start** and
**React 19**. Users open the app on a phone or laptop, point their camera at a room QR code, and
attendance is recorded instantly. The `/enroll` page polls for newly scanned codes and auto-opens
them in new browser tabs, making bulk enrolment hands-free.

Key runtime characteristics:

- **In-memory store** with a 60-second TTL – no database, resets on restart.
- **Live code list** on the scanner page (polled every second).
- Optional **webhook fan-out** (Discord-compatible) for each scanned code.

---

## Tech stack

| Layer | Tool |
|---|---|
| Package manager | **pnpm** – always use `pnpm` (never `npm` or `yarn`) |
| Framework | **TanStack Start** (SSR-capable, file-based routing via TanStack Router) |
| Build | **Vite** (with `@tailwindcss/vite` and `@tanstack/router-plugin`) |
| Language | TypeScript – strict mode, no `any` |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| QR scanning | `@zxing/browser` – `BrowserMultiFormatReader.decodeFromStream` |
| Testing | **Vitest** + `@testing-library/react` (jsdom environment) |
| Linting | **ESLint** (via `@tanstack/eslint-config`) |
| Formatting | **Prettier** (single quotes, no semicolons, trailing commas) |

---

## Project structure

`src/` is organised into four top-level directories:

- **`components/`** – Presentational UI components.
- **`pages/`** – Page-level components that own business logic and compose child components.
- **`lib/`** – Pure, framework-agnostic utilities (KV store, webhook fan-out, …).
- **`server/`** – TanStack Start server functions (run on the server, called from the client).
- **`routes/`** – File-based route definitions; thin wrappers that mount the matching page component.

---

## Running the project locally

```bash
pnpm install
pnpm dev        # starts Vite dev server
pnpm build      # production build
pnpm preview    # preview production build
```

---

## Code quality

### Conventional Commits

All commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types: feat | fix | refactor | test | chore | docs | style | perf | ci
```

Examples:
- `feat(scanner): add hardware zoom control`
- `fix(kv): prevent race condition in TTL pruning`
- `test(CameraPanel): cover zoom slider interaction`

### ESLint

```bash
pnpm lint       # check
pnpm check      # auto-fix (prettier --write + eslint --fix)
```

Key rules: `@typescript-eslint/no-explicit-any` is an **error** – do not use `any`.

### Prettier

```bash
pnpm format     # check formatting
```

Config: no semicolons, single quotes, trailing commas everywhere.

---

## Testing

**Test coverage is a first-class requirement.** Every new feature or bug fix must come with
corresponding tests. Tests live alongside the code they cover in `__tests__/` subdirectories.

```bash
pnpm test               # run all tests once (CI mode)
```

### Testing philosophy

- **Unit tests** for pure utilities (`lib/`).
- **Component tests** for presentational components (`components/__tests__/`).
- **Integration tests** for page-level components that combine state + effects + child
  components (`pages/__tests__/`).

### Mocking patterns

- Mock `@zxing/browser` (`BrowserMultiFormatReader`) to capture decode callbacks and trigger
  synthetic scans.
- Mock `navigator.mediaDevices` (`getUserMedia`, `enumerateDevices`) for camera permission
  flows.
- Use `waitFor` from `@testing-library/react` for async state updates.

---

## Camera / hardware access

The QR scanning pipeline:

1. `getUserMedia` – request permission, prefer rear camera (`facingMode: environment`).
2. `enumerateDevices` – list all video input devices.
3. Inspect `getCapabilities().zoom` on the active video track to choose a zoom path:
   - **Hardware zoom** (`zoom` capability present): feed the raw `MediaStream` directly to
     `BrowserMultiFormatReader.decodeFromStream`; zoom changes call
     `track.applyConstraints({ advanced: [{ zoom }] })`.
   - **Software zoom** (default, always available): an off-screen `<video>` receives the raw
     stream; an `rAF` draw-loop crops each frame onto a `<canvas>` using the current zoom
     factor (centre-crop + scale-up); `canvas.captureStream(30)` is passed to
     `decodeFromStream` so ZXing genuinely reads the zoomed region, not just a CSS effect.
4. The zoom slider (1–5× software range, or hardware range when available) is always visible.
   A `"1.4×"` label next to the slider shows the active zoom factor.

When adding new camera-related features, always handle the case where a capability is not
supported (graceful no-op).

---

## Keeping this file up to date

`AGENTS.md` is the primary reference for anyone (human or AI agent) working on this codebase.
**Update it whenever you make a change that affects how the project is understood or worked on** –
new tools, changed conventions, new architectural patterns, or significant feature additions.
Do not let it drift out of sync with the code.
