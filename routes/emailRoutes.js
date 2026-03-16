// routes/emailRoutes.js — SMTP email send, morning reminder, Gmail proxy, receipt proxy
import { Router } from 'express';

export default function createEmailRoutes({ gmailAuthClient, getGCSAuthToken, MAIN_BUCKET }) {
  const router = Router();

  // General-purpose email send via SMTP
  router.post('/send-email', async (req, res) => {
    try {
      const { to, subject, body, html, inReplyTo } = req.body;
      if (!to || !subject) return res.status(400).json({ error: 'to and subject required' });
      let nodemailer;
      try { nodemailer = await import('nodemailer'); } catch { return res.status(500).json({ error: 'nodemailer not available' }); }
      const transporter = nodemailer.default.createTransport({
        service: 'gmail',
        auth: { user: process.env.SMTP_USER || 'create@ooedn.com', pass: process.env.SMTP_PASS || '' }
      });
      const mailOpts = {
        from: `"OOEDN Creative Team" <${process.env.SMTP_USER || 'create@ooedn.com'}>`,
        to, subject,
      };
      if (html) mailOpts.html = html;
      else mailOpts.text = body || '';
      if (inReplyTo) {
        mailOpts.inReplyTo = inReplyTo;
        mailOpts.references = inReplyTo;
      }
      const info = await transporter.sendMail(mailOpts);
      console.log(`[SMTP] Email sent to ${to}: ${subject} (messageId: ${info.messageId})`);
      res.json({ id: info.messageId, threadId: info.messageId });
    } catch (e) {
      console.error('[SMTP] Send error:', e);
      res.status(500).json({ error: e.message || 'Failed to send' });
    }
  });

  // Send email to creators (bulk)
  router.post('/creator/send-email', async (req, res) => {
    try {
      const { emails, subject, body } = req.body;
      if (!emails?.length || !subject || !body) return res.status(400).json({ error: 'emails, subject, and body required' });
      let nodemailer;
      try { nodemailer = await import('nodemailer'); } catch { return res.status(500).json({ error: 'nodemailer not available' }); }
      const transporter = nodemailer.default.createTransport({
        service: 'gmail',
        auth: { user: process.env.SMTP_USER || 'create@ooedn.com', pass: process.env.SMTP_PASS || '' }
      });
      let sent = 0, failed = 0;
      for (const email of emails) {
        try {
          await transporter.sendMail({
            from: `"OOEDN Creative Team" <${process.env.SMTP_USER || 'create@ooedn.com'}>`,
            to: email, subject,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#000;padding:24px;border-radius:16px">
                <h1 style="color:#a855f7;font-size:18px;margin:0 0 16px">OOEDN</h1>
                <h2 style="color:#fff;font-size:16px;margin:0 0 12px">${subject}</h2>
                <p style="color:#a3a3a3;font-size:14px;line-height:1.6">${body.replace(/\n/g, '<br>')}</p>
                <hr style="border:1px solid #333;margin:20px 0">
                <p style="color:#525252;font-size:10px">OOEDN Creator Portal</p>
              </div>
            </div>`
          });
          sent++;
        } catch (err) { failed++; console.warn(`[Email] Failed to send to ${email}:`, err.message); }
      }
      console.log(`[Email] Sent: ${sent}, Failed: ${failed}`);
      res.json({ sent, failed });
    } catch (e) {
      console.error('[Email] Send error:', e);
      res.status(500).json({ error: 'Failed to send emails' });
    }
  });

  // Morning Reminder (Google Chat Webhook)
  const GCHAT_WEBHOOK = 'https://chat.googleapis.com/v1/spaces/AAQA7pMfr0Y/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=xM_-nwUZ71vMuf9A0fJeOVF4pCfjwXlscULolyXpb1U';

  async function fetchMasterDB() {
    try {
      const bucket = process.env.GCS_BUCKET || 'ooedn-tracker-data';
      const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/ooedn_master_db.json?alt=media`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[Reminder] Fetch failed:', e.message);
      return null;
    }
  }

  async function sendToGoogleChat(message) {
    try {
      const res = await fetch(GCHAT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      });
      if (!res.ok) { console.warn('[Reminder] Webhook failed:', res.status); return false; }
      console.log('[Reminder] Google Chat message sent');
      return true;
    } catch (e) {
      console.warn('[Reminder] Webhook error:', e.message);
      return false;
    }
  }

  async function checkAndSendMorningReminder() {
    try {
      const db = await fetchMasterDB();
      if (!db) return { sent: false, reason: 'Could not fetch data' };

      const today = new Date().toISOString().split('T')[0];
      const contentItems = db.contentItems || [];
      const teamTasks = db.teamTasks || [];

      const todayContent = contentItems.filter(c => c.scheduledDate && c.scheduledDate.split('T')[0] === today);
      const todayTasks = teamTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === today && t.status !== 'Done');
      const overdueTasks = teamTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] < today && t.status !== 'Done');

      if (todayContent.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0) {
        return { sent: false, reason: 'Nothing scheduled today' };
      }

      let message = `☀️ *OOEDN Morning Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}*\n\n`;

      if (todayContent.length > 0) {
        message += `📅 *Content to Post Today (${todayContent.length}):*\n`;
        todayContent.forEach(c => {
          const caption = c.caption ? `\n   📝 Caption: _${c.caption.substring(0, 120)}${c.caption.length > 120 ? '...' : ''}_` : '\n   ⚠️ No caption drafted yet!';
          message += `• *${c.title}* by @${c.creatorName || 'Unknown'} on ${c.platform}${caption}\n`;
        });
        message += '\n';
      }

      if (todayTasks.length > 0) {
        message += `📋 *Tasks Due Today (${todayTasks.length}):*\n`;
        todayTasks.forEach(t => { message += `• ${t.title} → ${t.assignedTo.split('@')[0]}\n`; });
        message += '\n';
      }

      if (overdueTasks.length > 0) {
        message += `🔴 *Overdue Tasks (${overdueTasks.length}):*\n`;
        overdueTasks.forEach(t => { message += `• ${t.title} (due ${t.dueDate}) → ${t.assignedTo.split('@')[0]}\n`; });
        message += '\n';
      }

      message += `\n🔗 Open Tracker: https://ooedn-tracker-356469728393.us-west1.run.app`;

      const sent = await sendToGoogleChat(message);
      return { sent, todayContent: todayContent.length, todayTasks: todayTasks.length, overdueTasks: overdueTasks.length };
    } catch (e) {
      console.error('[Reminder] Check failed:', e);
      return { sent: false, error: e.message };
    }
  }

  router.get('/reminder/morning', async (req, res) => {
    try {
      const result = await checkAndSendMorningReminder();
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Auto-schedule morning reminder
  let lastReminderDate = null;
  setInterval(() => {
    try {
      const now = new Date();
      const etHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
      const todayStr = now.toISOString().split('T')[0];
      if (etHour === 8 && lastReminderDate !== todayStr) {
        lastReminderDate = todayStr;
        console.log('[Reminder] 8 AM ET — sending morning briefing');
        checkAndSendMorningReminder();
      }
    } catch (e) {
      console.warn('[Reminder] Scheduler error (non-blocking):', e.message);
    }
  }, 60 * 60 * 1000);

  // Gmail API Proxy
  router.use('/gmail/*', async (req, res) => {
    if (!gmailAuthClient) {
      return res.status(500).json({ error: 'Gmail proxy not configured on server (missing service account credentials)' });
    }
    try {
      const tokenInfo = await gmailAuthClient.getAccessToken();
      const token = tokenInfo.token;
      const targetUrl = `https://gmail.googleapis.com/gmail${req.originalUrl.replace('/api/gmail', '')}`;
      const fetchOptions = {
        method: req.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': req.headers['content-type'] || 'application/json'
        }
      };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = JSON.stringify(req.body);
      }
      const googleRes = await fetch(targetUrl, fetchOptions);
      const data = await googleRes.text();
      res.status(googleRes.status);
      res.set('Content-Type', googleRes.headers.get('content-type'));
      res.send(data);
    } catch (error) {
      console.error('[Gmail Proxy] Error:', error);
      res.status(500).json({ error: error.message || 'Proxy failed' });
    }
  });

  // GCS Receipt Proxy
  router.get('/receipt-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string' || !url.includes('storage.googleapis.com')) {
      return res.status(400).json({ error: 'Invalid or missing GCS URL' });
    }
    try {
      let token = null;
      if (gmailAuthClient) {
        const tokenInfo = await gmailAuthClient.getAccessToken();
        token = tokenInfo.token;
      }
      const fetchHeaders = {};
      if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
      const gcsRes = await fetch(url, { headers: fetchHeaders });
      if (!gcsRes.ok) {
        return res.status(gcsRes.status).json({ error: `GCS error: ${gcsRes.status}` });
      }
      const contentType = gcsRes.headers.get('content-type') || 'application/octet-stream';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      const buffer = await gcsRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('[Receipt Proxy] Error:', error);
      res.status(500).json({ error: 'Receipt proxy failed' });
    }
  });

  return router;
}
