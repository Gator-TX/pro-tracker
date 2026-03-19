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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push not supported');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: subscription.toJSON()
    }, { onConflict: 'user_id' });

    return subscription;
  } catch (err) {
    console.error('Push subscription error:', err);
    return null;
  }
}
