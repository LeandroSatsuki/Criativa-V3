#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-make-criativa}"
RUNTIME_ACCOUNT="criativa-sync-runtime"
RUNTIME_EMAIL="${RUNTIME_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
REGION="southamerica-east1"
BUCKET="${PROJECT_ID}-sync-staging"

gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  sheets.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

if ! gcloud iam service-accounts describe "${RUNTIME_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_ACCOUNT}" \
    --display-name="Criativa Google Sync Runtime" \
    --project="${PROJECT_ID}"
fi

for role in roles/datastore.user roles/secretmanager.secretAccessor roles/logging.logWriter roles/cloudtasks.enqueuer; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_EMAIL}" \
    --role="${role}" \
    --condition=None \
    --quiet
done

if ! gcloud firestore databases describe --database='(default)' --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud firestore databases create --database='(default)' \
    --location="${REGION}" \
    --type=firestore-native \
    --project="${PROJECT_ID}" \
    --quiet
fi

if ! gcloud storage buckets describe "gs://${BUCKET}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_EMAIL}" \
  --role="roles/storage.objectAdmin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gcloud storage buckets update "gs://${BUCKET}" \
  --lifecycle-file="${SCRIPT_DIR}/staging-lifecycle.json"

if ! gcloud tasks queues describe criativa-sync-homolog --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud tasks queues create criativa-sync-homolog \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --max-dispatches-per-second=2 \
    --max-concurrent-dispatches=2 \
    --max-attempts=5 \
    --min-backoff=30s \
    --max-backoff=600s \
    --max-doublings=3
fi

if ! gcloud artifacts repositories describe criativa-sync --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create criativa-sync \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}"
fi

for secret in \
  criativa-drive-oauth-client-id \
  criativa-drive-oauth-client-secret \
  criativa-drive-oauth-refresh-token \
  criativa-sync-ingress-secret \
  criativa-sheets-id \
  criativa-drive-root-folder-id; do
  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets create "${secret}" --replication-policy=automatic --project="${PROJECT_ID}"
  fi
done

echo "Runtime preparado sem criar chave JSON: ${RUNTIME_EMAIL}"
