/* AI: erstellt von DeepSeek V4.1 Flash (opencode) | 2026-11-13 */

// Offline-Hülle der PWA. Der Livestream und die Senderliste liegen bei SomaFM
// und werden bewusst nie zwischengespeichert — sie brauchen immer Internet.
const CACHE_NAME = 'stillpoint-shell-v3';

// Relative Pfade, damit die App auch unter einem Unterpfad (z. B. GitHub Pages)
// funktioniert. Bei Änderungen an diesen Dateien CACHE_NAME erhöhen.
const SHELL_ASSETS = [
	'./',
	'./index.html',
	'./styles.css',
	'./app.mjs',
	'./audio.mjs',
	'./chime.mjs',
	'./pwa.mjs',
	'./stations.mjs',
	'./timer.mjs',
	'./track.mjs',
	'./manifest.webmanifest',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(SHELL_ASSETS);
	})());
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const names = await caches.keys();
		await Promise.all(names
			.filter((name) => name.startsWith('stillpoint-shell-') && name !== CACHE_NAME)
			.map((name) => caches.delete(name)));
		await self.clients.claim();
	})());
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function offlineResponse() {
	return new Response('Offline. Bitte verbinde dich mit dem Internet.', {
		status: 503,
		statusText: 'Offline',
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}

async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME);
	try {
		const response = await fetch(request);
		if (response.ok) await cache.put('./index.html', response.clone());
		return response;
	} catch {
		return (await cache.match(request)) ?? (await cache.match('./index.html')) ?? offlineResponse();
	}
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);
	const network = fetch(request).then(async (response) => {
		if (response.ok) await cache.put(request, response.clone());
		return response;
	}).catch(() => null);
	return cached ?? (await network) ?? offlineResponse();
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	// Streams, Senderkatalog und Titelabfragen von SomaFM laufen direkt am Cache vorbei.
	if (url.origin !== self.location.origin) return;

	event.respondWith(request.mode === 'navigate' ? networkFirst(request) : staleWhileRevalidate(request));
});
