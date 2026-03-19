import { supabase } from "../supabase";

const PUBLIC_VAPID_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(userId) {
  try {
    console.log('[Push] Starting subscribeToPush for userId:', userId);
    console.log('[Push] VAPID public key:', PUBLIC_VAPID_KEY);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Push not supported — serviceWorker:', 'serviceWorker' in navigator, '| PushManager:', 'PushManager' in window);
      return null;
    }
    console.log('[Push] Push is supported in this browser');

    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[Push] Service worker registered:', registration);

    const readyReg = await navigator.serviceWorker.ready;
    console.log('[Push] SW ready:', readyReg);

    const permission = await Notification.requestPermission();
    console.log('[Push] Notification permission result:', permission);
    if (permission !== 'granted') {
      return null;
    }

    console.log('[Push] Subscribing to PushManager with VAPID key...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });
    console.log('[Push] PushManager subscription:', subscription);
    console.log('[Push] Subscription JSON:', JSON.stringify(subscription.toJSON()));

    console.log('[Push] Saving subscription to Supabase...');
    const { data, error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: subscription.toJSON()
    }, { onConflict: 'user_id' });
    console.log('[Push] Supabase upsert result — data:', data, '| error:', error);

    return subscription;
  } catch (err) {
    console.error('[Push] Push subscription error:', err);
    return null;
  }
}
