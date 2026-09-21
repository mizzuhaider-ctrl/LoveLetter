import React, { useState, useEffect } from 'react';
import { getIsMuted, toggleMusic, subscribeMusic } from '../utils/audioController';

interface AudioPlayerProps {
  id?: string;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = React.memo(({ id = 'sound-toggle-btn', className = '' }) => {
  const [isMuted, setIsMuted] = useState(() => getIsMuted());

  useEffect(() => {
    const unsub = subscribeMusic(() => {
      setIsMuted(getIsMuted());
    });
    return unsub;
  }, []);

  return (
    <button
      type="button"
      id={id}
      onClick={(e) => {
        e.stopPropagation();
        toggleMusic();
      }}
      title={isMuted ? 'Unmute music' : 'Mute music'}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-rose-800 shadow-sm backdrop-blur-sm border border-white/60 flex items-center justify-center text-base sm:text-lg transition-all duration-200 active:scale-90 cursor-pointer select-none ${className}`}
      aria-label={isMuted ? 'Unmute romantic music' : 'Mute romantic music'}
    >
      <span className="leading-none">{isMuted ? '🔇' : '🔊'}</span>
    </button>
  );
});

AudioPlayer.displayName = 'AudioPlayer';
