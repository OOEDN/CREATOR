/**
 * OOEDN Push Notification Service
 * 
 * Client-side helper for Web Push API.
 * All functions are wrapped in try/catch — if push fails, the app continues normally.
 */

// The server endpoint base — works in both dev (proxy) and prod
const API_BASE = '';

/**
 * Check if the browser supports push notifications
 */
export function isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!isSupported()) return 'unsupported';
    return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestPermission(): Promise<boolean> {
    try {
        if (!isSupported()) {
            console.warn('[Push] Browser does not support push notifications');
            return false;
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (e) {
        console.warn('[Push] Failed to request permission:', e);
        return false;
    }
}

/**
 * Register the service worker and subscribe to push notifications.
 * Sends the subscription to the server for storage.
 */
export async function subscribeToPush(): Promise<boolean> {
    try {
        if (!isSupported()) return false;

        const permission = await requestPermission();
        if (!permission) {
            console.warn('[Push] Permission denied');
            return false;
        }

        // Get VAPID public key from server
        const vapidRes = await fetch(`${API_BASE}/api/push/vapid-key`);
        if (!vapidRes.ok) {
            console.warn('[Push] Could not fetch VAPID key');
            return false;
        }
        const { publicKey } = await vapidRes.json();

        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send subscription to server
        const res = await fetch(`${API_BASE}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        if (res.ok) {
            console.log('[Push] Successfully subscribed to push notifications');
            return true;
        } else {
            console.warn('[Push] Server rejected subscription');
            return false;
        }
    } catch (e) {
        console.warn('[Push] Failed to subscribe:', e);
        return false;
    }
}

/**
 * Send a push notification to ALL subscribed team members.
 * This is a fire-and-forget operation — errors are logged but never thrown.
 */
export async function sendPushNotification(
    title: string,
    body: string,
    url?: string,
    tag?: string
): Promise<void> {
    try {
        if (!isSupported()) return;

        await fetch(`${API_BASE}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, url: url || '/', tag: tag || 'ooedn-general' })
        });
    } catch (e) {
        // Fire-and-forget — NEVER crash the app for a push notification
        console.warn('[Push] Failed to send notification:', e);
    }
}

/**
 * Convert a URL-safe base64 string to a Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray as any;
}
