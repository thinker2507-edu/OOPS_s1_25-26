import { useEffect, useRef, useState } from '../lib/react.js';
import { api } from '../services/api.js';
import { LiveNotifications } from '../services/live-notifications.js';
function permission() {
  return typeof Notification === 'undefined' || !globalThis.isSecureContext ? 'unsupported' : Notification.permission;
}
async function showBrowserAlert(userId, alert, active) {
  if (permission() !== 'granted' || !active()) {
    return;
  }
  const options = {
    body: alert.initial || !alert.incidentId ? alert.message.slice(0, 220) : 'Incident INC-' + String(alert.incidentId).padStart(4, '0') + ' has a new update.',
    tag: 'relay-' + userId,
    data: { path: alert.path }
  };
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/notification-worker.js');
      const ready = await navigator.serviceWorker.ready;
      if (!active()) {
        return;
      }
      await ready.showNotification('Relay', options);
      return registration;
    }
    const notification = new Notification('Relay', options);
    notification.onclick = () => {
      window.focus();
      location.assign(alert.path);
      notification.close();
    };
  }
  catch {
  }
}
export function useLiveNotifications({
  user,
  notifications,
  onUpdate,
  onAlert,
  onExpired
}) {
  const callbacks = useRef({});
  callbacks.current = {
    user,
    notifications,
    onUpdate,
    onAlert,
    onExpired
  };
  const [browserPermission, setBrowserPermission] = useState(permission);
  const [connection, setConnection] = useState('offline');
  useEffect(() => {
    const update = () => setBrowserPermission(permission());
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);
  useEffect(() => {
    if (!user) {
      return;
    }
    const client = new LiveNotifications({
      initial: callbacks.current.notifications || [],
      load: signal => api('notifications', undefined, { signal }),
      onUpdate: rows => callbacks.current.onUpdate(rows),
      onAlert: alert => {
        callbacks.current.onAlert(alert);
        showBrowserAlert(user.id, alert, () => callbacks.current.user?.id === user.id);
      },
      onExpired: () => callbacks.current.onExpired(),
      onConnection: setConnection
    }).start();
    return () => {
      client.close();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration('/').then(registration => registration?.getNotifications({ tag: 'relay-' + user.id })).then(rows => rows?.forEach(notification => notification.close())).catch(() => {
        });
      }
    };
  }, [user?.id, user?.role]);
  async function enable() {
    if (permission() === 'unsupported') {
      return;
    }
    let result;
    try {
      result = await Notification.requestPermission();
    }
    catch {
      setBrowserPermission(permission());
      callbacks.current.onAlert({ message: 'Browser alerts could not be enabled. Live in-app notifications remain available.' });
      return;
    }
    setBrowserPermission(result);
    if (result === 'granted' && user && callbacks.current.user?.id === user.id) {
      const unread = (callbacks.current.notifications || []).filter(row => row.channel === 'in_app' && !row.is_read).length;
      const alert = {
        message: unread ? 'You have ' + unread + ' unread notifications.' : 'Browser notifications are enabled.',
        path: '/notifications/inbox'
      };
      callbacks.current.onAlert(alert);
      await showBrowserAlert(user.id, alert, () => callbacks.current.user?.id === user.id);
    }
  }
  return {
    permission: browserPermission,
    connection,
    enable
  };
}
