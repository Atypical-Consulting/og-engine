# Deployment Guide

## Environments

| Environment | App | Trigger | Config |
|-------------|-----|---------|--------|
| Staging | `og-engine-staging` | Push to `dev` branch (via CI) | `fly.staging.toml` |
| Production | `og-engine` | Push a version tag `v*` (via CI) | `fly.toml` |

> **Key rule:** Merging to `dev` deploys automatically to staging only. Production requires a deliberate version tag (`git tag v1.2.3 && git push --tags`).

---

## Branch Protection

Configure the following rules in **GitHub → Settings → Branches** for the `dev` branch:

- Require pull request before merging (1 approval)
- Require status checks to pass: **CI / Lint, Type-check & Test**
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

This ensures no direct pushes reach `dev` without a passing CI build and peer review.

---

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated
- A Fly.io Tigris object storage bucket (S3-compatible)

## Initial Setup

### 1. Create the Tigris Bucket

```bash
fly storage create
```

Note the bucket name and credentials output. You'll need them in the next step.

### 2. Set Required Secrets

```bash
# Core secrets
fly secrets set STRIPE_SECRET_KEY=sk_live_...
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_...
fly secrets set STRIPE_PRICE_STARTER=price_...
fly secrets set STRIPE_PRICE_PRO=price_...
fly secrets set STRIPE_PRICE_SCALE=price_...
fly secrets set RESEND_API_KEY=re_...

# Admin cron authentication (generate a random secret)
fly secrets set ADMIN_CRON_SECRET=$(openssl rand -hex 32)

# Admin email for backup failure alerts
fly secrets set ADMIN_EMAIL=admin@example.com

# Tigris / S3 object storage (from `fly storage create` output)
fly secrets set TIGRIS_ACCESS_KEY_ID=tid_...
fly secrets set TIGRIS_SECRET_ACCESS_KEY=tsec_...
fly secrets set TIGRIS_BUCKET_NAME=your-bucket-name
# TIGRIS_ENDPOINT_URL defaults to https://fly.storage.tigris.dev
# TIGRIS_REGION defaults to auto
```

### 3. Set GitHub Actions Secrets

In your GitHub repository → Settings → Secrets and variables → Actions, add:

| Secret | Description |
|--------|-------------|
| `ADMIN_CRON_SECRET` | Same value as the Fly.io secret |
| `RESEND_API_KEY` | Same Resend API key |
| `ADMIN_EMAIL` | Admin email for failure alerts |

### 4. Deploy

```bash
fly deploy
```

---

## Staging Environment Setup

Run these steps once to bootstrap the `og-engine-staging` Fly.io app.

### 1. Create the app

```bash
fly apps create og-engine-staging
```

### 2. Create a persistent volume (same region as production)

```bash
fly volumes create og_engine_staging_data --region cdg --size 1 -a og-engine-staging
```

### 3. Set staging secrets

Use **test-mode** Stripe keys and a separate Tigris bucket:

```bash
fly secrets set -a og-engine-staging \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_test_... \
  STRIPE_PRICE_STARTER=price_test_... \
  STRIPE_PRICE_PRO=price_test_... \
  STRIPE_PRICE_SCALE=price_test_... \
  RESEND_API_KEY=re_... \
  ADMIN_CRON_SECRET=$(openssl rand -hex 32) \
  ADMIN_EMAIL=admin@example.com \
  TIGRIS_ACCESS_KEY_ID=tid_... \
  TIGRIS_SECRET_ACCESS_KEY=tsec_... \
  TIGRIS_BUCKET_NAME=og-engine-staging-backups
```

### 4. Add GitHub Actions secret

In **GitHub → Settings → Secrets → Actions**, add:

| Secret | Description |
|--------|-------------|
| `FLY_API_TOKEN_STAGING` | Fly.io API token scoped to the staging app |

