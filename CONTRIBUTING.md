# Contributing to Gateway

## Work locally

1. Clone this repository and create a branch for a focused change.
2. Install dependencies with `npm ci` in `backend` and `frontend`, or run `./Start-Gateway.ps1 install` on Windows.
3. Use `npm run demo` in `backend` for disposable local data. Run `npm run web` in `frontend` for the browser interface.
4. Follow [README.md](README.md) when a physical device or a persistent database is needed.

The isolated preview creates synthetic accounts and prints a generated password. It never loads the real backend environment file. Do not replace this isolation with production credentials or visitor records.

## Validate changes

```sh
# From backend/
npm test

# From frontend/
npm run lint
npm run build
npm run build:mobile
```

Tests require a temporary MongoDB executable; use `MONGOMS_SYSTEM_BINARY` when one is already installed. Native bundle exports require the platform's Hermes compiler to be executable. Camera, native credential storage and sharing changes also require checks on real Android/iOS devices.

Use `npm audit` in each package after dependency changes. Keep `package-lock.json` synchronized with the corresponding manifest. The scoped dependency overrides are explained in [VERIFICATION.md](VERIFICATION.md); review compatibility before changing them.

## Pull requests

- Explain the user-visible problem, changed behavior and verification results.
- Keep security and permission checks on the server, even when the interface hides an action.
- Preserve server-owned timestamps, gate assignments, approving identities and active-visit uniqueness.
- Include migrations and operational notes for database changes. Do not run migrations against live data as part of a test.
- Include screenshots for visual changes using synthetic data only.
- Do not commit `.env`, `node_modules`, generated build folders, database files or identifying visitor information.

Use descriptive commits grouped around actual functionality or documentation. Do not claim a native build, production deployment, or external integration was tested unless it was performed.

## Reporting bugs

Include the platform, relevant package versions, steps to reproduce, expected behavior and a redacted error message. For security-sensitive reports, follow [SECURITY.md](SECURITY.md) instead of posting exploit details or credentials publicly.
