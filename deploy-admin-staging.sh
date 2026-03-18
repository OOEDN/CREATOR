#!/bin/bash
# ═══════════════════════════════════════════════════════
# OOEDN Admin Tracker — STAGING Deploy Script
# Target: admin-tracker-490321 / ooedn-tracker-staging
#
# This deploys to a SEPARATE Cloud Run service.
# Production (ooedn-tracker) is NEVER touched.
# To rollback: just delete this service from Cloud Run console.
# ═══════════════════════════════════════════════════════
set -e

echo ""
echo "🧪 ═══════════════════════════════════════════"
echo "   DEPLOYING ADMIN TRACKER (STAGING)"
echo "   Project: admin-tracker-490321"
echo "   Service: ooedn-tracker-staging"
echo "   Region:  us-west1"
echo "   ⚠️  This does NOT touch production!"
echo "═══════════════════════════════════════════════"
echo ""

# Safety: verify we're using the ADMIN Dockerfile (not creator)
if grep -q "CREATOR_MODE" Dockerfile; then
    echo "❌ ERROR: Dockerfile contains CREATOR_MODE!"
    echo "   Restore the admin Dockerfile before deploying."
    exit 1
fi

# Switch to correct project
echo "📦 Setting project to admin-tracker-490321..."
gcloud config set project admin-tracker-490321

CURRENT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT" != "admin-tracker-490321" ]; then
    echo "❌ ERROR: Failed to set project. Current: $CURRENT"
    exit 1
fi
echo "✅ Project confirmed: $CURRENT"

# Deploy to STAGING service (separate from production)
echo ""
echo "🏗️  Building and deploying to STAGING..."
gcloud run deploy ooedn-tracker-staging --source . --region us-west1 \
  --update-env-vars "\
CLIENT_ID=964463045186-ck53fm3viba6jsq7ctg0jd8vj9oom4ag.apps.googleusercontent.com,\
SMTP_FROM=creator@ooedn.com,\
SMTP_USER=create@ooedn.com,\
GCS_BUCKET=ai-studio-bucket-850668507460-us-west1,\
DB_SOURCE=firestore" \
  --update-secrets="API_KEY=API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,SMTP_PASS=SMTP_PASS:latest" \
  --allow-unauthenticated --timeout=300

# Get the auto-generated staging URL
STAGING_URL=$(gcloud run services describe ooedn-tracker-staging --region us-west1 --format='value(status.url)' 2>/dev/null)

echo ""
echo "✅ ═══════════════════════════════════════════"
echo "   STAGING ADMIN TRACKER DEPLOYED"
echo "   URL: $STAGING_URL"
echo "   Production is UNTOUCHED ✅"
echo ""
echo "   Test here first, then deploy prod with:"
echo "   bash deploy-admin.sh"
echo "═══════════════════════════════════════════════"
echo ""
