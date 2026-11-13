/* AI: erstellt von DeepSeek V4.1 Flash (opencode) | 2026-11-13 */

// Kleine PWA-Schicht: Installation, Service Worker, Media Session und
// Verbindungsanzeige. Der Timer selbst bleibt in app.mjs.

const INSTALL_HINT_KEY = 'stillpoint-install-hint-dismissed';

export function isStandalone() {
	return window.matchMedia?.('(display-mode: standalone)').matches === true ||
		window.navigator.standalone === true;
}

export function applyDisplayMode() {
	document.documentElement.dataset.displayMode = isStandalone() ? 'standalone' : 'browser';
}

function isIOS() {
	return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Nur Safari kann auf iOS Webseiten zum Home-Bildschirm hinzufügen.
// Chrome und Firefox auf dem iPhone nutzen zwar WebKit, bieten den Befehl aber nicht an.
function canInstallFromHere() {
	if (!isIOS() || isStandalone()) return false;
	return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

function readFlag(key) {
	try {
		return window.localStorage.getItem(key) === '1';
	} catch {
		return false;
	}
}

function writeFlag(key) {
	try {
		window.localStorage.setItem(key, '1');
	} catch {
		// Ohne Speicher erscheint der Hinweis bei jedem Start erneut — akzeptabel.
	}
}

/// Zeigt auf dem iPhone einen kurzen Hinweis, wie die Seite als App installiert wird.
export function setupInstallHint() {
	const hint = document.querySelector('#install-hint');
	const close = document.querySelector('#install-hint-close');
	if (!hint || !close || !canInstallFromHere() || readFlag(INSTALL_HINT_KEY)) return;

	hint.hidden = false;
	close.addEventListener('click', () => {
		hint.hidden = true;
		writeFlag(INSTALL_HINT_KEY);
	});
}

/// Blendet im Kopfbereich ein, wenn das Gerät offline ist.
export function setupConnectionBadge() {
	const badge = document.querySelector('.local-badge');
	const label = document.querySelector('#connection-label');
	if (!badge || !label) return;

	const onlineText = label.textContent;
	const update = () => {
		const online = navigator.onLine;
		badge.classList.toggle('is-offline', !online);
		label.textContent = online ? onlineText : 'Offline · Timer läuft weiter';
	};

	window.addEventListener('online', update);
	window.addEventListener('offline', update);
	update();
}

/// Registriert den Service Worker und meldet, wenn eine neue Version bereitliegt.
export async function registerServiceWorker({ onUpdateReady } = {}) {
	if (!('serviceWorker' in navigator)) return null;

	let reloadRequested = false;
	let registration;
	try {
		registration = await navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), { scope: './' });
	} catch {
		// Ohne Service Worker läuft die App weiter, nur eben ohne Offline-Hülle.
		return null;
	}

	const announceWaiting = () => {
		if (!registration.waiting) return;
		onUpdateReady?.(() => {
			reloadRequested = true;
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		});
	};

	registration.addEventListener('updatefound', () => {
		const installing = registration.installing;
		installing?.addEventListener('statechange', () => {
			if (installing.state === 'installed' && navigator.serviceWorker.controller) announceWaiting();
		});
	});

	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloadRequested) window.location.reload();
	});

	announceWaiting();
	return registration;
}

/// Verbindet die Wiedergabe mit dem Sperrbildschirm (Titel, Interpret, Steuerung).
export function createMediaSession({ onPlay, onPause } = {}) {
	const session = navigator.mediaSession;
	const artwork = [
		{ src: new URL('./icons/icon-192.png', import.meta.url).href, sizes: '192x192', type: 'image/png' },
		{ src: new URL('./icons/icon-512.png', import.meta.url).href, sizes: '512x512', type: 'image/png' },
	];
	let signature = '';
	let playbackState = '';

	const setHandler = (action, handler) => {
		try {
			session.setActionHandler(action, handler);
		} catch {
			// Nicht jede Aktion ist auf jeder iOS-Version verfügbar.
		}
	};

	if (session) {
		setHandler('play', () => onPlay?.());
		setHandler('pause', () => onPause?.());
		setHandler('stop', () => onPause?.());
	}

	return {
		update({ title, artist, album, playing }) {
			if (!session) return;

			const nextSignature = `${title}\u0000${artist}\u0000${album}`;
			if (nextSignature !== signature && typeof MediaMetadata !== 'undefined') {
				signature = nextSignature;
				session.metadata = new MediaMetadata({ title, artist, album, artwork });
			}

			const nextState = playing ? 'playing' : 'paused';
			if (nextState !== playbackState) {
				playbackState = nextState;
				session.playbackState = nextState;
			}
		},
	};
}
