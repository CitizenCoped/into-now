import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event) => {
  const data = (event.data?.json() ?? {}) as PushPayload;
  const title = data.title ?? "into.now";
  const options: NotificationOptions = {
    body: data.body ?? "You have a new update",
    icon: data.icon ?? "/logo.svg",
    badge: "/logo.svg",
    tag: data.tag,
    data: { url: data.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "OPEN_URL", url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});