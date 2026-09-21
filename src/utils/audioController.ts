/**
 * Persistent Background Music Controller
 * Manages a single HTMLAudioElement for the entire romantic experience.
 * Audio persists across re-renders and screen transitions:
 * Creator Dashboard -> Preview/Proposal -> YES -> Celebration.
 */

let audioElement: HTMLAudioElement | null = null;
let isMuted = false;
let hasAudioStarted = false;
let isAutoplayBlocked = false;
const listeners = new Set<() => void>();

export interface AudioTrackConfig {
  english: string;
  hindi: string;
}

export interface AudioSegment {
  name?: string;
  start: number;
  end: number;
}

export interface CrossfadeTransitionConfig {
  overlapDuration: number;
  joinPoint: number;
  curve: 'linear' | 'sine' | 'equal-power';
}

/**
 * Hindi audio cut segments:
 * Segment 1: 00:10 -> 00:54 (44 seconds)
 * Segment 2: 03:04 -> 04:18 (74 seconds)
 * Join Point: 44.0 seconds with a 1-second crossfade overlap to eliminate abrupt transition.
 */
export const HINDI_AUDIO_SEGMENTS: AudioSegment[] = [
  { name: 'Segment 1 (00:10 -> 00:54)', start: 10, end: 54 },
  { name: 'Segment 2 (03:04 -> 04:18)', start: 184, end: 258 },
];

export const HINDI_CROSSFADE_CONFIG: CrossfadeTransitionConfig = {
  overlapDuration: 1.0, // 1-second crossfade overlap at the join point
  joinPoint: 44.0,      // Join point between segment 1 and segment 2 (in seconds)
  curve: 'equal-power',
};

/**
 * Calculates equal-power crossfade gain values for a smooth 1-second transition.
 */
export function calculateCrossfadeGain(
  progress: number,
  curve: 'linear' | 'sine' | 'equal-power' = 'equal-power'
): { outGain: number; inGain: number } {
  const p = Math.max(0, Math.min(1, progress));
  if (curve === 'equal-power' || curve === 'sine') {
    return {
      outGain: Math.cos(0.5 * Math.PI * p),
      inGain: Math.sin(0.5 * Math.PI * p),
    };
  }
  return {
    outGain: 1 - p,
    inGain: p,
  };
}

/**
 * Applies or verifies the 1-second crossfade transition logic at the join point.
 */
export function applyHindiCrossfadeTransition(
  currentTime: number,
  baseVolume: number = 0.7
): number {
  const { joinPoint, overlapDuration, curve } = HINDI_CROSSFADE_CONFIG;
  const overlapStart = joinPoint - overlapDuration;

  if (currentTime < overlapStart || currentTime > joinPoint) {
    return baseVolume;
  }

  const progress = (currentTime - overlapStart) / overlapDuration;
  const { outGain, inGain } = calculateCrossfadeGain(progress, curve);
  const blendFactor = Math.sqrt(outGain * outGain + inGain * inGain);
  return baseVolume * blendFactor;
}

let activeTrackUrl =
  typeof window !== 'undefined' && localStorage.getItem('selectedMusic') === 'hindi'
    ? '/assets/Ishq_Wala_Love_smooth_cut.mp3'
    : '/assets/i-think-they-call-this-love.mp3';

let detectedTracks: AudioTrackConfig = {
  english: '/assets/i-think-they-call-this-love.mp3',
  hindi: '/assets/Ishq_Wala_Love_smooth_cut.mp3',
};

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in audio listener', e);
    }
  });
}

/**
 * Auto-detect audio tracks from server
 */
export async function detectAudioTracks(): Promise<AudioTrackConfig> {
  if (typeof window === 'undefined') return detectedTracks;
  try {
    const res = await fetch('/api/audio/detect-tracks');
    if (res.ok) {
      const data = await res.json();
      if (data && data.hindi) {
        detectedTracks = {
          english: data.english || '/assets/i-think-they-call-this-love.mp3',
          hindi: data.hindi,
        };
      }
    }
  } catch (err) {
    console.warn('Could not query /api/audio/detect-tracks, using defaults', err);
  }
  return detectedTracks;
}

export function getDetectedTracks(): AudioTrackConfig {
  return detectedTracks;
}

export function getCurrentTrack(): string {
  return activeTrackUrl;
}

function isSameSrc(audioSrc: string, targetPath: string): boolean {
  if (!audioSrc) return false;
  try {
    const currentPath = new URL(audioSrc, window.location.origin).pathname;
    return currentPath === targetPath;
  } catch {
    return audioSrc.endsWith(targetPath);
  }
}

export function setAudioTrack(trackUrl: string): void {
  activeTrackUrl = trackUrl;
  if (trackUrl.includes('Ishq_Wala_Love')) {
    try {
      localStorage.setItem('selectedMusic', 'hindi');
    } catch {}
  } else if (trackUrl.includes('i-think-they-call-this-love')) {
    try {
      localStorage.setItem('selectedMusic', 'english');
    } catch {}
  }

  if (audioElement) {
    const wasPlaying = !audioElement.paused;
    if (!isSameSrc(audioElement.src, trackUrl)) {
      audioElement.src = trackUrl;
      audioElement.load();
      if (wasPlaying) {
        audioElement.play().catch((e) => console.warn('Track switch play error', e));
      }
    }
  }
}

