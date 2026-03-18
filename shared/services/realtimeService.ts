/**
 * realtimeService.ts — Client-side SSE consumer for real-time Firestore updates.
 * Connects to /api/realtime/stream and dispatches custom events when data changes.
 */

type RealtimeChangeType = 'added' | 'modified' | 'removed';

interface RealtimeEvent {
  type: RealtimeChangeType;
  doc: Record<string, any>;
}

type RealtimeCallback = (event: RealtimeEvent) => void;

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30s max

const listeners: Map<string, Set<RealtimeCallback>> = new Map();

/**
 * Request browser notification permission and show notifications
 * for new messages/tasks when the tab is not focused.
 */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p =>
      console.log(`[Realtime] Notification permission: ${p}`)
    );
  }
}

function showNotification(title: string, body: string, tag?: string) {
  if (
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.hidden // Only notify when tab is NOT focused
  ) {
    const n = new Notification(title, {
      body,
      icon: '/ooedn-logo.png',
      tag: tag || 'ooedn-realtime', // Prevents duplicate notifications
      silent: false,
    });
    // Auto-close after 5s
    setTimeout(() => n.close(), 5000);
    // Focus tab on click
    n.onclick = () => { window.focus(); n.close(); };
  }
}

/**
 * Register a callback for changes to a specific collection.
 * Returns an unsubscribe function.
 */
export function onRealtimeChange(collection: string, callback: RealtimeCallback): () => void {
  if (!listeners.has(collection)) {
    listeners.set(collection, new Set());
  }
  listeners.get(collection)!.add(callback);

  return () => {
    listeners.get(collection)?.delete(callback);
  };
}

/**
 * Connect to the SSE stream. Call once when the app connects.
 * Automatically reconnects on disconnect.
 */
export function connectRealtime(): () => void {
  if (eventSource) {
    console.log('[Realtime] Already connected');
    return () => disconnectRealtime();
  }

  const baseUrl = window.location.origin;
  const url = `${baseUrl}/api/realtime/stream`;

  console.log('[Realtime] Connecting to SSE stream...');
  eventSource = new EventSource(url);

  // Request notification permission on first connect
  requestNotificationPermission();

  eventSource.addEventListener('connected', (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    console.log(`[Realtime] ✅ Connected (${data.clientCount} clients)`);
    reconnectAttempts = 0; // Reset on successful connection
  });

  // Listen for collection-specific events
  const collections = ['teamMessages', 'contentItems', 'teamTasks'];
  for (const collection of collections) {
    eventSource.addEventListener(collection, (e) => {
      try {
        const event: RealtimeEvent = JSON.parse((e as MessageEvent).data);

        // Fire browser notification for new items when tab is not focused
        if (event.type === 'added') {
          if (collection === 'teamMessages' && event.doc?.text) {
            showNotification(
              `💬 ${event.doc.sender || 'Team'}`,
              event.doc.text.substring(0, 80),
              `msg-${event.doc.id}`
            );
          } else if (collection === 'teamTasks' && event.doc?.title) {
            showNotification(
              '📋 New Task',
              event.doc.title.substring(0, 80),
              `task-${event.doc.id}`
            );
          }
        }

        const callbacks = listeners.get(collection);
        if (callbacks) {
          for (const cb of callbacks) {
            try { cb(event); } catch (err) { console.error(`[Realtime] Callback error:`, err); }
          }
        }
      } catch (err) {
        console.error(`[Realtime] Failed to parse ${collection} event:`, err);
      }
    });
  }

  eventSource.addEventListener('ping', () => {
    // Keep-alive — no action needed
  });

  eventSource.onerror = () => {
    console.warn('[Realtime] SSE connection lost — will reconnect');
    cleanupEventSource();
    scheduleReconnect();
  };

  return () => disconnectRealtime();
}

function cleanupEventSource() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return; // Already scheduled

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;

  console.log(`[Realtime] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRealtime();
  }, delay);
}

/**
 * Disconnect from the SSE stream.
 */
export function disconnectRealtime() {
  cleanupEventSource();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  console.log('[Realtime] Disconnected');
}

/**
 * Check if connected to the SSE stream.
 */
export function isRealtimeConnected(): boolean {
  return eventSource !== null && eventSource.readyState === EventSource.OPEN;
}
