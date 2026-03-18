#!/bin/bash
# ═══════════════════════════════════════════════════════
# OOEDN Firestore RESTORE Script
# Restores from a Firestore export in GCS
#
# Usage: bash restore-firestore.sh gs://ooedn-firestore-backups/backup-YYYYMMDD-HHMMSS
#
# ⚠️  WARNING: This OVERWRITES existing data in matching collections.
#       Only use this in an emergency.
# ═══════════════════════════════════════════════════════
set -e

BACKUP_PATH="$1"

if [ -z "$BACKUP_PATH" ]; then
    echo "❌ Usage: bash restore-firestore.sh <backup-path>"
    echo ""
    echo "Available backups:"
    gsutil ls gs://ooedn-firestore-backups/ | sort
    exit 1
fi

echo ""
echo "⚠️  ═══════════════════════════════════════════"
echo "   RESTORING FIRESTORE DATABASE"
echo "   Project:  kinetix-ooedn"
echo "   Database: ooedn"
echo "   From:     $BACKUP_PATH"
echo ""
echo "   ⚠️  THIS WILL OVERWRITE EXISTING DATA"
echo "═══════════════════════════════════════════════"
echo ""

read -p "Are you SURE? Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
    echo "❌ Aborted."
    exit 1
fi

gcloud config set project kinetix-ooedn 2>/dev/null
gcloud firestore import "$BACKUP_PATH" --database=ooedn

echo ""
echo "✅ ═══════════════════════════════════════════"
echo "   RESTORE COMPLETE"
echo "   Restored from: $BACKUP_PATH"
echo "   Database: ooedn"
echo "═══════════════════════════════════════════════"
echo ""
