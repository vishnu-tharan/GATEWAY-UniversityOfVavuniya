# Security and deployment

## Credentials and repository boundaries

This repository publishes the current application without importing another repository's commit history. Real `.env` files, tokens, database contents and installed dependencies are excluded from version control. Only `.env.example` configuration templates are included.

Use the committed `.env.example` files as configuration templates. Keep real values outside version control. **Rotate any credentials previously exposed in another repository or shared copy before using them here.** Publishing a new repository does not revoke those credentials or remove copies elsewhere.

## Deploying this version

See [README.md](README.md) for HTTPS, database configuration, account provisioning, migration and session controls. See [VERIFICATION.md](VERIFICATION.md) for tested behavior and remaining device/deployment checks. Do not deploy the isolated preview mode as a live campus system.

## Reporting issues

Report suspected security issues privately to the repository owner. Do not include live credentials, visitor identity records or session tokens in public issues. Rotate exposed credentials immediately and retain relevant audit records for investigation.