export function initBackgroundMusic(trackUrl?: string): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;

  const targetTrack = trackUrl || activeTrackUrl;
  if (targetTrack) {
    activeTrackUrl = targetTrack;
  }

  if (!audioElement) {
    audioElement = new Audio(activeTrackUrl);
    audioElement.loop = true;
    audioElement.preload = 'auto';
    audioElement.volume = isMuted ? 0 : 0.7;
    audioElement.muted = isMuted;

    const handleEvent = () => notifyListeners();

    audioElement.addEventListener('play', handleEvent);
    audioElement.addEventListener('pause', handleEvent);
    audioElement.addEventListener('volumechange', handleEvent);
    audioElement.addEventListener('ended', handleEvent);

    // Monitor playback to apply smooth 1-second crossfade overlap transition at the join point
    audioElement.addEventListener('timeupdate', () => {
      if (audioElement && !isMuted && activeTrackUrl.includes('Ishq_Wala_Love')) {
        const t = audioElement.currentTime;
        const { joinPoint, overlapDuration } = HINDI_CROSSFADE_CONFIG;
        if (t >= joinPoint - overlapDuration && t <= joinPoint + 0.1) {
          const smoothedVol = applyHindiCrossfadeTransition(t, 0.7);
          if (Math.abs(audioElement.volume - smoothedVol) > 0.005) {
            audioElement.volume = smoothedVol;
          }
        }
      }
    });
  } else if (!isSameSrc(audioElement.src, activeTrackUrl)) {
    audioElement.src = activeTrackUrl;
    audioElement.load();
  }

  return audioElement;
}

export function getIsMuted(): boolean {
  return isMuted;
}

export function getIsPlaying(): boolean {
  return !!(
    audioElement &&
    !audioElement.paused &&
    audioElement.volume > 0 &&
    !audioElement.muted
  );
}

export function getIsAudioStarted(): boolean {
  return hasAudioStarted;
}

export function getIsBlocked(): boolean {
  return isAutoplayBlocked;
}

/**
 * Trigger audio playback directly inside a user interaction handler
 * (e.g. choosing music or typing first character in "Their Name")
 */
export function attemptPlay(trackUrl?: string): Promise<boolean> {
  const targetUrl = trackUrl || activeTrackUrl;
  if (targetUrl) {
    setAudioTrack(targetUrl);
  }
  const audio = initBackgroundMusic(targetUrl);
  if (!audio) return Promise.resolve(false);

  hasAudioStarted = true;

  if (isMuted) {
    audio.volume = 0;
    audio.muted = true;
  } else {
    audio.muted = false;
    audio.volume = 0.7;
  }

  // Ensure current src matches targetUrl
  if (!isSameSrc(audio.src, targetUrl)) {
    audio.src = targetUrl;
    audio.load();
  }

  // If already playing the right track, do not play again
  if (!audio.paused && isSameSrc(audio.src, targetUrl)) {
    isAutoplayBlocked = false;
    notifyListeners();
    return Promise.resolve(true);
  }

  try {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      return playPromise
        .then(() => {
          isAutoplayBlocked = false;
          notifyListeners();
          return true;
        })
        .catch((err) => {
          console.warn('Audio playback blocked or interrupted:', err);
          isAutoplayBlocked = true;
          notifyListeners();
          return false;
        });
    }
    isAutoplayBlocked = false;
    notifyListeners();
    return Promise.resolve(true);
  } catch (err) {
    console.warn('Audio playback error:', err);
    isAutoplayBlocked = true;
    notifyListeners();
    return Promise.resolve(false);
  }
}

/**
 * Toggle mute / unmute state.
 *
 * 🔊 ON -> 🔇 MUTED:
 * - isMuted becomes true. Icon changes to 🔇.
 * - Set audio.volume = 0 and audio.muted = true.
 * - DO NOT pause the audio.
 * - DO NOT reset currentTime.
 * - Song continues playing silently in background.
 *
 * 🔇 MUTED -> 🔊 ON:
 * - isMuted becomes false. Icon changes back to 🔊.
 * - Restore normal volume (0.7) and audio.muted = false.
 * - Continue from the exact current playback position.
 * - DO NOT restart the song.
 */
export function toggleMusic(): void {
  isMuted = !isMuted;

  const audio = initBackgroundMusic();
  if (audio) {
    if (isMuted) {
      // MUTE: set volume to 0. DO NOT call audio.pause(). Audio keeps running silently.
      audio.volume = 0;
      audio.muted = true;
    } else {
      // UNMUTE: restore volume to 0.7. Resume audible sound at exact current position.
      audio.muted = false;
      audio.volume = 0.7;
      if (audio.paused) {
        audio.play().catch(() => {
          isAutoplayBlocked = true;
        });
        isAutoplayBlocked = false;
      }
      hasAudioStarted = true;
    }
  }

  notifyListeners();
}

/**
 * Explicitly pause music if needed
 */
export function pauseMusic(): void {
  if (audioElement && !audioElement.paused) {
    audioElement.pause();
    notifyListeners();
  }
}

/**
 * Subscribe to playback and mute state changes
 */
export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

