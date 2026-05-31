# Google Cloud Run Deployment

This guide deploys the Express backend and React production build to Google Cloud Run.
Cloud SQL provides MySQL storage. Cloud Scheduler triggers the hourly ingestion endpoint.

## Production Architecture

```text
Browser
  Cloud Run service
    Express API
    React production build
    Cloud SQL MySQL connection

Cloud Scheduler
  Hourly authenticated POST request
    Cloud Run /api/admin/refresh
```

The internal Node.js interval scheduler is disabled when `NODE_ENV=production`. Cloud
Scheduler is responsible for production refresh timing.

## Prerequisites

- Google Cloud CLI installed
- A Google Cloud project with billing enabled
- A Google Air Quality API key
- A local MySQL client
- Node.js 20 or newer

Set the project and enable the required services:

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

## Create Cloud SQL

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

## Import Data and Run Migrations

Temporarily allow your public IP while initializing the database:

```bash
PUBLIC_IP=$(curl -s ifconfig.me)
gcloud sql instances patch aq-gis-mysql --authorized-networks="$PUBLIC_IP"

DB_HOST=$(gcloud sql instances describe aq-gis-mysql \
  --format='value(ipAddresses[0].ipAddress)')

mysql \
  --host="$DB_HOST" \
  --user=aq_gis \
  --password \
  db_aq_gis < database/import_air_quality_mysql.sql

DB_HOST="$DB_HOST" \
DB_USER=aq_gis \
DB_PASSWORD=CHOOSE_A_USER_PASSWORD \
DB_NAME=db_aq_gis \
node web/migrations/run.js

DB_HOST="$DB_HOST" \
DB_USER=aq_gis \
DB_PASSWORD=CHOOSE_A_USER_PASSWORD \
DB_NAME=db_aq_gis \
node web/scripts/seed-kecamatan.js

gcloud sql instances patch aq-gis-mysql --clear-authorized-networks
```

## Create Runtime Secrets

Generate a refresh token and store all runtime secrets:

```bash
REFRESH_TOKEN=$(openssl rand -hex 32)

printf '%s' 'YOUR_GOOGLE_AQ_API_KEY' | \
  gcloud secrets create GOOGLE_AQ_API_KEY --data-file=-

printf '%s' 'CHOOSE_A_USER_PASSWORD' | \
  gcloud secrets create DB_PASSWORD --data-file=-

printf '%s' "$REFRESH_TOKEN" | \
  gcloud secrets create REFRESH_TOKEN --data-file=-
```

Keep the `REFRESH_TOKEN` shell variable available until the Cloud Scheduler job is
created.

## Create the Runtime Service Account

```bash
PROJECT_ID=$(gcloud config get-value project)
RUN_SA="aq-gis-runner@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_SA=$(gcloud builds get-default-service-account)

gcloud iam service-accounts create aq-gis-runner \
  --display-name='AQ GIS Cloud Run runtime'

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" \
  --role='roles/cloudsql.client'

for SECRET in GOOGLE_AQ_API_KEY DB_PASSWORD REFRESH_TOKEN; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${RUN_SA}" \
    --role='roles/secretmanager.secretAccessor'
done

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role='roles/run.admin'

gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --member="serviceAccount:${BUILD_SA}" \
  --role='roles/iam.serviceAccountUser'
```

The Cloud Build default service account varies by project configuration. Query it with
`gcloud builds get-default-service-account` instead of assuming a fixed email address.

## Deploy

Run this command from the repository root:

```bash
gcloud builds submit --config=deploy/cloudbuild.yaml
```

## Create the Hourly Scheduler Job

```bash
SERVICE_URL=$(gcloud run services describe aq-gis-web \
  --region=asia-southeast2 \
  --format='value(status.url)')

gcloud scheduler jobs create http aq-gis-hourly-refresh \
  --schedule='0 * * * *' \
  --uri="${SERVICE_URL}/api/admin/refresh" \
  --http-method=POST \
  --headers="X-Refresh-Token=${REFRESH_TOKEN}" \
  --location=asia-southeast2 \
  --time-zone='Asia/Jakarta'
```

## Verify the Deployment

```bash
curl "${SERVICE_URL}/api/config"

curl \
  --request POST \
  --header "X-Refresh-Token: ${REFRESH_TOKEN}" \
  "${SERVICE_URL}/api/admin/refresh"
```

## Redeploy

After code changes:

```bash
gcloud builds submit --config=deploy/cloudbuild.yaml
```
