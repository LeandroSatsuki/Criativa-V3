#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-make-criativa}"
REGION="southamerica-east1"
SERVICE="criativa-sync-homolog"
RUNTIME_EMAIL="criativa-sync-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE_TAG="${IMAGE_TAG:?Informe uma tag imutavel em IMAGE_TAG}"
SERVICE_DIR="${SERVICE_DIR:-services/google-sync}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/criativa-sync/health:${IMAGE_TAG}"

gcloud builds submit "${SERVICE_DIR}" \
  --tag="${IMAGE}" \
  --project="${PROJECT_ID}" \
  --quiet

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --service-account="${RUNTIME_EMAIL}" \
  --no-allow-unauthenticated \
  --min=0 \
  --max=1 \
  --cpu=1 \
  --memory=256Mi \
  --concurrency=4 \
  --timeout=60 \
  --quiet
