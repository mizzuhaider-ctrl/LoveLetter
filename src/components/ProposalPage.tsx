import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LoveProposal } from '../types';
import { FloatingParticles } from './FloatingParticles';
import { AudioPlayer } from './AudioPlayer';
import { attemptPlay, getIsAudioStarted } from '../utils/audioController';

interface ProposalPageProps {
  proposal: LoveProposal;
  isRecipientView?: boolean;
  onBackToEdit?: () => void;
  onSayYes: () => void;
  audioStarted?: boolean;
  setAudioStarted?: (val: boolean) => void;
}

// Rotating playful messages when user taps NO 😏 (20 messages rotation)
const PLAYFUL_MESSAGES: string[] = [
  // 1-10 Existing messages
  'Nice try 😏',
  'Are you sure? 🥺',
  'Think again 💕',
  'Come on... say YES! 🥹',
  'Really? 😳',
  "You can't escape that easily 😏",
  'Try again, cutie 💕',
  "Don't break my heart 💔",
  'YES is right there 👀💕',
  'Nope, try again! 😂',
  // 11-20 New messages
  'Are you really saying NO? 🥺',
  'My heart says you’ll say YES ❤️',
  'One more chance? 🥹💕',
  'That’s not the answer I wanted 😭',
  'You know YES is the right choice 😏❤️',
  'Don’t make me chase you 😭💕',
  'Okay… but I’m not giving up 😌',
  'You almost got away! 😂💕',
  'Wait… think about us 🥺❤️',
  'I’ll keep asking until you say YES 😏💕',
];

