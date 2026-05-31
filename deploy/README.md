# Cloud Deployment (Google Cloud Run)

## Architecture

```
Browser → Cloud Run (Express + React build)
                ↓ DB
          Cloud SQL MySQL 8.0
                ↑
      Cloud Scheduler (POST /api/admin/refresh every hour)
```

The `setInterval` scheduler inside `server.js` is disabled in production.
Cloud Scheduler triggers the hourly data fetch instead — Cloud Run scales to
zero between requests, which is cheaper and simpler.

---

## One-time Setup

### 1. Prerequisites

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com
```

### 2. Create Cloud SQL (MySQL 8.0)

```bash
gcloud sql instances create aq-gis-mysql \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=asia-southeast2 \
  --root-password=CHOOSE_A_ROOT_PASSWORD

gcloud sql databases create db_aq_gis --instance=aq-gis-mysql

gcloud sql users create aq_gis \
  --instance=aq-gis-mysql \
  --password=CHOOSE_A_USER_PASSWORD
```

### 3. Run migrations against Cloud SQL

```bash
# Temporarily allow your IP (run once, delete after)
gcloud sql instances patch aq-gis-mysql --authorized-networks=$(curl -s ifconfig.me)

# Run from the web/ directory — set DB_HOST to the Cloud SQL public IP
DB_HOST=$(gcloud sql instances describe aq-gis-mysql --format='value(ipAddresses[0].ipAddress)') \
DB_USER=aq_gis \
DB_PASSWORD=CHOOSE_A_USER_PASSWORD \
DB_NAME=db_aq_gis \
node migrations/run.js

node scripts/seed-kecamatan.js

# Remove your IP from the allowlist
gcloud sql instances patch aq-gis-mysql --clear-authorized-networks
```

### 4. Store secrets in Secret Manager

```bash
echo -n "YOUR_GOOGLE_AQ_API_KEY" | \
  gcloud secrets create GOOGLE_AQ_API_KEY --data-file=-

echo -n "CHOOSE_A_USER_PASSWORD" | \
  gcloud secrets create DB_PASSWORD --data-file=-
```

### 5. Grant Cloud Run access to Cloud SQL and secrets

```bash
PROJECT_ID=$(gcloud config get-value project)
SA="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudsql.client"

gcloud secrets add-iam-policy-binding GOOGLE_AQ_API_KEY \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DB_PASSWORD \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"
```

### 6. Deploy

```bash
# From the repo root
gcloud builds submit --config=deploy/cloudbuild.yaml
```

### 7. Set up Cloud Scheduler (hourly data fetch)

```bash
SERVICE_URL=$(gcloud run services describe aq-gis-web \
  --region=asia-southeast2 --format='value(status.url)')

gcloud scheduler jobs create http aq-gis-hourly-refresh \
  --schedule="0 * * * *" \
  --uri="${SERVICE_URL}/api/admin/refresh" \
  --http-method=POST \
  --location=asia-southeast2 \
  --time-zone="Asia/Jakarta"
```

---

## Redeploying after code changes

```bash
gcloud builds submit --config=deploy/cloudbuild.yaml
```

Cloud Build builds the Docker image, pushes it, and updates the Cloud Run service automatically.

---

## Costs (approximate, smallest tier)

| Service | Cost |
|---------|------|
| Cloud SQL db-f1-micro | ~$7/month |
| Cloud Run (pay per request) | < $1/month at hobby traffic |
| Cloud Scheduler (1 job) | $0.10/month |
| Secret Manager | ~$0.06/month |
| **Total** | **~$8–9/month** |

Free trial credits cover this easily for several months.
