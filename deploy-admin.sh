#!/bin/bash
# ═══════════════════════════════════════════════════════
# OOEDN Admin Tracker — Deploy Script
# Target: admin-tracker-490321 / ooedn-tracker
# ═══════════════════════════════════════════════════════
set -e

echo ""
echo "🚀 ═══════════════════════════════════════════"
echo "   DEPLOYING ADMIN TRACKER"
echo "   Project: admin-tracker-490321"
echo "   Service: ooedn-tracker"
echo "   Region:  us-west1"
echo "═══════════════════════════════════════════════"
echo ""

# Safety: verify we're using the ADMIN Dockerfile (not creator)
if grep -q "CREATOR_MODE" Dockerfile; then
    echo "❌ ERROR: Dockerfile contains CREATOR_MODE!"
    echo "   It looks like the creator Dockerfile is in place."
    echo "   Restore the admin Dockerfile before deploying."
    exit 1
fi

# Switch to correct project
echo "📦 Setting project to admin-tracker-490321..."
gcloud config set project admin-tracker-490321

# Verify
CURRENT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT" != "admin-tracker-490321" ]; then
    echo "❌ ERROR: Failed to set project. Current: $CURRENT"
    exit 1
fi
echo "✅ Project confirmed: $CURRENT"

# Deploy with env vars + secrets from Secret Manager
echo ""
echo "🏗️  Building and deploying..."
gcloud run deploy ooedn-tracker --source . --region us-west1 \
  --update-env-vars "\
CLIENT_ID=964463045186-ck53fm3viba6jsq7ctg0jd8vj9oom4ag.apps.googleusercontent.com,\
SMTP_FROM=creator@ooedn.com,\
SMTP_USER=create@ooedn.com,\
GCS_BUCKET=ai-studio-bucket-850668507460-us-west1,\
DB_SOURCE=firestore" \
  --update-secrets="API_KEY=API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,SMTP_PASS=SMTP_PASS:latest" \
  --allow-unauthenticated --timeout=300

echo ""
echo "✅ ═══════════════════════════════════════════"
echo "   ADMIN TRACKER DEPLOYED SUCCESSFULLY"
echo "   URL: https://ooedn-tracker-964463045186.us-west1.run.app"
echo "   Domain: https://team.ooedn.com (pending SSL)"
echo "═══════════════════════════════════════════════"
echo ""