> The production `FLY_API_TOKEN` secret already exists. The staging workflow uses the separate `FLY_API_TOKEN_STAGING` secret to limit blast radius.

### 5. Initial deploy

```bash
fly deploy --config fly.staging.toml
```

After this first manual deploy, all subsequent deploys happen automatically via CI on every push to `dev`.

---

## Releasing to Production

1. Ensure all desired changes are merged to `dev` and staging is healthy.
2. Tag the commit:

```bash
git checkout dev
git pull
git tag v1.2.3
git push origin v1.2.3
```

3. CI runs `check` and then `deploy-production`, deploying to `og-engine` on Fly.io.

---

## Database Backup Strategy

OG Engine uses SQLite on a Fly.io persistent volume (`/data/og-engine.db`).
A daily automated backup job copies the database to Tigris object storage.

### How It Works

1. **GitHub Actions** triggers a `POST /admin/backup-db` request daily at **02:00 UTC**.
2. The app runs `VACUUM INTO '/tmp/backup-<timestamp>.db'` — an online, WAL-safe SQLite snapshot.
3. The snapshot is uploaded to Tigris under the key `backups/og-engine-<timestamp>.db`.
4. Backups older than **7 days** are automatically pruned.
5. If the backup fails, an alert email is sent via Resend to `ADMIN_EMAIL`.

### Manual Trigger

```bash
curl -X POST https://og-engine.com/admin/backup-db \
  -H "Authorization: Bearer $ADMIN_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "key": "backups/og-engine-2026-04-16T02-00-00.db",
  "sizeBytes": 1048576,
  "pruned": [],
  "timestamp": "2026-04-16T02:00:05.123Z"
}
```

### List Available Backups

Using the AWS CLI (works with Tigris):

```bash
AWS_ACCESS_KEY_ID=$TIGRIS_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$TIGRIS_SECRET_ACCESS_KEY \
aws s3 ls s3://$TIGRIS_BUCKET_NAME/backups/ \
  --endpoint-url https://fly.storage.tigris.dev
```

---

## Restore Procedure

### Step 1 — Download a Backup

```bash
# List backups to find the target
AWS_ACCESS_KEY_ID=$TIGRIS_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$TIGRIS_SECRET_ACCESS_KEY \
aws s3 ls s3://$TIGRIS_BUCKET_NAME/backups/ \
  --endpoint-url https://fly.storage.tigris.dev

# Download the desired backup
AWS_ACCESS_KEY_ID=$TIGRIS_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$TIGRIS_SECRET_ACCESS_KEY \
aws s3 cp s3://$TIGRIS_BUCKET_NAME/backups/og-engine-2026-04-16T02-00-00.db \
  ./restored.db \
  --endpoint-url https://fly.storage.tigris.dev
```

### Step 2 — Verify Integrity

```bash
sqlite3 ./restored.db "PRAGMA integrity_check;"
# Expected output: ok

sqlite3 ./restored.db "SELECT COUNT(*) FROM users;"
# Verify row count looks reasonable
```

### Step 3 — Stop the Running Machine

```bash
fly machine list
fly machine stop <machine-id>
```

### Step 4 — Copy the Backup onto the Volume

```bash
# Open an SSH session and copy the file in
fly sftp shell
# Inside the SFTP shell:
put restored.db /data/og-engine.db
```

Alternatively, using `fly ssh console`:

```bash
fly ssh console -C "cat > /data/og-engine.db" < ./restored.db
```

### Step 5 — Restart the Machine

```bash
fly machine start <machine-id>
# Wait for health checks to pass
fly status
```

### Step 6 — Verify the App is Healthy

```bash
curl https://og-engine.com/health
```

---

## Monitoring

- **Backup history**: check the `Daily DB Backup` workflow in GitHub Actions.
- **Failure alerts**: an email is sent to `ADMIN_EMAIL` on any backup failure.
- **Volume health**: `fly volumes list` shows volume state.
- **Machine health**: `fly status` shows machine state and health check results.
