/* AI: erstellt von DeepSeek V4.1 Flash (opencode) | 2026-11-13 */

// Signalton beim Phasenwechsel — das Web-Gegenstück zu `PhaseChime.swift`.
//
// Die Töne werden synthetisiert statt als Datei geladen: Auf iOS darf immer nur
// ein Medienelement gleichzeitig spielen, ein zweiter <audio>-Tag würde den
// Livestream unterbrechen. Die Web-Audio-API mischt dagegen mit dem laufenden
// Stream und braucht keinen Download.
//
// Aufbau wie in der App: Fokus klingt aufsteigend (D5 → A5), Pause absteigend
// (A5 → D5). Die Töne sind reine Sinusschwingungen mit weichem Ein- und
// Ausblenden, damit nichts knackt.

const NOTE_D5 = 587.33;
const NOTE_A5 = 880;

export function createPhaseChime() {
	let context = null;

	// iOS startet Web Audio nur nach einer echten Nutzereingabe. Deshalb wird
	// der Kontext beim ersten Tippen entsperrt und danach nur noch genutzt.
	function ensureContext() {
		if (!context) {
			const AudioContextClass = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextClass) return null;
			try {
				context = new AudioContextClass();
			} catch {
				return null;
			}
		}
		if (context.state === 'suspended') context.resume().catch(() => {});
		return context;
	}

	function tone(target, frequency, startAt, duration, peak) {
		const oscillator = target.createOscillator();
		const gain = target.createGain();
		oscillator.type = 'sine';
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0, startAt);
		gain.gain.linearRampToValueAtTime(peak, startAt + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
		oscillator.connect(gain).connect(target.destination);
		oscillator.start(startAt);
		oscillator.stop(startAt + duration + 0.05);
	}

	return {
		// Vor dem ersten Ton aufrufen, solange eine Nutzereingabe läuft.
		prepare() {
			ensureContext();
		},

		// `phase` ist die Phase, in die gewechselt wurde.
		play(phase) {
			const target = ensureContext();
			if (!target || target.state !== 'running') return;
			const start = target.currentTime + 0.02;
			const [first, second] = phase === 'work' ? [NOTE_D5, NOTE_A5] : [NOTE_A5, NOTE_D5];
			tone(target, first, start, 0.5, 0.22);
			tone(target, second, start + 0.22, 0.8, 0.2);
		},
	};
}