export const ProposalPage: React.FC<ProposalPageProps> = React.memo(({
  proposal,
  isRecipientView = false,
  onBackToEdit,
  onSayYes,
  audioStarted,
  setAudioStarted,
}) => {
  // Moving NO button state across the ENTIRE viewport
  const [hasMoved, setHasMoved] = useState(false);
  const [noPos, setNoPos] = useState<{ x: number; y: number } | null>(null);
  const [noAttempts, setNoAttempts] = useState(0);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const yesButtonRef = useRef<HTMLButtonElement | null>(null);
  const questionRef = useRef<HTMLHeadingElement | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);
  const lastZoneIndexRef = useRef<number>(-1);
  const lastInteractionTimeRef = useRef<number>(0);

  const getInitialButtonPos = useCallback(() => {
    if (spacerRef.current) {
      const r = spacerRef.current.getBoundingClientRect();
      const buttonW = 110;
      return {
        x: Math.round(r.left + (r.width - buttonW) / 2),
        y: Math.round(r.top),
      };
    }
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      x: Math.round((vw - 110) / 2),
      y: Math.round(vh * 0.55),
    };
  }, []);

  // Initialize position and reset state on mount or navigation; prefetch celebration asset
  useEffect(() => {
    setCurrentMessage('');
    setNoAttempts(0);
    setHasMoved(false);
    lastInteractionTimeRef.current = 0;
    const initial = getInitialButtonPos();
    setNoPos(initial);
    const hintEl = document.getElementById('playful-no-hint');
    if (hintEl) {
      hintEl.remove();
    }

    // Warm celebration image cache off main thread so YES -> celebration is instantaneous
    if (typeof window !== 'undefined') {
      const prefetchImg = new Image();
      prefetchImg.src = '/assets/cat-kisses-camera.gif';
    }
  }, [getInitialButtonPos]);

  // Derive display question
  const getQuestionText = () => {
    switch (proposal.questionChoice) {
      case 'gf':
        return 'Will you be my girlfriend?';
      case 'forever':
        return 'Will you forever be mine?';
      case 'love':
        return 'Do you still Love me?';
      case 'custom':
        return proposal.customQuestion || 'Will you be mine forever?';
      default:
        return 'Will you be my girlfriend?';
    }
  };

  /**
   * Calculates random position across the ENTIRE viewport safe area:
   * Upper-left, upper-center, upper-right, near question, middle-left, middle-right,
   * lower-left, lower-right, lower-center, and diagonal roaming.
   * - Keeps 14-20px safe margin from all screen edges.
   * - Strictly prevents overlap with fixed YES button (24px cushion).
   * - Prevents overlap with header controls (Back & Music buttons).
   * - Prevents covering the question text directly.
   * - Enforces minimum leap distance of ~100px.
   */
  const calculateNextViewportPosition = useCallback(
    (prevPos: { x: number; y: number }): { x: number; y: number } => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

      const buttonW = 110;
      const buttonH = 48;

      // Safe boundaries
      const margin = Math.min(20, Math.max(14, Math.round(vw * 0.04)));
      const minX = margin;
      const maxX = Math.max(minX + 20, vw - buttonW - margin);

      const headerEl = document.querySelector('header');
      const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 55;
      const minY = Math.max(68, Math.round(headerBottom + 14));

      const footerEl = document.querySelector('footer');
      const footerTop = footerEl ? footerEl.getBoundingClientRect().top : vh - 35;
      const maxY = Math.max(minY + 50, Math.min(vh - buttonH - 20, Math.round(footerTop - buttonH - 12)));

      const yesRect = yesButtonRef.current?.getBoundingClientRect();
      const questionRect = questionRef.current?.getBoundingClientRect();
      const photoRect = photoRef.current?.getBoundingClientRect();

      const minDistance = Math.min(130, Math.max(90, Math.round(Math.min(vw, vh) * 0.22)));

      // 10 distinct safe zones covering the ENTIRE viewport
      const zones: Array<() => { x: number; y: number }> = [
        // 0. Upper-left
        () => ({
          x: minX + Math.random() * Math.min(45, (maxX - minX) * 0.25),
          y: minY + Math.random() * 30,
        }),
        // 1. Upper-center
        () => ({
          x: Math.max(minX, Math.min(maxX, (vw - buttonW) / 2 + (Math.random() * 60 - 30))),
          y: minY + Math.random() * 25,
        }),
        // 2. Upper-right
        () => ({
          x: Math.max(minX, maxX - Math.random() * Math.min(45, (maxX - minX) * 0.25)),
          y: minY + Math.random() * 30,
        }),
        // 3. Near question (flanked to the sides of question)
        () => {
          const qTop = questionRect ? questionRect.top : vh * 0.28;
          const qH = questionRect ? questionRect.height : 60;
          const onRight = Math.random() > 0.5;
          return {
            x: onRight ? maxX - Math.random() * 25 : minX + Math.random() * 25,
            y: Math.max(minY, Math.min(maxY, qTop + Math.random() * qH - 15)),
          };
        },
        // 4. Middle-left
        () => ({
          x: minX + Math.random() * Math.min(40, (maxX - minX) * 0.22),
          y: Math.max(minY, Math.min(maxY, vh * 0.42 + Math.random() * (vh * 0.12))),
        }),
        // 5. Middle-right
        () => ({
          x: Math.max(minX, maxX - Math.random() * Math.min(40, (maxX - minX) * 0.22)),
          y: Math.max(minY, Math.min(maxY, vh * 0.42 + Math.random() * (vh * 0.12))),
        }),
        // 6. Lower-left
        () => ({
          x: minX + Math.random() * Math.min(45, (maxX - minX) * 0.25),
          y: Math.max(minY, maxY - Math.random() * 35),
        }),
        // 7. Lower-right
        () => ({
          x: Math.max(minX, maxX - Math.random() * Math.min(45, (maxX - minX) * 0.25)),
          y: Math.max(minY, maxY - Math.random() * 35),
        }),
        // 8. Lower-center (comfortably above bottom-center YES button)
        () => ({
          x: Math.max(minX, Math.min(maxX, (vw - buttonW) / 2 + (Math.random() * 60 - 30))),
          y: Math.max(minY, (yesRect ? Math.max(minY, yesRect.top - buttonH - 28) : maxY - 40) - Math.random() * 20),
        }),
        // 9. Full-screen roaming diagonal
        () => ({
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
        }),
      ];

      // Build randomized list of zone indices, avoiding the last used zone
      const candidateIndices = zones
        .map((_, i) => i)
        .filter((i) => i !== lastZoneIndexRef.current)
        .sort(() => Math.random() - 0.5);

      for (const zIdx of candidateIndices) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const raw = zones[zIdx]();
          const candX = Math.round(Math.max(minX, Math.min(maxX, raw.x)));
          const candY = Math.round(Math.max(minY, Math.min(maxY, raw.y)));

          // 1. Distance check
          const dist = Math.hypot(candX - prevPos.x, candY - prevPos.y);
          if (dist < minDistance) {
            continue;
          }

          // 2. Collision test with YES button (with generous 24px safety envelope)
          if (yesRect) {
            const cushion = 24;
            const overlapsYes = !(
              candX + buttonW + cushion < yesRect.left ||
              candX - cushion > yesRect.right ||
              candY + buttonH + cushion < yesRect.top ||
              candY - cushion > yesRect.bottom
            );
            if (overlapsYes) {
              continue;
            }
          }

          // 3. Collision test with Back button or audio player
          if (candY < minY + 15) {
            if (candX < 110 || candX > vw - 130) {
              continue;
            }
          }

          // 4. Overlap check with question text center
          if (questionRect) {
            const directCenterOverlap =
              candX + buttonW * 0.7 > questionRect.left &&
              candX + buttonW * 0.3 < questionRect.right &&
              candY + buttonH * 0.7 > questionRect.top &&
              candY + buttonH * 0.3 < questionRect.bottom;
            if (directCenterOverlap) {
              continue;
            }
          }

          // 5. Overlap check with couple photo
          if (photoRect) {
            const cushion = 16;
            const overlapsPhoto = !(
              candX + buttonW + cushion < photoRect.left ||
              candX - cushion > photoRect.right ||
              candY + buttonH + cushion < photoRect.top ||
              candY - cushion > photoRect.bottom
            );
            if (overlapsPhoto) {
              continue;
            }
          }

          // Success!
          lastZoneIndexRef.current = zIdx;
          return { x: candX, y: candY };
        }
      }

      // Opposite corner fallbacks
      const oppositeFallbacks = [
        { x: minX + 10, y: minY + 10 },
        { x: maxX - 10, y: maxY - 10 },
        { x: maxX - 10, y: minY + 10 },
        { x: minX + 10, y: maxY - 10 },
        { x: Math.round((vw - buttonW) / 2), y: minY + 15 },
      ];
      const bestFallback = oppositeFallbacks.reduce((best, cur) => {
        const dCur = Math.hypot(cur.x - prevPos.x, cur.y - prevPos.y);
        const dBest = Math.hypot(best.x - prevPos.x, best.y - prevPos.y);
        return dCur > dBest ? cur : best;
      }, oppositeFallbacks[0]);

      return bestFallback;
    },
    []
  );

  const handleNoInteraction = useCallback(
    (e?: React.SyntheticEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Responsive throttle (200ms): eliminate duplicate rapid events (pointerdown -> touchstart -> click)
      const now = performance.now();
      if (now - lastInteractionTimeRef.current < 200) {
        return;
      }
      lastInteractionTimeRef.current = now;

      attemptPlay();

      setNoAttempts((prev) => {
        const next = prev + 1;
        const messageIndex = (next - 1) % PLAYFUL_MESSAGES.length;
        setCurrentMessage(PLAYFUL_MESSAGES[messageIndex]);
        return next;
      });

      const current = noPos || getInitialButtonPos();
      const next = calculateNextViewportPosition(current);
      setHasMoved(true);
      setNoPos(next);
    },
    [noPos, getInitialButtonPos, calculateNextViewportPosition]
  );

  // Keep NO button inside viewport on screen resize
  useEffect(() => {
    const handleResize = () => {
      if (!hasMoved) {
        setNoPos(getInitialButtonPos());
      } else if (noPos) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const buttonW = 110;
        const buttonH = 48;
        const margin = 16;
        setNoPos((prev) => {
          if (!prev) return prev;
          return {
            x: Math.max(margin, Math.min(vw - buttonW - margin, prev.x)),
            y: Math.max(68, Math.min(vh - buttonH - 24, prev.y)),
          };
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasMoved, noPos, getInitialButtonPos]);

  const handleYesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    attemptPlay();
    // Immediately clear and reset NO-attempt message and state
    setCurrentMessage('');
    setNoAttempts(0);
    setHasMoved(false);
    setNoPos(null);

    const hintEl = document.getElementById('playful-no-hint');
    if (hintEl) {
      hintEl.remove();
    }

    onSayYes();
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full relative overflow-hidden overflow-x-hidden flex flex-col justify-between p-3 xs:p-4 sm:p-6 select-none bg-gradient-to-br from-[#FF4370] via-[#FF6A88] via-[#FF8577] to-[#FFA270]"
    >
      {/* Lightweight floating romantic particles */}
      <FloatingParticles />

      {/* Top Controls Bar */}
      <header className="relative z-20 w-full max-w-2xl mx-auto flex items-center justify-between pt-2 px-1">
        {!isRecipientView && onBackToEdit ? (
          <button
            type="button"
            id="back-to-edit-btn"
            onClick={onBackToEdit}
            className="px-4 py-1.5 rounded-full bg-white/95 hover:bg-white text-rose-800 shadow-sm backdrop-blur-sm border border-white/50 text-sm font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back</span>
          </button>
        ) : (
          <div className="w-16" />
        )}

        <AudioPlayer />
      </header>

      {/* Center Content / Hero Question */}
      <main className="relative z-10 w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-center text-center px-4 py-5 sm:py-7 pb-24 sm:pb-28">
        {/* Couple Photo if uploaded, otherwise subtle decorative heart pulse */}
        {proposal.photoUrl ? (
          <div
            ref={photoRef}
            id="proposal-couple-photo-section"
            className="mb-3 sm:mb-4 flex items-center justify-center select-none"
          >
            <div className="relative p-1.5 rounded-3xl bg-white/35 backdrop-blur-md border border-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <img
                id="proposal-couple-photo-img"
                src={proposal.photoUrl}
                alt="Couple"
                className="w-28 h-28 xs:w-32 xs:h-32 sm:w-36 sm:h-36 object-cover rounded-2xl shadow-inner border border-white/40"
              />
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-md border-2 border-white animate-gentle-pulse">
                💖
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-2.5 sm:mb-3 inline-flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/20 backdrop-blur-md shadow-inner border border-white/40 animate-gentle-pulse">
            <span className="text-xl sm:text-2xl">💖</span>
          </div>
        )}

        {/* Question - Noticeably smaller, elegant serif, centered, comfortable spacing, max 2 lines */}
        <h1
          ref={questionRef}
          id="proposal-question-text"
          style={{
            fontSize: 'clamp(28px, 7vw, 42px)',
            fontWeight: 700,
            lineHeight: 1.12,
            textAlign: 'center',
          }}
          className="font-serif text-white tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.14)] mb-2.5 sm:mb-3 max-w-[290px] xs:max-w-[340px] sm:max-w-[420px] mx-auto"
        >
          {getQuestionText() === 'Will you be my girlfriend?' ? (
            <>
              Will you be my <br />
              girlfriend?
            </>
          ) : (
            getQuestionText()
          )}
        </h1>

        {/* Recipient Name */}
        <div className="mb-2">
          <span
            id="proposal-recipient-name"
            className="text-xl sm:text-2xl font-bold text-white tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)] inline-flex items-center gap-1.5"
          >
            {proposal.recipientName} 💖
          </span>
        </div>

        {/* From Sender Name / Letter seal */}
        <div className="mb-6 sm:mb-8">
          <button
            type="button"
            id="proposal-sender-name"
            onClick={() => attemptPlay()}
            className="text-xs sm:text-sm font-medium text-white/90 drop-shadow-sm inline-flex items-center gap-1 bg-black/15 px-3.5 py-1 rounded-full backdrop-blur-sm border border-white/20 cursor-pointer active:scale-95 transition"
          >
            From: {proposal.yourName} 💌
          </button>
          <button
            type="button"
            id="open-my-letter-btn"
            onClick={() => attemptPlay()}
            aria-label="OPEN MY LETTER 💌"
            className="sr-only"
          >
            OPEN MY LETTER 💌
          </button>
        </div>

        {/* Initial NO button position in content center */}
        <div
          ref={spacerRef}
          id="proposal-action-buttons-group"
          className="actions relative w-full max-w-[340px] xs:max-w-[370px] sm:max-w-[420px] mx-auto select-none flex items-center justify-center min-h-[48px] py-1"
        >
          {/* Fallback inline render before client mount / hydration */}
          {!noPos && (
            <button
              type="button"
              id="say-no-btn"
              onPointerDown={handleNoInteraction}
              onTouchStart={handleNoInteraction}
              onMouseEnter={handleNoInteraction}
              onClick={handleNoInteraction}
              className="h-[48px] px-7 sm:px-8 rounded-full bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white font-bold text-base sm:text-lg shadow-[0_8px_25px_rgba(0,0,0,0.18)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.22)] active:scale-95 border-2 border-white/90 cursor-pointer select-none whitespace-nowrap overflow-hidden flex items-center justify-center gap-2 touch-manipulation"
            >
              <span>No 😏</span>
            </button>
          )}
        </div>

        {/* Playful rotating message after every NO attempt - placed below actions container, auto-adjusting height, never clipped */}
        <div className="w-full flex flex-col items-center mt-3 sm:mt-4 min-h-[44px]">
          {currentMessage && (
            <div
              key={noAttempts}
              id="playful-no-hint"
              className="px-4 py-2 rounded-2xl sm:rounded-full bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-semibold border border-white/35 shadow-[0_2px_10px_rgba(0,0,0,0.1)] animate-bounce select-none whitespace-normal text-center max-w-[92vw] sm:max-w-[420px] h-auto leading-snug"
            >
              {currentMessage}
            </div>
          )}
        </div>
      </main>

      {/* FIXED BOTTOM-CENTER YES BUTTON - Horizontally centered, fixed with safe-area spacing, never moves */}
      <div
        id="proposal-yes-button-container"
        className="fixed bottom-[calc(28px+env(safe-area-inset-bottom,0px))] sm:bottom-9 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-auto select-none"
      >
        <button
          ref={yesButtonRef}
          type="button"
          id="say-yes-btn"
          onClick={handleYesClick}
          className="yes-button h-[48px] px-7 sm:px-8 rounded-full bg-white text-rose-600 hover:bg-rose-50 font-bold text-base sm:text-lg shadow-[0_8px_25px_rgba(0,0,0,0.18)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.22)] active:scale-95 transition-all duration-200 border-2 border-white cursor-pointer select-none whitespace-nowrap overflow-hidden flex items-center justify-center gap-2"
        >
          <span>Yes 💕</span>
        </button>
      </div>

      {/* NO BUTTON - Smooth, playful movement with ~350ms natural animation */}
      {noPos && (
        <div
          className="fixed left-0 top-0 z-50 pointer-events-auto select-none touch-manipulation"
          style={{
            transform: `translate3d(${noPos.x}px, ${noPos.y}px, 0)`,
            transition: hasMoved ? 'transform 350ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
            willChange: 'transform',
          }}
        >
          <button
            type="button"
            id="say-no-btn"
            onPointerDown={handleNoInteraction}
            onTouchStart={handleNoInteraction}
            onMouseEnter={handleNoInteraction}
            onClick={handleNoInteraction}
            className="h-[48px] px-6 sm:px-7 rounded-full bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white font-bold text-base sm:text-lg shadow-[0_8px_25px_rgba(0,0,0,0.18)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.22)] active:scale-95 border-2 border-white/90 cursor-pointer select-none whitespace-nowrap overflow-hidden flex items-center justify-center gap-2 touch-manipulation"
          >
            <span>No 😏</span>
          </button>
        </div>
      )}

      {/* Discreet footer note for aesthetic balance */}
      <footer className="relative z-10 text-center pb-2">
        <span className="text-[11px] text-white/70 font-medium">
          A special moment made with love 🌸
        </span>
      </footer>
    </div>
  );
});

ProposalPage.displayName = 'ProposalPage';
