# Repository Guidelines

## Project Structure & Module Organization
Core service code lives in `src/`:
- `src/index.js`: bootstrap and lifecycle orchestration.
- `src/gateway/`: Socket.IO gateway, auth, and event handling.
- `src/web/`: Admin web server, REST routes, middleware, and web socket helpers.
- `src/renderer/`: Playwright-based HTML-to-PDF/JPEG rendering.
- `src/printer/`, `src/jobs/`, `src/maintenance/`, `src/utils/`: printing, queue/storage, ops tasks, shared utilities.
- `src/public/`: admin static assets (`css/`, `js/`, `vendor/`).

Operational docs are in `docs/` (`ops.md`, `protocol.md`). Deployment assets are in `deploy/` (`Dockerfile`, `docker-compose.yml`, `install.sh`, `hiprint-agent.service`). Runtime data defaults to `data/` and logs to `logs/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npx playwright install chromium`: install local browser runtime needed by renderer.
- `npm start`: run the agent (`node src/index.js`).
- `docker-compose -f deploy/docker-compose.yml up -d`: run with Docker for integration checks.

Use Node.js `>=20` (see `package.json` engines).

## Coding Style & Naming Conventions
This project uses ES modules (`import`/`export`) with `.js` files, 2-space indentation, semicolons, and single quotes. Match existing conventions:
- Filenames: lowercase, kebab-case for multiword files (for example, `transit-client.js`).
- Factories: `createXxx` naming (for example, `createGateway`, `createJobManager`).
- Keep module responsibilities narrow; prefer small composable services over large mixed modules.

No ESLint/Prettier config is currently enforced; keep diffs minimal and consistent with surrounding code.

## Testing Guidelines
There is no committed automated test framework yet. Validate changes with focused manual smoke checks:
1. Start service and confirm health: `curl http://localhost:17522/health`
2. Verify printer/admin endpoints: `curl http://localhost:17522/api/printers`
3. For protocol changes, verify Socket.IO behavior against `docs/protocol.md`.

If adding tests, place them under `tests/` and use `*.test.js` naming.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits with scope, e.g. `feat(printer): ...`, `fix(maintenance): ...`, `chore(deps): ...`. Use the same format:
- `<type>(<scope>): <short summary>`

PRs should include:
- clear purpose and impacted modules,
- linked issue/task,
- manual verification steps and outputs,
- UI screenshots/GIFs when `src/public/` is changed.

## Security & Configuration Tips
Never commit real tokens or plaintext credentials. Keep `config.json` values environment-specific (not production secrets), review `token`, `ipWhitelist`, and admin credentials before deployment.
