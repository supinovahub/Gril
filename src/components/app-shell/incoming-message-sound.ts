type WebkitWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (audioContext) return audioContext;

  const AudioContextConstructor = window.AudioContext
    ?? (window as WebkitWindow).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  audioContext = new AudioContextConstructor();
  return audioContext;
}

export async function armIncomingMessageSound() {
  try {
    const context = getAudioContext();
    if (!context) return false;

    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export async function playIncomingMessageSound() {
  try {
    const context = getAudioContext();
    if (!context) return false;

    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return false;

    const startedAt = context.currentTime;
    const notes = [
      { frequency: 660, offset: 0 },
      { frequency: 880, offset: 0.12 },
    ];

    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startedAt + note.offset;
      const noteEnd = noteStart + 0.16;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.08, noteStart + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
    }

    return true;
  } catch {
    return false;
  }
}
