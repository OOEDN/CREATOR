#!/bin/bash
# ═══════════════════════════════════════════════════════
# OOEDN Firestore BACKUP Script
# Creates a timestamped export of the entire 'ooedn' database
# ═══════════════════════════════════════════════════════
set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="gs://ooedn-firestore-backups/backup-${TIMESTAMP}"

echo ""
echo "💾 ═══════════════════════════════════════════"
echo "   BACKING UP FIRESTORE DATABASE"
echo "   Project:  kinetix-ooedn"
echo "   Database: ooedn"
echo "   Target:   $BACKUP_PATH"
echo "═══════════════════════════════════════════════"
echo ""

gcloud config set project kinetix-ooedn 2>/dev/null
gcloud firestore export "$BACKUP_PATH" --database=ooedn

echo ""
echo "✅ Verifying backup..."
gsutil ls -r "$BACKUP_PATH/" | head -20
BACKUP_SIZE=$(gsutil du -s "$BACKUP_PATH/" | awk '{print $1}')
echo ""
echo "✅ ═══════════════════════════════════════════"
echo "   BACKUP COMPLETE"
echo "   Path: $BACKUP_PATH"
echo "   Size: $BACKUP_SIZE bytes"
echo ""
echo "   To restore: bash restore-firestore.sh $BACKUP_PATH"
echo "═══════════════════════════════════════════════"
echo ""
