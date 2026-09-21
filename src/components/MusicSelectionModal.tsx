import React from 'react';
import { setAudioTrack } from '../utils/audioController';

interface MusicSelectionModalProps {
  isOpen: boolean;
  onSelectMusic: (track: 'hindi' | 'english') => void;
}

export const MusicSelectionModal: React.FC<MusicSelectionModalProps> = React.memo(({
  isOpen,
  onSelectMusic,
}) => {
  if (!isOpen) return null;

  // Exact audio file paths
  const HINDI_AUDIO = '/assets/Ishq_Wala_Love_smooth_cut.mp3';
  const ENGLISH_AUDIO = '/assets/i-think-they-call-this-love.mp3';

  const handleSelectHindi = () => {
    try {
      localStorage.setItem('selectedMusic', 'hindi');
    } catch {}
    // Save selected track in controller without starting audio yet
    setAudioTrack(HINDI_AUDIO);
    onSelectMusic('hindi');
  };

  const handleSelectEnglish = () => {
    try {
      localStorage.setItem('selectedMusic', 'english');
    } catch {}
    // Save selected track in controller without starting audio yet
    setAudioTrack(ENGLISH_AUDIO);
    onSelectMusic('english');
  };

  return (
    <div
      id="music-selection-modal-overlay"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="music-modal-title"
    >
      {/* Centered Premium Dark Romantic Modal Card */}
      <div
        id="music-selection-modal-card"
        className="w-full max-w-sm mx-auto rounded-3xl bg-gradient-to-b from-[#1F1418]/95 via-[#180E13]/95 to-[#120B0E]/95 border border-rose-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_35px_rgba(244,63,94,0.18)] p-6 sm:p-7 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-xl"
      >
        {/* Soft background romantic glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* 🎵 Icon */}
        <div className="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-b from-rose-500/20 to-pink-500/10 border border-rose-400/30 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-4 animate-gentle-pulse">
          <span>🎵</span>
        </div>

        {/* Heading */}
        <h2
          id="music-modal-title"
          className="relative z-10 text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm mb-2"
        >
          Choose Your Music ❤️
        </h2>

        {/* Subtitle */}
        <p
          id="music-modal-subtitle"
          className="relative z-10 text-sm sm:text-base text-rose-200/80 font-medium leading-relaxed max-w-[280px] sm:max-w-xs mx-auto mb-6"
        >
          Pick the music you'd like to hear
        </p>

        {/* Big easy-to-tap option buttons */}
        <div className="relative z-10 w-full flex flex-col gap-3.5">
          {/* 🇮🇳 Hindi Song ❤️ */}
          <button
            type="button"
            id="music-option-hindi"
            onClick={handleSelectHindi}
            className="w-full py-4 px-6 rounded-2xl bg-white/10 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-400/40 hover:border-rose-400 text-white font-bold text-base sm:text-lg shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-200 active:scale-98 cursor-pointer flex items-center justify-center gap-2 group backdrop-blur-sm"
          >
            <span className="text-xl">🇮🇳</span>
            <span className="group-hover:text-rose-200 transition-colors">Hindi Song ❤️</span>
          </button>

          {/* 🇬🇧 English Song ❤️ */}
          <button
            type="button"
            id="music-option-english"
            onClick={handleSelectEnglish}
            className="w-full py-4 px-6 rounded-2xl bg-white/10 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-400/40 hover:border-rose-400 text-white font-bold text-base sm:text-lg shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-200 active:scale-98 cursor-pointer flex items-center justify-center gap-2 group backdrop-blur-sm"
          >
            <span className="text-xl">🇬🇧</span>
            <span className="group-hover:text-rose-200 transition-colors">English Song ❤️</span>
          </button>
        </div>
      </div>
    </div>
  );
});

MusicSelectionModal.displayName = 'MusicSelectionModal';
