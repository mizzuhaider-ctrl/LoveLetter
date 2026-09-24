import React, { useEffect } from 'react';
import { LoveProposal } from '../types';
import { FloatingParticles } from './FloatingParticles';
import { AudioPlayer } from './AudioPlayer';
import { Sparkles } from 'lucide-react';
import { generatePermanentSlug, encodeProposalToPayload } from '../utils/storage';
import { PAYMENT_CONFIG, getDisplayPrice } from '../config/payment';

interface CelebrationPageProps {
  proposal: LoveProposal;
  isRecipientView?: boolean;
  onBackToProposal?: () => void;
  onOpenUnlockModal: () => void;
  onViewAsRecipient?: (url: string) => void;
  audioStarted?: boolean;
  setAudioStarted?: (val: boolean) => void;
}

const PREMIUM_FEATURES = [
  'Romantic Music',
  'Couple Photo',
  'Personalized Message',
  'YES / NO Experience',
  'Heart Animations',
  'Romantic Celebration',
  'Personal Shareable Link',
  'WhatsApp Sharing',
];

export const CelebrationPage: React.FC<CelebrationPageProps> = React.memo(({
  proposal,
  isRecipientView = false,
  onBackToProposal,
  onOpenUnlockModal,
  onViewAsRecipient,
}) => {
  // Ensure that no NO-attempt message or lingering hint exists on Celebration page
  useEffect(() => {
    const lingeringNoHint = document.getElementById('playful-no-hint');
    if (lingeringNoHint) {
      lingeringNoHint.remove();
    }
  }, []);

  const [copied, setCopied] = React.useState(false);

  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const slug = proposal.slug || generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.id);
    const payload = encodeProposalToPayload(proposal);
    return `${origin}/love/${slug}${payload ? `#${payload}` : ''}`;
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('Fallback needed');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const url = getShareUrl();
    const text = `Someone made something special for you ❤️\nOpen this:\n${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen w-full relative overflow-y-auto overflow-x-hidden flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-br from-[#FF4370] via-[#FF6A88] via-[#FF8577] to-[#FFA270] select-none">
      {/* Lightweight floating romantic particles */}
      <FloatingParticles />

      {/* Top Controls Bar */}
      <header className="relative z-20 w-full max-w-xl mx-auto flex items-center justify-between pt-2 px-1">
        {onBackToProposal && !isRecipientView ? (
          <button
            type="button"
            id="back-to-proposal-btn"
            onClick={() => {
              const lingeringNoHint = document.getElementById('playful-no-hint');
              if (lingeringNoHint) {
                lingeringNoHint.remove();
              }
              onBackToProposal();
            }}
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

      {/* Main Content (Shown after user clicks YES) */}
      <main className="relative z-10 w-full max-w-xl mx-auto my-auto flex flex-col items-center text-center px-3 py-4 sm:py-6">
        {/* Sweet Confirmation Message */}
        <h2
          id="confirmation-message"
          className="text-xl xs:text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.15)] leading-tight mb-5 font-serif-romantic text-center"
        >
          Awww, I knew you'd say yes! ❤️
        </h2>

        {/* EXACT CAT KISSES CAMERA ANIMATED GIF */}
        <img
          id="cat-kisses-camera-gif"
          src="/assets/cat-kisses-camera.gif"
          alt="Cute cat kisses camera"
          loading="eager"
          decoding="async"
          style={{
            display: "block",
            width: "min(534px, 85vw)",
            height: "auto",
            margin: "24px auto",
            objectFit: "contain"
          }}
        />

        {/* Optional Couple Photo */}
        {proposal.photoUrl && (
          <div
            id="celebration-couple-photo-section"
            className="w-full max-w-md mb-5 rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.18)] border-2 border-white/80 bg-white/40 p-1.5 backdrop-blur-sm"
          >
            <img
              id="celebration-couple-photo-img"
              src={proposal.photoUrl}
              alt="Together"
              className="w-full max-h-60 sm:max-h-64 object-cover rounded-2xl"
            />
          </div>
        )}

        {/* Personalized Message Card (MESSAGE FROM proposal.yourName) */}
        <div
          id="personalized-message-card"
          className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.14)] border border-white/70 mb-5 text-left relative overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-2 text-rose-500 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Message From {proposal.yourName || 'Me'}:</span>
          </div>

          <p className="text-gray-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
            "{proposal.message}"
          </p>

          <div className="mt-3 flex items-center justify-between text-xs text-rose-400/90 font-medium">
            <span>Always & forever</span>
            <span>💌 {proposal.yourName || 'Love'}</span>
          </div>
        </div>

        {/* If Creator Preview Mode: Show Premium Plan */}
        {!isRecipientView && !proposal.isUnlocked && (
          <div
            id="premium-unlock-card"
            className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)] border-2 border-white text-left relative overflow-hidden mb-4"
          >
            <div className="text-center mb-4">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                Make This Moment Yours Forever ❤️
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Your preview is ready. Unlock your personal shareable page.
              </p>
            </div>

            {/* Plan Card: 💖 PREMIUM */}
            <div className="rounded-2xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/80 to-pink-50/40 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-xs">
                  💖 {PAYMENT_CONFIG.PAYMENT_TEST_MODE ? 'PREMIUM' : 'PREMIUM'}
                </span>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-rose-600">
                    ₹{getDisplayPrice()}
                  </span>
                  {PAYMENT_CONFIG.PAYMENT_TEST_MODE && (
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                      TEST MODE
                    </p>
                  )}
                </div>
              </div>

              {/* Exact Features Checklist */}
              <div className="space-y-1.5 pt-2 border-t border-rose-200/80">
                {PREMIUM_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 font-medium">
                    <span className="text-rose-600 font-bold text-sm">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Required Action Button */}
            <button
              type="button"
              id="unlock-my-love-page-btn"
              onClick={onOpenUnlockModal}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-base shadow-[0_8px_25px_rgba(244,63,94,0.35)] active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>UNLOCK FOR ₹{getDisplayPrice()} ❤️</span>
            </button>

            {PAYMENT_CONFIG.PAYMENT_TEST_MODE && (
              <p className="text-center text-[11px] text-gray-500 mt-2 font-medium">
                TEST MODE — No real money will be charged.
              </p>
            )}
          </div>
        )}

        {/* After verified payment: Show "Your Love Page is Ready ❤️" */}
        {!isRecipientView && proposal.isUnlocked && (
          <div
            id="verified-love-page-card"
            className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)] border-2 border-emerald-200 text-center relative overflow-hidden mb-4"
          >
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-2">
              Your Love Page is Ready ❤️
            </h3>
            <p className="text-xs text-gray-600 mb-5">
              Your permanent page for {proposal.recipientName} is fully unlocked and ready to share!
            </p>

            <div className="space-y-3">
              <button
                type="button"
                id="copy-link-btn-celebration"
                onClick={handleCopyLink}
                className="w-full py-3.5 px-5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>{copied ? 'LINK COPIED! ✓' : 'COPY LINK 🔗'}</span>
              </button>

              <button
                type="button"
                id="whatsapp-share-btn-celebration"
                onClick={handleWhatsAppShare}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>SHARE ON WHATSAPP 💚</span>
              </button>

              <button
                type="button"
                id="open-my-page-btn-celebration"
                onClick={() => {
                  if (onViewAsRecipient) {
                    onViewAsRecipient(getShareUrl());
                  } else {
                    onOpenUnlockModal();
                  }
                }}
                className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 font-bold text-sm border-2 border-rose-200 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>OPEN MY PAGE ❤️</span>
              </button>
            </div>
          </div>
        )}
      </main>


      {/* Discreet footer */}
      <footer className="relative z-10 text-center pb-2">
        <span className="text-[11px] text-white/70 font-medium">
          Wrapped in eternal love 💕
        </span>
      </footer>
    </div>
  );
});

CelebrationPage.displayName = 'CelebrationPage';

