// routes/creatorContentRoutes.js — File upload, media proxy, content delete, creator save
import { Router } from 'express';

export default function createCreatorContentRoutes({ firestoreDAL, getGCSAuthToken, MAIN_BUCKET, readMasterDB, readMasterDB_GCS, writeMasterDB, writeMasterDB_GCS, creatorAuthMiddleware }) {
  const router = Router();

  // POST /api/creator/upload-file (JWT protected)
  router.post('/creator/upload-file', creatorAuthMiddleware, async (req, res) => {
    try {
      const { fileData, fileName, contentType } = req.body;
      if (!fileData || !fileName) return res.status(400).json({ error: 'fileData and fileName required' });

      const token = await getGCSAuthToken();
      if (!token) return res.status(503).json({ error: 'GCS auth unavailable' });

      const account = await firestoreDAL.getAccountById(req.creatorAccountId);
      const creatorId = account?.linkedCreatorId || req.creatorAccountId;

      const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const gcsPath = `creator-uploads/${creatorId}/${Date.now()}-${sanitizedName}`;

      const buffer = Buffer.from(fileData, 'base64');
      const mimeType = contentType || 'application/octet-stream';

      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${MAIN_BUCKET}/o?uploadType=media&name=${encodeURIComponent(gcsPath)}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': mimeType,
        },
        body: buffer,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        console.error('[Upload] GCS upload failed:', err);
        return res.status(500).json({ error: 'File upload failed' });
      }

      // Make the object publicly readable
      const aclUrl = `https://storage.googleapis.com/storage/v1/b/${MAIN_BUCKET}/o/${encodeURIComponent(gcsPath)}/acl`;
      await fetch(aclUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity: 'allUsers', role: 'READER' }),
      }).catch(e => console.warn('[Upload] ACL set failed (file may not be public):', e));

      const publicUrl = `https://storage.googleapis.com/${MAIN_BUCKET}/${gcsPath}`;
      console.log(`[Upload] ✅ File uploaded: ${publicUrl}`);

      res.json({ success: true, url: publicUrl, gcsPath });
    } catch (e) {
      console.error('[Upload] Error:', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // GET /api/media-proxy
  router.get('/media-proxy', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).send('url query param required');
      if (!url.includes('storage.googleapis.com') && !url.includes(MAIN_BUCKET)) {
        return res.status(403).send('Only GCS URLs allowed');
      }
      const token = await getGCSAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const gcsRes = await fetch(url, { headers });
      if (!gcsRes.ok) return res.status(gcsRes.status).send('GCS fetch failed');
      const ct = gcsRes.headers.get('content-type') || 'application/octet-stream';
      const cl = gcsRes.headers.get('content-length');
      res.setHeader('Content-Type', ct);
      if (cl) res.setHeader('Content-Length', cl);
      res.setHeader('Accept-Ranges', 'bytes');
      const arrayBuf = await gcsRes.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (e) {
      console.error('[MediaProxy] Error:', e);
      res.status(500).send('Proxy error');
    }
  });

  // POST /api/content/delete
  router.post('/content/delete', async (req, res) => {
    try {
      const { contentId } = req.body;
      if (!contentId) return res.status(400).json({ error: 'contentId required' });

      console.log(`[ContentDelete] Deleting content ${contentId} from all sources`);

      const db = await readMasterDB_GCS();
      if (db) {
        const before = (db.contentItems || []).length;
        db.contentItems = (db.contentItems || []).filter(c => c.id !== contentId);
        const after = db.contentItems.length;
        if (before !== after) {
          db.lastUpdated = new Date().toISOString();
          db.version = Date.now();
          await writeMasterDB_GCS(db);
          console.log(`[ContentDelete] Removed from GCS (${before} → ${after})`);
        }
      }

      try {
        await firestoreDAL.deleteContentItem(contentId);
        console.log(`[ContentDelete] ✅ Removed from Firestore: ${contentId}`);
      } catch (e) {
        console.warn(`[ContentDelete] Firestore delete failed: ${e.message}`);
      }

      res.json({ success: true, contentId });
    } catch (e) {
      console.error('[ContentDelete] Error:', e);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  // POST /api/creator/save (JWT protected)
  router.post('/creator/save', creatorAuthMiddleware, async (req, res) => {
    try {
      const { updates } = req.body;
      if (!updates) return res.status(400).json({ error: 'No updates provided' });

      const db = await readMasterDB();
      if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

      const account = await firestoreDAL.getAccountById(req.creatorAccountId);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      if (updates.creator && account.linkedCreatorId) {
        db.creators = (db.creators || []).map(c =>
          c.id === account.linkedCreatorId ? { ...c, ...updates.creator } : c
        );
      }

      if (updates.contentItems) {
        const existingIds = new Set((db.contentItems || []).map(c => c.id));
        for (const item of updates.contentItems) {
          if (item.creatorId !== account.linkedCreatorId) continue;
          if (existingIds.has(item.id)) {
            db.contentItems = db.contentItems.map(c => c.id === item.id ? { ...c, ...item } : c);
          } else {
            db.contentItems = [...(db.contentItems || []), item];
          }
        }
      }

      if (updates.teamMessages) {
        const existingMsgIds = new Set((db.teamMessages || []).map(m => m.id));
        const newMessages = updates.teamMessages.filter(m => !existingMsgIds.has(m.id));
        db.teamMessages = [...(db.teamMessages || []), ...newMessages];
      }

      if (updates.betaReleases) {
        for (const release of updates.betaReleases) {
          if (release.creatorId !== account.linkedCreatorId) continue;
          const existing = (db.betaReleases || []).find(r => r.id === release.id);
          if (existing) {
            db.betaReleases = db.betaReleases.map(r => r.id === release.id ? { ...r, ...release } : r);
          } else {
            db.betaReleases = [...(db.betaReleases || []), release];
          }
        }
      }

      if (updates.campaigns) {
        for (const campaign of updates.campaigns) {
          db.campaigns = (db.campaigns || []).map(c => {
            if (c.id !== campaign.id) return c;
            const patch = { acceptedByCreatorIds: campaign.acceptedByCreatorIds };
            if (campaign.assignedCreatorIds) patch.assignedCreatorIds = campaign.assignedCreatorIds;
            return { ...c, ...patch };
          });
        }
      }

      if (updates.account) {
        const { password, ...safeUpdates } = updates.account;
        await firestoreDAL.updateAccount(req.creatorAccountId, safeUpdates);
      }

      db.lastUpdated = new Date().toISOString();
      db.version = Date.now();

      const saved = await writeMasterDB(db);
      if (!saved) return res.status(500).json({ error: 'Failed to save' });

      // 🔔 Payment Request Alert — notify team when a creator requests payment
      if (updates.creator && updates.creator.paymentStatus === 'Processing') {
        const creatorName = updates.creator.name || account.displayName || account.email;
        const paymentAmount = updates.creator.rate || updates.creator.totalEarned || '??';
        const contentCount = (updates.contentItems || []).filter(c => c.paymentRequested).length;
        try {
          // Fire push notification to all team subscribers via internal endpoint
          await fetch(`http://localhost:${process.env.PORT || 8080}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `💰 Payment Request: ${creatorName}`,
              body: `${creatorName} requested $${paymentAmount} for ${contentCount} video${contentCount !== 1 ? 's' : ''}. Review in Payment Hub.`,
              url: '/',
              tag: 'ooedn-payment-request'
            })
          });
          console.log(`[CreatorSave] 🔔 Payment request alert sent for ${creatorName}`);
        } catch (pushErr) {
          console.warn('[CreatorSave] Push alert failed (non-critical):', pushErr.message);
        }
      }

      res.json({ success: true });
    } catch (e) {
      console.error('[CreatorAuth] Save error:', e);
      res.status(500).json({ error: 'Server error during save' });
    }
  });

  return router;
}
