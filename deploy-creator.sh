#!/bin/bash
# ═══════════════════════════════════════════════════════
# OOEDN Creator Portal — Deploy Script
# Target: ooedn-creator-portal / creator-portal
# ═══════════════════════════════════════════════════════
set -e

echo ""
echo "🚀 ═══════════════════════════════════════════"
echo "   DEPLOYING CREATOR PORTAL"
echo "   Project: ooedn-creator-portal"
echo "   Service: creator-portal"
echo "   Region:  us-west1"
echo "═══════════════════════════════════════════════"
echo ""

# Switch to correct project
echo "📦 Setting project to ooedn-creator-portal..."
gcloud config set project ooedn-creator-portal

# Verify
CURRENT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT" != "ooedn-creator-portal" ]; then
    echo "❌ ERROR: Failed to set project. Current: $CURRENT"
    exit 1
fi
echo "✅ Project confirmed: $CURRENT"

# Swap Dockerfile safely
echo "🔄 Swapping to creator Dockerfile..."
cp Dockerfile Dockerfile.admin.bak

# TRAP: Always restore Dockerfile on exit (success or failure)
trap 'echo ""; echo "↩️  Restoring admin Dockerfile..."; cp Dockerfile.admin.bak Dockerfile; rm -f Dockerfile.admin.bak; echo "✅ Dockerfile restored"' EXIT

cp Dockerfile.creator Dockerfile

# Verify the swap worked
if ! grep -q "CREATOR_MODE" Dockerfile; then
    echo "❌ ERROR: Dockerfile swap failed — CREATOR_MODE not found"
    exit 1
fi
echo "✅ Creator Dockerfile in place"

# Deploy with env vars + secrets from Secret Manager
echo ""
echo "🏗️  Building and deploying..."
gcloud run deploy creator-portal --source . --region us-west1 \
  --update-env-vars "\
CREATOR_MODE=true,\
CLIENT_ID=850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com,\
SMTP_FROM=creator@ooedn.com,\
SMTP_USER=create@ooedn.com,\
GCS_BUCKET=ai-studio-bucket-850668507460-us-west1,\
DB_SOURCE=firestore" \
  --update-secrets="API_KEY=API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,SMTP_PASS=SMTP_PASS:latest" \
  --allow-unauthenticated --timeout=300

echo ""
echo "✅ ═══════════════════════════════════════════"
echo "   CREATOR PORTAL DEPLOYED SUCCESSFULLY"
echo "   Dockerfile auto-restored by trap ↩️"
echo "   URL: https://creator-portal-1038679114321.us-west1.run.app"
echo "   Domain: https://creator.ooedn.com (pending SSL)"
echo "═══════════════════════════════════════════════"
echo ""
