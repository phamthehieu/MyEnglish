// Study reminders of the web app, added to its service worker (vite.config.ts, workbox.importScripts). The Edge
// Function send-reminders pushes { title, body, url }; a tap opens the app, or brings it forward when it is open.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "MyEnglish", {
      body: data.body || "Đến giờ học rồi: vài phút ôn từ là đủ cho hôm nay.",
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      tag: "study-reminder",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
