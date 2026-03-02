
import { Creator, Campaign, ContentItem, AppSettings, TeamMessage, TeamTask } from "../types";

// ===================================================================
// Gmail API Service — Send, Read, Thread, Search, Bulk
// All emails route through the team email (create@ooedn.com)
// Uses the logged-in user's OAuth token + Gmail send-as alias
// ===================================================================

const TEAM_EMAIL = 'creator@ooedn.com';

// Gmail API user identifier — 'me' resolves to the authenticated user's mailbox.
// Emails are sent through the authenticated admin's account (daniel@ooedn.com)
// but use TEAM_EMAIL in the From header as a send-as alias.
// IMPORTANT: creator@ooedn.com must be configured as a send-as alias in Gmail settings
// for the From header to be honored. Otherwise Gmail will override to the auth user's email.
const GMAIL_USER = 'me';

// Direct Gmail API base URL — no proxy needed, calls go straight to Google
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export interface EmailMessage {
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    htmlBody?: string;
    date: string;
    isFromMe: boolean;
    snippet: string;
    labels?: string[];
}

export interface EmailThread {
    id: string;
    subject: string;
    snippet: string;
    messages: EmailMessage[];
    lastMessageDate: string;
    participantEmail: string;
    participantName?: string;
    unread: boolean;
    messageCount: number;
}

// ── Helpers for decoding ──

