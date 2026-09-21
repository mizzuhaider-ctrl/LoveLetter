import React, { useState, useEffect } from 'react';
import { LoveProposal } from '../types';
import {
  saveProposal,
  encodeProposalToPayload,
  generatePermanentSlug,
} from '../utils/storage';
import {
  X,
  Check,
  Copy,
  Heart,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface UnlockShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: LoveProposal;
  onUnlocked: (unlockedProposal: LoveProposal) => void;
  onViewAsRecipient: (url: string) => void;
}

const PREMIUM_FEATURES = [
  'Personalized names',
  'Couple photo',
  'Romantic message',
  'Custom question',
  'YES / NO experience',
  'Playful NO button',
  'Romantic music',
  'Heart animations',
  'YES celebration',
  'Permanent personal link',
  'WhatsApp sharing',
];

interface PaymentConfig {
  isConfigured: boolean;
  gateway?: string;
  keyId?: string;
  currency: string;
  price: number;
  planName: string;
}

function loadRazorpaySDK(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      if (window.Razorpay) return resolve(true);
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export const UnlockShareModal: React.FC<UnlockShareModalProps> = ({
  isOpen,
  onClose,
  proposal,
  onUnlocked,
  onViewAsRecipient,
}) => {
  const [step, setStep] = useState<'plan' | 'success'>(
    proposal.isUnlocked ? 'success' : 'plan'
  );
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  const [shareableUrl, setShareableUrl] = useState<string>(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const slug = proposal.slug || generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.id);
    const payload = encodeProposalToPayload(proposal);
    return `${origin}/love/${slug}${payload ? `#${payload}` : ''}`;
  });

  // Fetch Razorpay payment config on modal open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsSetupRequired(false);

    fetch('/api/payment/config')
      .then((res) => res.json())
      .then((data: PaymentConfig) => {
        setPaymentConfig(data);
        if (!data.isConfigured) {
          setIsSetupRequired(true);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch Razorpay config:', err);
      });
  }, [isOpen]);

  // Sync state if proposal already unlocked
  useEffect(() => {
    if (proposal.isUnlocked) {
      setStep('success');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const slug = proposal.slug || generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.id);
      const payload = encodeProposalToPayload(proposal);
      setShareableUrl(`${origin}/love/${slug}${payload ? `#${payload}` : ''}`);
    }
  }, [proposal.isUnlocked, proposal]);

  if (!isOpen) return null;

  // Handle clicking "Unlock My Love Page — ₹1 ❤️" with real Razorpay Checkout
  const handleInitiateRazorpayPayment = async () => {
    setErrorMessage(null);

    // If Razorpay is not configured in backend:
    if (paymentConfig && !paymentConfig.isConfigured) {
      setIsSetupRequired(true);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create order through secure backend
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          yourName: proposal.yourName,
          recipientName: proposal.recipientName,
        }),
      });

      const orderData = await res.json();

      if (!res.ok || !orderData.success || !orderData.orderId) {
        if (orderData.error === 'Payment setup required' || orderData.message?.includes('credentials')) {
          setIsSetupRequired(true);
        } else {
          setErrorMessage(orderData.message || orderData.error || 'Could not initiate Razorpay order.');
        }
        setIsLoading(false);
        return;
      }

      // 2. Load Razorpay JS SDK
      const isLoaded = await loadRazorpaySDK();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK could not be loaded in browser.');
      }

      setIsLoading(false);

      // 3. Initialize real Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise (e.g. 100 for ₹1)
        currency: orderData.currency || 'INR',
        name: 'LoveLetter',
        description: `Premium — ₹${paymentConfig?.price ?? 1} Love Page Unlock`,
        order_id: orderData.orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // Strictly verify payment on backend!
          await verifyBackendStatus(response);
        },
        prefill: {
          name: (proposal.yourName || 'Romantic Creator').trim(),
          email: 'romantic@loveletter.app',
          contact: '9999999999',
        },
        notes: {
          proposalId: proposal.id,
          plan: paymentConfig?.planName || 'Premium — ₹1',
        },
        theme: {
          color: '#F43F5E',
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
            setIsVerifying(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function (failResp: any) {
        console.warn('Razorpay payment failed:', failResp);
        setErrorMessage(failResp?.error?.description || 'Payment was unsuccessful or cancelled. Please try again.');
        setIsLoading(false);
        setIsVerifying(false);
      });

      razorpayInstance.open();
    } catch (err: any) {
      console.error('Razorpay payment initiation error:', err);
      setIsLoading(false);
      setErrorMessage(err?.message || 'Unable to open Razorpay checkout. Please try again.');
    }
  };

  // Verify payment status strictly via Backend
  const verifyBackendStatus = async (paymentDetails: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const verifyRes = await fetch('/api/payment/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentDetails),
      });

      const verifyData = await verifyRes.json();

      // STRICT BACKEND VERIFICATION
      if (verifyData.success && verifyData.verified) {
        // 1. Generate permanent unique slug such as: mezan-aisha-x7k2
        const permanentSlug = proposal.slug || generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.id);

        // 2. Save user's personalized LoveLetter data with unlocked status
        const unlockedProposal: LoveProposal = {
          ...proposal,
          isUnlocked: true,
          slug: permanentSlug,
        };
        saveProposal(unlockedProposal);
        onUnlocked(unlockedProposal);

        // 3. Construct permanent shareable link
        const origin = window.location.origin;
        const payload = encodeProposalToPayload(unlockedProposal);
        const permanentLink = `${origin}/love/${permanentSlug}${payload ? `#${payload}` : ''}`;
        setShareableUrl(permanentLink);

        // 4. Switch to success step
        setStep('success');
      } else {
        // Payment was not verified: DO NOT UNLOCK
        setErrorMessage(verifyData.message || 'Payment verification failed. Your link cannot be unlocked.');
      }
    } catch (err: any) {
      console.error('Razorpay payment verification error:', err);
      setErrorMessage('Could not verify payment status with server. Please try again.');
    } finally {
      setIsVerifying(false);
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareableUrl);
      } else {
        throw new Error('Fallback needed');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareableUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Someone made something special for you ❤️\nOpen this:\n${shareableUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-rose-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-rose-100/80 flex items-center justify-between bg-[#FFFBFB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {step === 'success' ? 'Your Love Page is Ready ❤️' : 'Make This Moment Yours Forever ❤️'}
              </h3>
              <p className="text-xs text-rose-500 font-medium">
                {step === 'success'
                  ? `Ready to share with ${proposal.recipientName || 'your love'}`
                  : (paymentConfig?.planName || 'Premium — ₹1')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* STEP 1: PAYMENT PLAN & RAZORPAY CHECKOUT */}
          {step === 'plan' && (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                  Make This Moment Yours Forever ❤️
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  The free preview is complete! Unlock your permanent shareable link for {proposal.recipientName || 'your love'}.
                </p>
              </div>

              {/* Razorpay Verified Secure Payment Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Secured by Razorpay (UPI, Cards, NetBanking, Wallets)</span>
              </div>

              {/* Plan Card: Premium — ₹1 */}
              <div className="rounded-3xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/80 to-pink-50/40 p-5 shadow-sm relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-xs">
                    {paymentConfig?.planName || 'Premium — ₹1'}
                  </span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-rose-600">₹{paymentConfig?.price ?? 1}</span>
                    <p className="text-[11px] text-gray-500 font-medium">Test payment</p>
                  </div>
                </div>

                {/* Exactly 11 Features Checklist */}
                <div className="space-y-1.5 pt-3 border-t border-rose-200/80">
                  {PREMIUM_FEATURES.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 font-medium">
                      <span className="text-rose-600 font-bold text-sm">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* If Razorpay is not configured: Show "Payment setup required" */}
              {isSetupRequired && (
                <div
                  id="payment-setup-required-box"
                  className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1 animate-fade-in shadow-xs"
                >
                  <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Payment setup required</span>
                  </div>
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Razorpay credentials (<code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code>) must be configured in environment settings to process live payments.
                  </p>
                </div>
              )}

              {/* Payment Status / Retry Error Notice */}
              {errorMessage && (
                <div
                  id="payment-error-retry-notice"
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2 animate-fade-in shadow-xs"
                >
                  <div className="flex items-center justify-center gap-1.5 text-rose-700 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Payment Not Completed</span>
                  </div>
                  <p className="text-xs text-rose-600 font-medium">
                    {errorMessage}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Your proposal data is safe. Please retry checkout to unlock your permanent link.
                  </p>
                </div>
              )}

              {/* Verification Spinner */}
              {isVerifying && (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 flex items-center justify-center gap-2 text-rose-600 text-xs font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying payment with Razorpay backend...</span>
                </div>
              )}

              {/* Action Button: Unlock My Love Page — ₹1 ❤️ */}
              <div className="pt-1">
                <button
                  type="button"
                  id="unlock-my-love-page-razorpay-btn"
                  disabled={isLoading || isVerifying}
                  onClick={handleInitiateRazorpayPayment}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-base shadow-[0_6px_20px_rgba(244,63,94,0.35)] active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Opening Razorpay Checkout...</span>
                    </>
                  ) : errorMessage ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Retry Payment — ₹{paymentConfig?.price ?? 1} ❤️</span>
                    </>
                  ) : (
                    <span>Unlock My Love Page — ₹{paymentConfig?.price ?? 1} ❤️</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SUCCESS & "Your Love Page is Ready ❤️" */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center pt-1 pb-1">
                <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Your Love Page is Ready ❤️
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Your personalized romantic page is unlocked and ready to share with {proposal.recipientName || 'your love'}.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold">Permanent Link Ready: /love/{proposal.slug || 'special'}</span>
              </div>

              {/* Shareable Link Input Box */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2 rounded-2xl border border-rose-200 bg-[#FFFBFB]">
                  <input
                    type="text"
                    readOnly
                    value={shareableUrl}
                    className="flex-1 bg-transparent text-xs text-gray-800 px-2 py-1.5 outline-none font-mono select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* EXACT 3 REQUIRED ACTION BUTTONS */}
              <div className="space-y-2.5 pt-2">
                {/* 1. COPY LINK 🔗 */}
                <button
                  type="button"
                  id="modal-copy-link-btn"
                  onClick={handleCopyLink}
                  className="w-full py-3.5 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copied ? 'LINK COPIED! ✓' : 'COPY LINK 🔗'}</span>
                </button>

                {/* 2. SHARE ON WHATSAPP 💚 */}
                <button
                  type="button"
                  id="modal-whatsapp-share-btn"
                  onClick={handleWhatsAppShare}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>SHARE ON WHATSAPP 💚</span>
                </button>

                {/* 3. OPEN MY PAGE ❤️ */}
                <button
                  type="button"
                  id="modal-open-my-page-btn"
                  onClick={() => {
                    onClose();
                    onViewAsRecipient(shareableUrl);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 font-bold text-sm border-2 border-rose-200 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>OPEN MY PAGE ❤️</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
