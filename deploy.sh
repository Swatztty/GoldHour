#!/usr/bin/env bash
# Deploys Golden Hour to Google Cloud: Cloud Run (app), Firestore (cases + community radar),
# Cloud Storage (evidence), Vertex AI Gemini (agent), Firebase Hosting + Auth (front door, anonymous sign-in).
#
# Usage (from Google Cloud Shell, inside the project folder):
#   ./deploy.sh
# The script asks for your Gemini API key (the key named "golden-hour-gemini" in
# APIs & Services → Credentials) the first time, and stores it in Secret Manager.
# Later deploys reuse the stored key, so you don't need to paste it again.
#
# Optional settings:
#   export PROJECT_ID=...         # defaults to the golden_hour project below
#   export REGION=asia-south1     # must match firebase.json
#   export MIN_INSTANCES=1        # keep one server warm (no cold start) on judging day; costs credit while idle
#   export GEMINI_MODEL=... GEMINI_LIVE_MODEL=...   # if your key lists different model names (see DEPLOYMENT.md 3.3)
set -euo pipefail

# The golden_hour Google Cloud project
PROJECT_ID="${PROJECT_ID:-golden-hour-511809}"
REGION="${REGION:-asia-south1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
SECRET_NAME="gemini-api-key"
SERVICE="golden-hour"
BUCKET="${PROJECT_ID}-golden-hour-evidence"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.8-flash}"
GEMINI_LIVE_MODEL="${GEMINI_LIVE_MODEL:-gemini-3.8-live}"

echo "▸ Project $PROJECT_ID, region $REGION"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "▸ Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com aiplatform.googleapis.com storage.googleapis.com \
  firebase.googleapis.com identitytoolkit.googleapis.com secretmanager.googleapis.com \
  generativelanguage.googleapis.com

echo "▸ Firestore (Native mode)"
gcloud firestore databases describe --database="(default)" >/dev/null 2>&1 || \
  gcloud firestore databases create --location="$REGION" --type=firestore-native

echo "▸ Evidence bucket (screenshots auto-delete after 30 days)"
if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access
  cat > /tmp/gh-lifecycle.json <<'JSON'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}
JSON
  gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=/tmp/gh-lifecycle.json
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "▸ Granting the Cloud Run service account access to Vertex AI, Firestore and the bucket"
# Newer projects build with the Compute Engine default service account, which starts with no
# permissions: it needs to read the uploaded source, write the image and logs (Cloud Build), and run the app.
for role in roles/aiplatform.user roles/datastore.user roles/cloudbuild.builds.builder roles/storage.objectViewer roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null

ENV_VARS="FIREBASE_PROJECT_ID=$PROJECT_ID,FIREBASE_STORAGE_BUCKET=$BUCKET,GEMINI_MODEL=$GEMINI_MODEL,GEMINI_LIVE_MODEL=$GEMINI_LIVE_MODEL,GOOGLE_CLOUD_LOCATION=global"
SECRET_FLAGS=()
# Gemini API key: use GEMINI_API_KEY if exported, otherwise ask once (hidden input), otherwise reuse the stored secret
if [[ -z "${GEMINI_API_KEY:-}" && -t 0 ]] && ! gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  read -rsp "Paste your Gemini API key (golden-hour-gemini), or press Enter to skip: " GEMINI_API_KEY || true
  echo
fi
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "▸ Storing the Gemini API key in Secret Manager ($SECRET_NAME)"
  gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1 || gcloud secrets create "$SECRET_NAME" --replication-policy=automatic
  printf "%s" "$GEMINI_API_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=- >/dev/null
fi
if gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding "$SECRET_NAME" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor >/dev/null
  SECRET_FLAGS=(--set-secrets "GEMINI_API_KEY=$SECRET_NAME:latest")
else
  echo "▸ No Gemini API key: text features use Vertex AI and voice uses guided mode"
  ENV_VARS="$ENV_VARS,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
fi

# Firebase web app config for anonymous auth + live sync (optional but recommended)
if command -v firebase >/dev/null 2>&1; then
  echo "▸ Firebase: linking project and web app"
  firebase projects:addfirebase "$PROJECT_ID" >/dev/null 2>&1 || true
  APP_ID=$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null | grep -oE '1:[0-9]+:web:[a-f0-9]+' | head -1 || true)
  if [[ -z "$APP_ID" ]]; then
    firebase apps:create WEB "Golden Hour" --project "$PROJECT_ID" >/dev/null
    APP_ID=$(firebase apps:list WEB --project "$PROJECT_ID" | grep -oE '1:[0-9]+:web:[a-f0-9]+' | head -1)
  fi
  WEB_KEY=$(firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" | grep -oE '"apiKey": *"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')
  ENV_VARS="$ENV_VARS,FIREBASE_APP_ID=$APP_ID,FIREBASE_WEB_API_KEY=$WEB_KEY,FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com"
fi

echo "▸ Deploying to Cloud Run (builds the Dockerfile with Cloud Build)"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 \
  --min-instances "$MIN_INSTANCES" --max-instances 3 \
  --timeout 300 \
  --set-env-vars "$ENV_VARS" \
  ${SECRET_FLAGS[@]+"${SECRET_FLAGS[@]}"}

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')

if command -v firebase >/dev/null 2>&1; then
  echo "▸ Firebase Hosting + Firestore rules"
  firebase deploy --only hosting,firestore:rules --project "$PROJECT_ID"
fi

echo
echo "✓ Cloud Run:        $URL"
echo "✓ Firebase Hosting: https://$PROJECT_ID.web.app"
echo "  Health check:     $URL/api/health"
echo
echo "One manual step: Firebase console → Authentication → Sign-in method → enable Anonymous."