// Decode Base64 UTF-8 safely
const decodeBase64Utf8 = (str: string) => {
    try {
        const decoded = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch (e) {
        console.warn('[Gmail] Base64 decode error:', e);
        return '';
    }
};

// Decode HTML entities
const decodeHtmlEntities = (str: string) => {
    if (!str) return str;
    return str
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&#x([A-Fa-f0-9]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
};

// Extract plain text from HTML
const extractTextFromHtml = (html: string) => {
    if (!html) return '';
    // Basic extraction: replace <br> and block elements with newlines, then strip tags
    let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Remove all other tags
        .replace(/\n\s*\n/g, '\n\n') // Collapse multiple newlines
        .trim();
    return decodeHtmlEntities(text);
};


// ── Send an email FROM create@ooedn.com ──
export const sendEmail = async (
    token: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string,
    inReplyTo?: string,
    fromEmail: string = TEAM_EMAIL
): Promise<{ id: string; threadId: string }> => {
    // Send as plain text so it's not truncated by Gmail's automatic snippet generation
    // RFC 2047: MIME-encode subject if it contains non-ASCII characters (e.g. emoji)
    const hasNonAscii = /[^\x00-\x7F]/.test(subject);
    const encodedSubject = hasNonAscii
        ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
        : subject;

    const headers = [
        `From: OOEDN Creative Team <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
    ];
    if (inReplyTo) {
        headers.push(`In-Reply-To: ${inReplyTo}`);
        headers.push(`References: ${inReplyTo}`);
    }

    const rawEmail = [...headers, '', body].join('\r\n');
    const encoded = btoa(unescape(encodeURIComponent(rawEmail)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const payload: any = { raw: encoded };
    if (threadId) payload.threadId = threadId;

    const resp = await fetch(`${GMAIL_API_BASE}/users/${GMAIL_USER}/messages/send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gmail Send Failed (${resp.status}): ${err}`);
    }

    const result = await resp.json();
    console.log(`[Gmail] Email sent from ${fromEmail} to ${to}: ${subject}`);
    return { id: result.id, threadId: result.threadId };
};

// ── Send bulk emails to multiple creators ──
export const sendBulkEmail = async (
    token: string,
    recipients: { email: string; name: string }[],
    subject: string,
    body: string,
    onProgress?: (sent: number, total: number, current: string) => void,
    fromEmail: string = TEAM_EMAIL
): Promise<{ sent: number; failed: number }> => {
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
        onProgress?.(sent + failed, recipients.length, r.name);
        try {
            const personalBody = body.replace(/\{name\}/gi, r.name);
            await sendEmail(token, r.email, subject, personalBody, undefined, undefined, fromEmail);
            sent++;
        } catch (e) {
            console.error(`[Gmail] Failed to send to ${r.email}:`, e);
            failed++;
        }
        await new Promise(r => setTimeout(r, 200));
    }

    return { sent, failed };
};

// ── Parse a single Gmail message ──
const parseMessage = (msg: any, teamEmail: string): EmailMessage => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const date = getHeader('Date');

    let body = '';
    let htmlBody = '';
    const extractParts = (payload: any) => {
        if (payload.body?.data) {
            const decoded = decodeBase64Utf8(payload.body.data);
            if (payload.mimeType === 'text/plain') body += decoded;
            if (payload.mimeType === 'text/html') htmlBody += decoded;
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                extractParts(part);
            }
        }
    };
    if (msg.payload) extractParts(msg.payload);

    // If there is no text/plain body but there is text/html, extract readable text from HTML 
    // instead of falling back immediately to the 200-character snippet.
    if (!body && htmlBody) {
        body = extractTextFromHtml(htmlBody);
    }

    // Unescape HTML entities that sometimes exist in subject, snippet, or body
    const finalSubject = decodeHtmlEntities(subject);
    const finalSnippet = decodeHtmlEntities(msg.snippet || '');
    const finalBody = decodeHtmlEntities(body || msg.snippet || '');

    // "From me" = sent from the team email OR the user's personal email
    const isFromMe = from.toLowerCase().includes(teamEmail.toLowerCase()) ||
        from.toLowerCase().includes('ooedn.com');

    return {
        id: msg.id,
        threadId: msg.threadId,
        from,
        to,
        subject: finalSubject,
        body: finalBody,
        htmlBody: htmlBody || undefined,
        date: new Date(date).toISOString(),
        isFromMe,
        snippet: finalSnippet,
        labels: msg.labelIds
    };
};

// ── Get email threads for a specific contact (filtered to team email) ──
export const getThreadsForContact = async (
    token: string,
    contactEmail: string,
    teamEmail: string = TEAM_EMAIL,
    maxResults: number = 20
): Promise<EmailThread[]> => {
    // Only show conversations that involve the team email AND the contact
    const query = encodeURIComponent(
        `(from:${contactEmail} to:${teamEmail}) OR (from:${teamEmail} to:${contactEmail})`
    );
    const resp = await fetch(
        `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads?q=${query}&maxResults=${maxResults}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gmail Thread List Failed (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    if (!data.threads || data.threads.length === 0) return [];

    const threads: EmailThread[] = [];
    for (const t of data.threads.slice(0, maxResults)) {
        try {
            const thread = await getThread(token, t.id, teamEmail);
            if (thread) {
                thread.participantEmail = contactEmail;
                threads.push(thread);
            }
        } catch (e) {
            console.warn(`[Gmail] Failed to fetch thread ${t.id}:`, e);
        }
    }

    return threads.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
};

// ── Get a single thread with all messages ──
export const getThread = async (
    token: string,
    threadId: string,
    teamEmail: string = TEAM_EMAIL
): Promise<EmailThread | null> => {
    const resp = await fetch(
        `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads/${threadId}?format=full`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!resp.ok) return null;

    const data = await resp.json();
    const messages = (data.messages || []).map((m: any) => parseMessage(m, teamEmail));

    if (messages.length === 0) return null;

    const lastMsg = messages[messages.length - 1];
    const unread = (data.messages || []).some((m: any) => m.labelIds?.includes('UNREAD'));

    return {
        id: threadId,
        subject: messages[0].subject,
        snippet: lastMsg.snippet,
        messages,
        lastMessageDate: lastMsg.date,
        participantEmail: '',
        unread,
        messageCount: messages.length
    };
};

// ── Get inbox summary — ONLY emails to/from create@ooedn.com ──
export const getInboxSummary = async (
    token: string,
    teamEmail: string = TEAM_EMAIL,
    maxResults: number = 30
): Promise<EmailThread[]> => {
    // Filter to ONLY show emails involving the team email address
    const query = encodeURIComponent(`to:${teamEmail} OR from:${teamEmail}`);
    const resp = await fetch(
        `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads?q=${query}&maxResults=${maxResults}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gmail Inbox Failed (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    if (!data.threads) return [];

    const threads: EmailThread[] = [];
    for (const t of data.threads) {
        try {
            const thread = await getThread(token, t.id, teamEmail);
            if (thread) threads.push(thread);
        } catch (e) {
            console.warn(`[Gmail] Failed to fetch thread:`, e);
        }
    }

    return threads;
};

// ── Search emails (scoped to team email) ──
export const searchEmails = async (
    token: string,
    query: string,
    teamEmail: string = TEAM_EMAIL,
    maxResults: number = 20
): Promise<EmailThread[]> => {
    // Scope search to team email conversations
    const scopedQuery = encodeURIComponent(`(to:${teamEmail} OR from:${teamEmail}) ${query}`);
    const resp = await fetch(
        `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads?q=${scopedQuery}&maxResults=${maxResults}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!resp.ok) return [];

    const data = await resp.json();
    if (!data.threads) return [];

    const threads: EmailThread[] = [];
    for (const t of data.threads.slice(0, 10)) {
        try {
            const thread = await getThread(token, t.id, teamEmail);
            if (thread) threads.push(thread);
        } catch (e) { }
    }

    return threads;
};

// ── Mark a thread as READ (remove UNREAD label) ──
export const markThreadAsRead = async (
    token: string,
    threadId: string
): Promise<boolean> => {
    try {
        const resp = await fetch(
            `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads/${threadId}/modify`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
            }
        );
        if (!resp.ok) {
            console.warn(`[Gmail] Mark as read failed (${resp.status})`);
            return false;
        }
        console.log(`[Gmail] Thread ${threadId} marked as read`);
        return true;
    } catch (e) {
        console.warn('[Gmail] Mark as read error:', e);
        return false;
    }
};

// ── Move a thread to Trash ──
export const trashThread = async (
    token: string,
    threadId: string
): Promise<boolean> => {
    try {
        const resp = await fetch(
            `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads/${threadId}/trash`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        if (!resp.ok) {
            console.warn(`[Gmail] Trash failed (${resp.status})`);
            return false;
        }
        console.log(`[Gmail] Thread ${threadId} trashed`);
        return true;
    } catch (e) {
        console.warn('[Gmail] Trash error:', e);
        return false;
    }
};

// ── Archive a thread (remove from Inbox without deleting) ──
export const archiveThread = async (
    token: string,
    threadId: string
): Promise<boolean> => {
    try {
        const resp = await fetch(
            `${GMAIL_API_BASE}/users/${GMAIL_USER}/threads/${threadId}/modify`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ removeLabelIds: ['INBOX'] })
            }
        );
        if (!resp.ok) {
            console.warn(`[Gmail] Archive failed (${resp.status})`);
            return false;
        }
        console.log(`[Gmail] Thread ${threadId} archived`);
        return true;
    } catch (e) {
        console.warn('[Gmail] Archive error:', e);
        return false;
    }
};
