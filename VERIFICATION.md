# Verification and remaining deployment checks

## Checked locally

- 20 passing tests (19 API integration tests and one migration test) against a separate temporary real MongoDB, including authorization, faculty isolation, browser cookies, native token revocation, request forgery protection, malicious input, password lockout, active-visit uniqueness, concurrent writes, equipment approval/exit restrictions, staff CRUD, profile privilege protection, session expiration, audit scoping, and date validation.
- Legacy timestamp conversion test: explicit date order and timezone required; invalid calendar dates refused.
- ESLint for all active client source.
- Expo production web export and Android/iOS Hermes bundle exports.
- Dependency audits for both packages. Registry advisory checks reported zero known vulnerabilities after updates (2026-09-10). This is not a guarantee that no vulnerabilities exist.
- Browser review of the real app connected to an isolated local preview API: login and restored sessions, live dashboard values, profile update, equipment approval, officer vehicle entry/exit, navigation, and responsive profile layout at 390px.
- Browser PDF download generated successfully; the downloaded PDF was checked for its PDF header, matching vehicle, four-record total, and confidentiality footer.

## Before live use

- Test camera permissions, QR scanning, SecureStore restore, native keyboard behavior, PDF sharing and accessibility on your actual Android and iOS devices. Successful bundle export does not replace device tests or produce a signed APK/IPA.
- Confirm SMTP settings and real email delivery. Development verification sent no real emails.
- Back up and migrate existing data, reset short/default legacy passwords, create the campus administrator, and review gate/faculty assignments.
- Verify HTTPS, cookie behavior, exact CORS origins, authenticated MongoDB, reverse proxy settings, encrypted backups and restores on the deployment environment.
- Institution-specific rules still require review: whether entry occurs before equipment approval, who can approve the “Other” destination, visitor identity retention, and emergency procedures. Pending/rejected equipment exits are blocked; there is no emergency bypass.
- PDF report totals may change if staff add records during multi-page export; use a quiet reporting period or implement snapshot-based server reports for formal reconciliations.

## Dependency decisions

- Expo SDK 55 with its declared React Native 0.83.10 / React 19.2.0 compatibility versions.
- Nodemailer upgraded to 10.0.3 to resolve reported advisories.
- `qs` overridden to patched 6.16.x for Express's dependency tree.
- Expo's Xcode parser uses only `uuid.v4()`; scoped `xcode -> uuid` override to 11.1.x removes the older vulnerable dependency while retaining CommonJS support. Mobile bundle exports pass; native project generation still needs validation on the build service/Mac.

## Sensible next additions

1. University SSO with MFA and centrally managed account recovery.
2. An email outbox with retries and visible delivery status.
3. Visitor appointments and expiring invitations tied to a host.
4. Equipment inventory/serial-number matching with approval attachments.
5. Configurable retention and redacted reports for operational versus compliance users.
6. Tamper-resistant external audit storage and database transactions for audited changes.

These are follow-up features, not active functionality in this version.
