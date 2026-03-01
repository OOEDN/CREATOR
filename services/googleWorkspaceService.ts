
import { ContentItem, Creator, Platform } from "../types";

/**
 * Service to interact with Google Workspace APIs (Calendar, Gmail, Sheets)
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// Helper to construct authorized headers
const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
});

// --- GOOGLE CALENDAR ---

export const createCalendarEvent = async (item: ContentItem, token: string) => {
    if (!item.scheduledDate) throw new Error("Item has no scheduled date");

    const startDate = new Date(item.scheduledDate);
    // Default duration 1 hour for the block
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const event = {
        summary: `[OOEDN] Post: ${item.title}`,
        description: `Platform: ${item.platform}\nCreator: ${item.creatorName}\nStatus: ${item.status}\n\nAsset Link: ${item.fileUrl}`,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 }
            ]
        }
    };

    const response = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(event)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Calendar Sync Failed");
    }

    return await response.json();
};


// --- GMAIL ---

// Helper to encode message in Base64URL (RFC 4648)
const encodeEmail = (to: string, subject: string, body: string) => {
    const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        body
    ].join('\r\n');

    return btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

export const createGmailDraft = async (to: string, subject: string, body: string, token: string) => {
    const raw = encodeEmail(to, subject, body);
    
    const response = await fetch(`${GMAIL_API}/users/me/drafts`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({
            message: { raw }
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Gmail Draft Failed");
    }

    return await response.json();
};

// --- GOOGLE SHEETS ---

export const exportCreatorsToSheet = async (creators: Creator[], token: string, title = "OOEDN Master Roster") => {
    // 1. Create Spreadsheet
    const createRes = await fetch(SHEETS_API, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ properties: { title } })
    });

    if (!createRes.ok) throw new Error("Failed to create Sheet");
    const sheetData = await createRes.json();
    const spreadsheetId = sheetData.spreadsheetId;

    // 2. Prepare Data
    const headers = ['ID', 'Name', 'Handle', 'Platform', 'Email', 'Rate', 'Status', 'Notes', 'Payment Status'];
    const rows = creators.map(c => [
        c.id, c.name, c.handle, c.platform, c.email || '', c.rate, c.status, c.notes, c.paymentStatus
    ]);
    const values = [headers, ...rows];

    // 3. Append Data
    const appendRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/A1:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ values })
    });

    if (!appendRes.ok) throw new Error("Failed to write data to Sheet");

    return sheetData.spreadsheetUrl;
};
