const DB_NAME = 'ai-portfolio-share';
const DB_VERSION = 1;
const STORE_NAME = 'shares';
const LATEST_KEY = 'latest';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method === 'POST' &&
    url.pathname.endsWith('/upload/share')
  ) {
    event.respondWith(handleShare(event.request, url));
  }
});

async function handleShare(request, url) {
  const formData = await request.formData();
  const files = formData
    .getAll('media')
    .filter((value) => value instanceof File && value.size > 0);

  await writeLatestShare({
    title: String(formData.get('title') ?? ''),
    text: String(formData.get('text') ?? ''),
    url: String(formData.get('url') ?? ''),
    files,
    receivedAt: new Date().toISOString(),
  });

  return Response.redirect(new URL('./?shared=1', url).href, 303);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeLatestShare(value) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, LATEST_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}
