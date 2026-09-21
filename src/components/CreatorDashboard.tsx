import React, { useState, useEffect, useRef } from 'react';
import { Heart, Sparkles, AlertCircle } from 'lucide-react';
import { LoveProposal, QuestionChoice, LegalPageType } from '../types';
import { CouplePhotoUpload } from './CouplePhotoUpload';
import { AudioPlayer } from './AudioPlayer';
import { Footer } from './Footer';
import { attemptPlay, getIsPlaying } from '../utils/audioController';

interface CreatorDashboardProps {
  initialData: LoveProposal;
  onPreview: (data: LoveProposal) => void;
  onUpdateDraft?: (data: Partial<LoveProposal>) => void;
  onNavigateLegal: (page: LegalPageType) => void;
  onViewAsRecipient?: () => void;
}

const QUESTION_OPTIONS: { id: QuestionChoice; label: string }[] = [
  { id: 'gf', label: 'Will you be my girlfriend?' },
  { id: 'forever', label: 'Will you forever be mine?' },
  { id: 'love', label: 'Do you still Love me?' },
  { id: 'custom', label: 'Write your own...' },
];

export const CreatorDashboard: React.FC<CreatorDashboardProps> = React.memo(({
  initialData,
  onPreview,
  onUpdateDraft,
  onNavigateLegal,
  onViewAsRecipient,
}) => {
  const [recipientName, setRecipientName] = useState(initialData.recipientName);
  const [yourName, setYourName] = useState(initialData.yourName);
  const [questionChoice, setQuestionChoice] = useState<QuestionChoice>(
    initialData.questionChoice || 'gf'
  );
  const [customQuestion, setCustomQuestion] = useState(initialData.customQuestion || '');
  const [message, setMessage] = useState(initialData.message);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialData.photoUrl);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track if music has been triggered so we only start on the first character typed
  const hasTriggeredMusicRef = useRef(false);

  // Sync photoUrl if initialData changes (e.g. from IndexedDB or back navigation)
  useEffect(() => {
    if (initialData.photoUrl !== undefined) {
      setPhotoUrl(initialData.photoUrl);
    }
  }, [initialData.photoUrl]);

  const handleRecipientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setRecipientName(nextVal);
    if (errorMessage) setErrorMessage(null);

    // Start music ONLY when the user actually types the first character/letter into "Their Name"
    if (!hasTriggeredMusicRef.current && nextVal.trim().length > 0 && !getIsPlaying()) {
      hasTriggeredMusicRef.current = true;
      attemptPlay();
    }
  };

  const handlePhotoChange = (newPhoto?: string) => {
    setPhotoUrl(newPhoto);
    if (onUpdateDraft) {
      onUpdateDraft({ photoUrl: newPhoto });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedRecipient = recipientName.trim();
    const trimmedYour = yourName.trim();

    if (!trimmedRecipient) {
      setErrorMessage('Please enter their name 💌');
      return;
    }
    if (!trimmedYour) {
      setErrorMessage('Please enter your name 💖');
      return;
    }
    if (questionChoice === 'custom' && !customQuestion.trim()) {
      setErrorMessage('Please enter your custom question ✨');
      return;
    }

    const updatedProposal: LoveProposal = {
      ...initialData,
      recipientName: trimmedRecipient,
      yourName: trimmedYour,
      questionChoice,
      customQuestion: customQuestion.trim(),
      message: message.trim() || "You're the most beautiful person I know. I love you endlessly. 💕",
      photoUrl,
    };

    onPreview(updatedProposal);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F9] flex flex-col justify-between items-center relative">
      {/* Sound toggle: fixed, top-right, respects iPhone safe-area, z-[99999], always visible */}
      <div
        id="dashboard-sound-toggle-wrapper"
        className="fixed z-[99999] pointer-events-auto"
        style={{
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: 'max(16px, env(safe-area-inset-right, 16px))',
        }}
      >
        <AudioPlayer
          id="dashboard-sound-toggle-btn"
          className="w-10 h-10 sm:w-11 sm:h-11 shadow-md hover:shadow-lg border-rose-200/90 bg-white/95 text-rose-800 hover:bg-white"
        />
      </div>

      <div className="w-full flex-1 py-8 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-[#FEE8E8] shadow-[0_10px_35px_rgba(255,182,193,0.18)] relative transition-all duration-300">
          {/* Subtle decorative heart badge */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm animate-gentle-pulse">
            <Heart className="w-6 h-6 fill-rose-400 text-rose-500" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-7">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 leading-snug">
            Make your{' '}
            <span className="font-serif-romantic italic text-rose-500 font-semibold font-normal">
              special
            </span>{' '}
            someone say yes
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-normal">
            A cute page they literally can't say no to 🌸
          </p>
        </div>

        {/* Validation Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Their Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="recipient-name-input"
              className="block text-xs font-bold uppercase tracking-wider text-rose-900/80"
            >
              THEIR NAME
            </label>
            <input
              id="recipient-name-input"
              type="text"
              value={recipientName}
              onChange={handleRecipientNameChange}
              placeholder="recipient name"
              className="w-full px-4 py-3 rounded-2xl border border-rose-200/80 bg-[#FFFBFB] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-300 transition text-sm font-medium"
            />
          </div>

          {/* Your Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="your-name-input"
              className="block text-xs font-bold uppercase tracking-wider text-rose-900/80"
            >
              YOUR NAME
            </label>
            <input
              id="your-name-input"
              type="text"
              value={yourName}
              onChange={(e) => {
                setYourName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="your name"
              className="w-full px-4 py-3 rounded-2xl border border-rose-200/80 bg-[#FFFBFB] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-300 transition text-sm font-medium"
            />
          </div>

          {/* Pick Your Question */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-rose-900/80">
              PICK YOUR QUESTION
            </label>
            <div className="space-y-2">
              {QUESTION_OPTIONS.map((opt) => {
                const isSelected = questionChoice === opt.id;
                return (
                  <label
                    key={opt.id}
                    id={`question-opt-${opt.id}`}
                    onClick={() => {
                      setQuestionChoice(opt.id);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none text-sm font-medium ${
                      isSelected
                        ? 'border-rose-400 bg-rose-50/70 text-rose-950 shadow-sm'
                        : 'border-rose-100 hover:border-rose-200 bg-[#FFFAFA] text-gray-700'
                    }`}
                  >
                    {/* Radio visual indicator */}
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'border-rose-500 bg-rose-500'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="flex-1">{opt.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Custom Question input */}
            {questionChoice === 'custom' && (
              <div className="pt-1 transition-all duration-200">
                <input
                  id="custom-question-input"
                  type="text"
                  value={customQuestion}
                  onChange={(e) => {
                    setCustomQuestion(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Will you go to prom with me? 🌹"
                  className="w-full px-4 py-2.5 rounded-2xl border border-rose-300 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 text-sm font-medium"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Your Message */}
          <div className="space-y-1.5">
            <label
              htmlFor="your-message-textarea"
              className="block text-xs font-bold uppercase tracking-wider text-rose-900/80"
            >
              YOUR MESSAGE <span className="text-[11px] text-rose-500 font-normal lowercase">(shown after they say yes)</span>
            </label>
            <textarea
              id="your-message-textarea"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. You're the most beautiful person I know. I love you endlessly. 💕"
              className="w-full px-4 py-3 rounded-2xl border border-rose-200/80 bg-[#FFFBFB] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-300 transition text-sm font-medium resize-none"
            />
          </div>

          {/* Couple Photo (Optional) */}
          <CouplePhotoUpload photoUrl={photoUrl} onPhotoChange={handlePhotoChange} />

          {/* Preview Button */}
          <div className="pt-2">
            <button
              type="submit"
              id="preview-page-btn"
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-size-200 hover:bg-pos-100 text-white font-semibold text-base shadow-[0_4px_18px_rgba(244,63,94,0.35)] hover:shadow-[0_6px_22px_rgba(244,63,94,0.45)] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <Sparkles className="w-4 h-4 text-rose-100" />
              <span>✨ Preview Your Page</span>
            </button>
          </div>
        </form>
        </div>
      </div>

      {/* Website Footer with Contact Us, Privacy, Terms, and Refund */}
      <Footer onNavigateLegal={onNavigateLegal} />
    </div>
  );
});

CreatorDashboard.displayName = 'CreatorDashboard';
