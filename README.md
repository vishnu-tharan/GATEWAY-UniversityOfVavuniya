# University of Vavuniya Gateway

**One campus. Three gates. One connected workspace.**

Gateway is a campus vehicle-access and equipment gate-pass application for the **University of Vavuniya**. A shared **React Native + Expo** interface runs on **web, Android and iOS**, with an **Express + MongoDB** backend enforcing permissions and recording operational activity.

Gate officers record arrivals and departures, faculty administrators review equipment requests, and campus administrators manage accounts and access. The interface includes editable profiles, QR staff passes, searchable vehicle history, PDF reports, and session controls.

**Version:** 2.0.0 · **Status:** runnable development application; production and physical-device checks remain. See [verification details](VERIFICATION.md).

[Quick start](#run-a-safe-local-preview) · [Features and roles](#features-and-access) · [Mobile setup](#android-and-ios) · [Security](SECURITY.md) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

## Get the source

```sh
git clone https://github.com/vishnu-tharan/GATEWAY-UniversityOfVavuniya.git
cd GATEWAY-UniversityOfVavuniya
```

This repository contains the current application source, lockfiles, tests, and configuration templates. Real credentials, installed dependencies, database files, and generated builds are excluded. No history from another repository is imported.

## Technology and project layout

| Layer | Technology |
|---|---|
| Shared client | React Native 0.83, React 19, Expo SDK 55, React Native Web |
| API | Node.js 22+, Express 4, Mongoose 9 |
| Data | MongoDB 8, indexed active visits, expiring sessions |
| Authentication | Hashed opaque sessions, HttpOnly web cookies, native SecureStore |
| Reports and passes | jsPDF on web, Expo Print/Sharing on native, QR generation and scanning |
| Verification | Node test runner, Supertest, temporary MongoDB, ESLint, Expo exports |

```text
backend/
  src/                  API routes, models and input validation
  middleware/           Session authentication and role checks
  scripts/              Migration and account recovery tools
  test/                 Security, workflow and migration tests
  demo.js               Isolated preview with temporary sample data
frontend/
  App.jsx               Responsive application shell and sign-in
  src/                  Shared screens, UI, API client and PDF exports
  app.json              Expo platform configuration
  eas.json              Preview and production build profiles
docs/ARCHITECTURE.md     Data flow and design decisions
Start-Gateway.ps1        Windows installation, launch and verification helper
```

## Run a safe local preview

Requires Node.js 22.13+ (Node 22.14 was used here). On Windows, the included launcher also works around a broken global npm launcher.

```powershell
.\Start-Gateway.ps1 install
.\Start-Gateway.ps1 demo
```

The demo starts an **isolated temporary MongoDB** and prints three preview account emails and a newly generated password. It uses the installed MongoDB 8.0 binary when available; otherwise it downloads a test binary. It does not load your `.env`, use your real database, or send emails. Demo data disappears when the process stops. It binds the API to localhost only.

In another terminal:

```powershell
.\Start-Gateway.ps1 web
```

Open [Gateway web](http://localhost:8081). Use `admin@preview.test`, `dean@preview.test`, or `officer@preview.test` with the password printed in the demo terminal. Stop each process with Ctrl+C. Do not run demo and the real API on port 5000 simultaneously.

## Run against your database

1. Start MongoDB 8 locally or configure an authenticated MongoDB deployment.
2. Copy `backend/.env.example` to `backend/.env` **only if you do not already have one**. Set `MONGO_URI` and `WEB_ORIGINS` (comma-separated exact browser origins).
3. If upgrading old data, follow the migration section below before starting the API.
4. Set a new administrator email and strong password through `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend environment. Run `node seed.js` from `backend`. Seeding creates one campus administrator and never deletes existing accounts. Remove `ADMIN_PASSWORD` after use.
5. Start the API with `.\Start-Gateway.ps1 api`, then the web app with `.\Start-Gateway.ps1 web`.
6. Sign in as campus administrator and create faculty administrators and gate officers under **Accounts**.

Standard npm commands also work from each package: `npm ci`; backend `npm start`, `npm run demo`, `npm test`; frontend `npm run web`, `npm start`, `npm run build`, `npm run build:mobile`, `npm run lint`.

For macOS/Linux or a standard Node installation, run the following in separate terminals:

```sh
# Terminal 1: isolated preview API
cd backend
npm ci
npm run demo

# Terminal 2: web client, starting from the repository root
cd frontend
npm ci
npm run web
```

The first demo/test run may download MongoDB if a compatible binary is not configured. Set `MONGOMS_SYSTEM_BINARY` to an installed `mongod` executable to use it instead.

### Android and iOS

Copy `frontend/.env.example` to `frontend/.env` and set `EXPO_PUBLIC_API_URL` to the API address reachable by your device. Use your computer's LAN IP for a physical phone, `http://10.0.2.2:5000` for the Android emulator, or a production HTTPS address. `localhost` on a phone points to the phone, not your PC. Run the real development API on the LAN; the isolated demo intentionally listens only on loopback.

Run `npm start` in `frontend` and open a matching Expo SDK 55 client or development build. Camera permission is requested only when scanning a pass. iOS native builds require macOS/Xcode or Expo EAS; Windows can export the iOS JavaScript/Hermes bundle but cannot build an App Store archive locally.

`eas.json` includes a preview Android APK profile and a production profile. Configure your Expo account, signing credentials, API environment, and institution-owned app identifiers before `eas build --platform android --profile preview` or store builds. No store submission or signed binary was made here.

## Features and access

| Feature | Gate officer | Faculty administrator | Campus administrator |
|---|---|---|---|
| Dashboard and vehicle search | All gates | Own faculty | All faculties |
| Visitor entry / rapid staff lookup / QR scan | Yes | No | No |
| Equipment approval / rejection | No | Own faculty | All faculties |
| Exit and equipment verification | Yes | No | No |
| Staff registration, editing, revocation, QR pass | Lookup only | Own faculty | All faculties |
| Date-filtered PDF reports | No | Own faculty | All faculties |
| Account creation, assignments, disabling | No | No | Yes |
| Profile, password change, session revocation | Own account | Own account | Own account |
| Audit history | No | Own faculty | All events |

Vehicles carrying equipment are recorded as inside with approval pending, matching the original operational model. They cannot exit until approved. Rejected requests can be resubmitted by security with revised notes. Equipment must be checked and verification recorded at exit. Entry and exit can occur at different gates. A QR code is a staff lookup identifier, not proof of identity or permission to remove equipment.

PDF exports contain all pages matching the applied filters, up to 3,000 movements per export. Use smaller date ranges for larger histories. Reports display local device time; dashboard “today” uses UTC and is labeled accordingly. Staff listing currently returns up to 1,000 entries; audit history shows the latest 100 events. Vehicle records use server-side pages of 30.

## Security changes

- Random 256-bit session tokens, stored only as SHA-256 hashes in MongoDB; 8-hour expiry enforced on every request.
- Web sessions use HttpOnly, SameSite=Strict cookies (Secure in production). Native sessions use Expo SecureStore. Old browser localStorage tokens are removed.
- Password hashing with bcrypt cost 12; new passwords require 12+ characters, uppercase, lowercase and a number, capped at bcrypt's 72-byte limit.
- Server-side roles, faculty restrictions, safe field allowlists, bounded JSON bodies, exact origin allowlist, custom-header CSRF protection, security headers, and rate limits.
- Five failed account logins cause a 15-minute lockout; IP-based rate limiting also applies. Disabled accounts lose access immediately.
- Password changes revoke all sessions. Profile edits cannot change email, role, faculty, gate, or permissions.
- Unique active-visit database index prevents simultaneous duplicate entries. Atomic updates prevent double exits and conflicting approval decisions. Timestamps, gate identity and approving actor come from the server.
- Persistent audit events for successful account and operational changes; no secrets, passwords or session tokens are written to audit events.
- Notification email is optional. SMTP failures do not remove successful entries or decisions. In-app state is authoritative; delivery is not guaranteed or queued for retry.

Production must use HTTPS and a same-site API/web deployment (for example `gateway.example.edu` and `api.example.edu`, both HTTPS). Set `NODE_ENV=production` and explicit `WEB_ORIGINS`. `EXPO_PUBLIC_*` variables are public build settings; never put secrets there. Only enable `TRUST_PROXY=1` behind exactly one trusted proxy. Restrict MongoDB network access, enable authentication and encrypted backups, and set an institutional retention policy for visitor identity data. Do not expose a development Expo server publicly.

Current rate-limit storage is process-local; use a shared rate-limit store before scaling to multiple API processes. Database changes and audit inserts are separate writes; use MongoDB transactions/outbox plus external tamper-resistant audit storage for stronger compliance guarantees. MFA/SSO, self-service password recovery, offline mutations, push notifications, and automatic email retries are not implemented. Avoid offline entry/exit writes because they can conflict with approval and occupancy state.

## Upgrade existing data carefully

Back up MongoDB and stop the old API first. Do not guess the date format used by the old server: it stored locale-formatted strings, which can be ambiguous.

From `backend`, set `LEGACY_DATE_ORDER` to `MDY` or `DMY` and `LEGACY_UTC_OFFSET` to the old server's offset (Sri Lanka: `+05:30`). Run:

```text
node scripts/migrate.js
node scripts/migrate.js --apply
```

The first command is a dry run. Both refuse to apply if duplicate active visits, duplicate pass IDs, duplicate normalized emails, or unparseable timestamps are found. Resolve those records using institution-approved source records, then repeat. The apply command normalizes vehicle numbers/emails, converts dates to ISO, disables known original `123` password accounts or malformed hashes, and invalidates sessions. It preserves vehicle history and existing identities. It is a maintenance operation, not a transactional migration; keep a backup and the API stopped until it finishes.

Startup deliberately fails if the active-vehicle unique index cannot be created. Do not remove that index to bypass duplicate-data errors.

To recover an account, set `RESET_EMAIL` and a strong `RESET_PASSWORD`, then run `node scripts/reset-password.js` from `backend`. This trusted maintenance command re-enables the named account, changes its password, revokes sessions, and records an audit event. Remove the environment password afterward. Never retain the old default credentials in a live deployment.

## Verification

Run `.\Start-Gateway.ps1 test` and `.\Start-Gateway.ps1 build`. API tests use their own temporary MongoDB and never load the application's `.env`. Set `MONGOMS_SYSTEM_BINARY` if MongoDB is installed at another location.

See [verification notes](VERIFICATION.md) for what was actually checked and what still requires your deployment/devices. The implementation follows [Expo's universal web setup](https://docs.expo.dev/workflow/web/) and uses [Expo SecureStore](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/) for native credential storage.

The web export is written to `frontend/dist`; Android/iOS bundles are written separately to `frontend/dist-mobile`. A bundle export is not a signed APK/IPA or a store release.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes. Use [repository issues](https://github.com/vishnu-tharan/GATEWAY-UniversityOfVavuniya/issues) for reproducible bugs and feature requests, with sensitive visitor information removed. Report security problems privately as described in [SECURITY.md](SECURITY.md).

Future options such as university SSO/MFA, visitor appointments and reliable email retries are documented in [VERIFICATION.md](VERIFICATION.md). They are not presented as implemented features.
