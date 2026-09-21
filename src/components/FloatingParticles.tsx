import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  char: string;
  left: number;
  duration: number;
  delay: number;
  drift: number;
  rotation: number;
  size: number;
  opacity: number;
}

const ICONS = ['🌸', '✨', '💖', '💕', '🌷', '🦋', '🤍'];

export const FloatingParticles: React.FC = React.memo(() => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Generate a conservative, performant set of 12 particles (8 on smaller screens)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const count = isMobile ? 8 : 12;

    const items: Particle[] = [];
    for (let i = 0; i < count; i++) {
      items.push({
        id: i,
        char: ICONS[i % ICONS.length],
        left: Math.floor((i / count) * 90 + Math.random() * 8),
        duration: 10 + Math.floor(Math.random() * 8),
        delay: Math.floor(Math.random() * 8),
        drift: -40 + Math.floor(Math.random() * 80),
        rotation: Math.floor(Math.random() * 360),
        size: 14 + Math.floor(Math.random() * 12),
        opacity: 0.5 + Math.random() * 0.35,
      });
    }
    setParticles(items);

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={
            {
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              '--duration': `${p.duration}s`,
              '--delay': `${p.delay}s`,
              '--drift': `${p.drift}px`,
              '--rot': `${p.rotation}deg`,
            } as React.CSSProperties
          }
        >
          {p.char}
        </span>
      ))}
    </div>
  );
});

FloatingParticles.displayName = 'FloatingParticles';
