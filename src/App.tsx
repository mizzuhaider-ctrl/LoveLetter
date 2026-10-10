/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LoveProposal, ViewState, LegalPageType } from './types';
import {
  saveProposal,
  getProposal,
  getRecentProposal,
  getPhotoFromIDB,
  decodeProposalFromPayload,
  generateUniqueId,
  markProposalPaid,
  isProposalPaid,
  getLastPaidProposal,
  setLastPaidProposal,
  checkBackendPaymentStatus,
  clearProposalPaid,
} from './utils/storage';
import { CreatorDashboard } from './components/CreatorDashboard';
import { ProposalPage } from './components/ProposalPage';
import { CelebrationPage } from './components/CelebrationPage';
import { UnlockShareModal } from './components/UnlockShareModal';
import { MusicSelectionModal } from './components/MusicSelectionModal';
import { LegalPage } from './components/LegalPage';

import { attemptPlay, setMusicLanguage } from './utils/audioController';

export default function App() {
  // Check if current URL is a recipient share link
  const [isRecipientRoute, setIsRecipientRoute] = useState(false);

  const [viewState, setViewState] = useState<ViewState>('creator');
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(true);

  const handleSelectMusic = useCallback((lang: 'hindi' | 'english') => {
    setProposal((prev) => {
      const updated = { ...prev, musicLanguage: lang };
      saveProposal(updated);
      return updated;
    });
    setMusicLanguage(lang);
    setIsMusicModalOpen(false);
  }, []);
  const [legalView, setLegalView] = useState<LegalPageType | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname.toLowerCase();
    const search = new URLSearchParams(window.location.search);
    const pageParam = search.get('page')?.toLowerCase();

    if (path === '/contact' || path === '/contact-us' || pageParam === 'contact') return 'contact';
    if (path === '/privacy' || path === '/privacy-policy' || pageParam === 'privacy') return 'privacy';
    if (path === '/terms' || path === '/terms-and-conditions' || pageParam === 'terms') return 'terms';
    if (path === '/refund' || path === '/cancellation' || path === '/refund-policy' || pageParam === 'refund') return 'refund';
    return null;
  });

  // Proposal state initialized with a fresh blank proposal for the creator page
  const [proposal, setProposal] = useState<LoveProposal>(() => ({
    id: generateUniqueId(),
    recipientName: '',
    yourName: '',
    questionChoice: 'gf',
    customQuestion: '',
    message: '',
    musicLanguage: 'hindi',
    createdAt: Date.now(),
  }));

  useEffect(() => {
    // Check if user accessed via explicit /love, /love/:id, /letter, or ?love=... or ?id=... or ?recipient=...
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    const isLovePath = pathname.startsWith('/love') || pathname.startsWith('/letter');
    const queryId = searchParams.get('id') || searchParams.get('love');
    const isRecipientParam =
      searchParams.get('recipient') === 'true' ||
      searchParams.get('view') === 'recipient' ||
      searchParams.get('mode') === 'recipient' ||
      searchParams.get('preview') === 'recipient';
    const isRecipientHash = hash.startsWith('#/love') || hash.startsWith('#love');

    const rzpPaymentId = searchParams.get('razorpay_payment_id');
    const rzpOrderId = searchParams.get('razorpay_order_id');
    const rzpSignature = searchParams.get('razorpay_signature');

    // Handle return from Razorpay checkout if redirected
    if (rzpPaymentId && rzpOrderId) {
      fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          razorpay_payment_id: rzpPaymentId,
          razorpay_order_id: rzpOrderId,
          razorpay_signature: rzpSignature || '',
          proposalId: proposal.id,
        }),
      })
        .then(async (res) => {
          try {
            return await res.json();
          } catch {
            return null;
          }
        })
        .then((data) => {
          if (data && data.success && data.verified) {
            markProposalPaid(proposal.id, {
              orderId: rzpOrderId,
              paymentId: rzpPaymentId,
            });
            setProposal((prev) => {
              const unlocked = { ...prev, isUnlocked: true, slug: data.slug || prev.slug };
              saveProposal(unlocked);
              setLastPaidProposal(unlocked);
              return unlocked;
            });
            setIsUnlockModalOpen(true);
          }
        })
        .catch((err) => console.warn('Razorpay return verification error:', err));
    }

    if (isLovePath || queryId || isRecipientParam || isRecipientHash) {
      const proposalIdentifier = isLovePath
        ? pathname.replace(/^\/(love|letter)\/?/, '').trim()
        : (queryId || '').trim();

      // 1. Try to decode from hash payload first
      if (hash && hash.length > 2 && !isRecipientHash) {
        const payloadStr = hash.replace(/^#/, '');
        const decoded = decodeProposalFromPayload(payloadStr);
        if (decoded && decoded.recipientName) {
          const lang = decoded.musicLanguage || 'hindi';
          setMusicLanguage(lang);
          setIsMusicModalOpen(false);
          const isPaid = isProposalPaid(decoded.id || '') || Boolean(decoded.isUnlocked);
          setProposal((prev) => ({
            ...prev,
            ...decoded,
            id: decoded.id || prev.id,
            slug: decoded.slug || proposalIdentifier,
            isUnlocked: isPaid,
          }));
          setIsRecipientRoute(true);
          setViewState('proposal');

          // Always verify with authoritative server backend
          if (decoded.id) {
            checkBackendPaymentStatus(decoded.id, (decoded as any).orderId).then((status) => {
              if (status.verified) {
                setProposal((prev) => ({
                  ...prev,
                  isUnlocked: true,
                  slug: status.slug || prev.slug,
                }));
              } else {
                clearProposalPaid(decoded.id!);
                setProposal((prev) => ({
                  ...prev,
                  isUnlocked: false,
                }));
              }
            });
          }
          return;
        }
      }

      // 2. Try to get from localStorage or server API by ID or slug
      if (proposalIdentifier) {
        const stored = getProposal(proposalIdentifier);
        if (stored) {
          const lang = stored.musicLanguage || 'hindi';
          setMusicLanguage(lang);
          setIsMusicModalOpen(false);
          const isPaid = isProposalPaid(stored.id) || Boolean(stored.isUnlocked);
          setProposal({ ...stored, isUnlocked: isPaid });
          setIsRecipientRoute(true);
          setViewState('proposal');

          // Check authoritative backend status
          checkBackendPaymentStatus(stored.id).then((status) => {
            if (status.verified) {
              setProposal((prev) => ({
                ...prev,
                isUnlocked: true,
                slug: status.slug || prev.slug,
              }));
            } else {
              clearProposalPaid(stored.id);
              setProposal((prev) => ({
                ...prev,
                isUnlocked: false,
              }));
            }
          });
          return;
        }
      }

      // 3. If query params have recipient name
      const rName = searchParams.get('r') || searchParams.get('to');
      const yName = searchParams.get('y') || searchParams.get('from');
      if (rName) {
        setProposal((prev) => ({
          ...prev,
          id: proposalIdentifier || prev.id,
          recipientName: rName,
          yourName: yName || 'Someone who loves you',
          isUnlocked: false,
        }));
        setIsRecipientRoute(true);
        setViewState('proposal');
        return;
      }

      // 4. Default for any public /love route so recipient is never kicked to creator dashboard
      const lastPaid = getLastPaidProposal();
      if (lastPaid && lastPaid.recipientName) {
        setProposal({ ...lastPaid, isUnlocked: true });
        checkBackendPaymentStatus(lastPaid.id).then((status) => {
          if (status.verified) {
            setProposal((prev) => ({
              ...prev,
              isUnlocked: true,
              slug: status.slug || prev.slug,
            }));
          } else {
            clearProposalPaid(lastPaid.id);
            setProposal((prev) => ({
              ...prev,
              isUnlocked: false,
            }));
          }
        });
      } else {
        const recent = getRecentProposal();
        if (recent && recent.recipientName) {
          const isPaid = isProposalPaid(recent.id);
          setProposal({ ...recent, isUnlocked: isPaid });
          if (isPaid) {
            checkBackendPaymentStatus(recent.id).then((status) => {
              if (!status.verified) {
                clearProposalPaid(recent.id);
                setProposal((prev) => ({
                  ...prev,
                  isUnlocked: false,
                }));
              }
            });
          }
        } else {
          setProposal((prev) => ({
            ...prev,
            recipientName: prev.recipientName || 'My Love',
            yourName: prev.yourName || 'Someone who loves you',
            questionChoice: 'gf',
            message: prev.message || "You're the most beautiful person I know. I love you endlessly. 💕",
            musicLanguage: prev.musicLanguage || 'hindi',
            isUnlocked: false,
          }));
        }
      }

      setIsRecipientRoute(true);
      setViewState('proposal');
    }
  }, []);

  // Update draft in real-time when inputs change
  const handleUpdateDraft = useCallback((partial: Partial<LoveProposal>) => {
    setProposal((prev) => {
      const updated = { ...prev, ...partial };
      saveProposal(updated);
      return updated;
    });
  }, []);

  // Handle transition from Creator to Proposal preview
  const handlePreview = useCallback((data: LoveProposal) => {
    setProposal(data);
    saveProposal(data);
    setViewState('proposal');
  }, []);

  // Handle saying YES
  const handleSayYes = useCallback(() => {
    setViewState('celebration');
  }, []);

  // Back to Proposal from celebration
  const handleBackToProposal = useCallback(() => {
    setViewState('proposal');
  }, []);

  // Back to Creator Dashboard from Proposal
  const handleBackToCreator = useCallback(() => {
    setIsRecipientRoute(false);
    setViewState('creator');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }

    // When the customer chooses "Back to Edit" after payment and wants to create a completely new LoveLetter:
    // - Generate a fresh proposal ID.
    // - Set isUnlocked to false.
    // - Remove the previous permanent slug from the new proposal.
    // - Do NOT carry over the previous payment status or unlocked state.
    // - The new LoveLetter must require a new ₹69 Razorpay payment.
    setProposal((prev) => {
      if (prev.isUnlocked || isProposalPaid(prev.id)) {
        return {
          id: generateUniqueId(),
          recipientName: '',
          yourName: prev.yourName || '',
          questionChoice: 'gf',
          customQuestion: '',
          message: '',
          photoUrl: undefined,
          musicLanguage: prev.musicLanguage || 'hindi',
          createdAt: Date.now(),
          isUnlocked: false,
          slug: undefined,
        };
      }
      return prev;
    });
  }, []);

  // Listen to browser forward/back buttons for legal pages and routes
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      const search = new URLSearchParams(window.location.search);
      const hash = window.location.hash;

      if (path === '/contact' || path === '/contact-us') {
        setLegalView('contact');
      } else if (path === '/privacy' || path === '/privacy-policy') {
        setLegalView('privacy');
      } else if (path === '/terms' || path === '/terms-and-conditions') {
        setLegalView('terms');
      } else if (path === '/refund' || path === '/cancellation' || path === '/refund-policy') {
        setLegalView('refund');
      } else if (path.startsWith('/love') || path.startsWith('/letter') || search.has('recipient') || search.has('love') || hash.startsWith('#/love')) {
        setLegalView(null);
        setIsRecipientRoute(true);
        setViewState('proposal');
      } else {
        setLegalView(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global listener for OPEN MY LETTER 💌 or related opening interactions
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const text = target.innerText || target.textContent || '';
      const id = target.id || '';
      const action = target.getAttribute('data-action') || '';
      if (
        /open.*letter/i.test(text) ||
        /open.*letter/i.test(id) ||
        /open.*letter/i.test(action) ||
        id === 'open-my-letter-btn' ||
        id === 'open-my-letter'
      ) {
        attemptPlay();
      }
    };
    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, []);

  // Legal navigation handlers
  const handleNavigateLegal = useCallback((page: LegalPageType) => {
    setLegalView(page);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/${page}`);
    }
  }, []);

  const handleBackFromLegal = useCallback(() => {
    setLegalView(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  }, []);

  // Test recipient view
  const handleViewAsRecipient = useCallback((shareUrl?: string) => {
    setIsUnlockModalOpen(false);
    setIsRecipientRoute(true);
    setViewState('proposal');
    if (typeof window !== 'undefined') {
      if (shareUrl) {
        try {
          const u = new URL(shareUrl, window.location.origin);
          window.history.pushState({}, '', u.pathname + u.search + u.hash);
        } catch {
          window.history.pushState({}, '', '/love');
        }
      } else {
        window.history.pushState({}, '', '/love');
      }
    }
  }, []);

  // If user navigated to Contact Us or a Legal Policy page:
  if (legalView) {
    return (
      <LegalPage
        initialPage={legalView}
        onBack={handleBackFromLegal}
        onNavigateLegal={handleNavigateLegal}
      />
    );
  }

  return (
    <div className="min-h-screen w-full font-sans antialiased text-gray-800 bg-[#FFF9F9]">
      {/* 1. CREATOR DASHBOARD VIEW */}
      {viewState === 'creator' && (
        <CreatorDashboard
          initialData={proposal}
          onPreview={handlePreview}
          onUpdateDraft={handleUpdateDraft}
          onNavigateLegal={handleNavigateLegal}
          onViewAsRecipient={() => handleViewAsRecipient()}
        />
      )}

      {/* 2. PROPOSAL VIEW */}
      {viewState === 'proposal' && (
        <ProposalPage
          proposal={proposal}
          isRecipientView={isRecipientRoute}
          onBackToEdit={handleBackToCreator}
          onSayYes={handleSayYes}
        />
      )}

      {/* 3. CELEBRATION VIEW */}
      {viewState === 'celebration' && (
        <CelebrationPage
          proposal={proposal}
          isRecipientView={isRecipientRoute}
          onBackToProposal={handleBackToProposal}
          onOpenUnlockModal={() => setIsUnlockModalOpen(true)}
          onViewAsRecipient={handleViewAsRecipient}
        />
      )}

      {/* UNLOCK & SHARE MODAL (ONLY ₹69 PLAN) */}
      <UnlockShareModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        proposal={proposal}
        onUnlocked={(updated) => setProposal(updated)}
        onViewAsRecipient={handleViewAsRecipient}
      />

      {/* ORIGINAL MUSIC SELECTION POPUP */}
      <MusicSelectionModal
        isOpen={isMusicModalOpen}
        onSelectMusic={handleSelectMusic}
      />



    </div>
  );
}
