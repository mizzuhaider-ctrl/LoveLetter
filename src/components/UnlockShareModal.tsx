import React, { useState, useEffect } from 'react';
import { LoveProposal } from '../types';
import {
  saveProposal,
  encodeProposalToPayload,
  generatePermanentSlug,
  formatVercelShareUrl,
  VERCEL_PRODUCTION_ORIGIN,
  markProposalPaid,
  checkBackendPaymentStatus,
  setLastPaidProposal,
  clearProposalPaid,
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
  Info,
} from 'lucide-react';
import { PAYMENT_CONFIG, getDisplayPrice, getOrderAmountPaise } from '../config/payment';

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
  'Romantic Music',
  'Couple Photo',
  'Personalized Message',
  'YES / NO Experience',
  'Heart Animations',
  'Romantic Celebration',
  'Personal Shareable Link',
  'WhatsApp Sharing',
];

interface PaymentConfig {
  freeTestMode?: boolean;
  isConfigured: boolean;
  gateway?: string;
  keyId?: string;
  currency: string;
  price: number;
  displayPrice?: number;
  testMode?: boolean;
  simulatedTestAmount?: number;
  amountInPaise?: number;
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

type PaymentStatusState =
  | 'idle'
  | 'creating_order'
  | 'opening_checkout'
  | 'processing'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'verification_failed';

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
  const [instagramMessage, setInstagramMessage] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusState>('idle');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  const currentDisplayPrice = paymentConfig?.displayPrice ?? getDisplayPrice(false, false);

  const [shareableUrl, setShareableUrl] = useState<string>(() => {
    const slug = proposal.slug && proposal.slug.startsWith('loveletter-')
      ? proposal.slug
      : generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.slug || proposal.id);
    const payload = encodeProposalToPayload(proposal);
    return `${VERCEL_PRODUCTION_ORIGIN}/love/${slug}${payload ? `#${payload}` : ''}`;
  });

  // Ensure UI is never stuck on 'processing' if checkout window is dismissed or closed
  useEffect(() => {
    const handleFocusCheck = () => {
      if (paymentStatus === 'processing' || paymentStatus === 'opening_checkout') {
        setTimeout(() => {
          const razorpayModal = document.querySelector('.razorpay-container');
          if (!razorpayModal) {
            setPaymentStatus((prev) => {
              if (prev === 'processing' || prev === 'opening_checkout') {
                setErrorMessage((msg) => msg || 'Checkout was closed. You can retry anytime to unlock your page.');
                return 'cancelled';
              }
              return prev;
            });
          }
        }, 600);
      }
    };

    window.addEventListener('focus', handleFocusCheck);
    return () => window.removeEventListener('focus', handleFocusCheck);
  }, [paymentStatus]);

  // Fetch Razorpay payment config on modal open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsSetupRequired(false);
    setPaymentStatus('idle');

    fetch('/api/payment/config')
      .then((res) => res.json())
      .then((data: PaymentConfig) => {
        setPaymentConfig(data);
        if (!data.isConfigured) {
          setIsSetupRequired(true);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch payment config:', err);
      });
  }, [isOpen]);

  // Sync state and check authoritative backend verification
  useEffect(() => {
    const slug = proposal.slug && proposal.slug.startsWith('loveletter-')
      ? proposal.slug
      : generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.slug || proposal.id);
    const payload = encodeProposalToPayload(proposal);
    setShareableUrl(`${VERCEL_PRODUCTION_ORIGIN}/love/${slug}${payload ? `#${payload}` : ''}`);

    if (proposal.isUnlocked) {
      setStep('success');
      setPaymentStatus('success');
    } else {
      setStep('plan');
      setPaymentStatus('idle');
      setErrorMessage(null);
    }

    // Authoritative backend verification check
    if (isOpen && proposal.id) {
      checkBackendPaymentStatus(proposal.id).then((status) => {
        if (status.verified) {
          const confirmedSlug = status.slug || slug;
          const unlocked: LoveProposal = {
            ...proposal,
            isUnlocked: true,
            slug: confirmedSlug,
          };
          saveProposal(unlocked);
          setLastPaidProposal(unlocked);
          onUnlocked(unlocked);
          const confirmedPayload = encodeProposalToPayload(unlocked);
          setShareableUrl(`${VERCEL_PRODUCTION_ORIGIN}/love/${confirmedSlug}${confirmedPayload ? `#${confirmedPayload}` : ''}`);
          setStep('success');
          setPaymentStatus('success');
        } else {
          // Immediately force isUnlocked = false
          // Do NOT show the paid/celebration/unlocked state
          // Remove the localStorage key: love_page_paid_${proposalId}
          clearProposalPaid(proposal.id);
          const locked: LoveProposal = {
            ...proposal,
            isUnlocked: false,
          };
          saveProposal(locked);
          onUnlocked(locked);
          setStep('plan');
          setPaymentStatus('idle');
        }
      });
    }
  }, [proposal.isUnlocked, proposal.id, isOpen]);

  if (!isOpen) return null;

  // Initiate real Razorpay checkout
  const handleInitiatePayment = () => {
    handleInitiateRazorpayPayment();
  };

  // Handle clicking "UNLOCK FOR ₹69 ❤️" via Razorpay
  const handleInitiateRazorpayPayment = async () => {
    setErrorMessage(null);

    // If Razorpay credentials are not configured in backend:
    if (paymentConfig && !paymentConfig.isConfigured) {
      setIsSetupRequired(true);
      return;
    }

    // 1. First ensure Razorpay JS SDK is loaded before initiating
    setPaymentStatus('opening_checkout');
    const isLoaded = await loadRazorpaySDK();
    if (!isLoaded || !window.Razorpay) {
      setPaymentStatus('failed');
      setErrorMessage('Razorpay Checkout SDK could not be loaded. Please check your internet connection.');
      return;
    }

    setPaymentStatus('creating_order');

    try {
      // 2. Create order on the server
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          amount: getOrderAmountPaise(),
          currency: 'INR',
          proposalId: (proposal.id || '').replace(/[^\w-]/g, '').slice(0, 40),
          yourName: (proposal.yourName || 'Romantic Creator').replace(/[^\w\s-]/gi, '').slice(0, 40),
          recipientName: (proposal.recipientName || 'Beloved').replace(/[^\w\s-]/gi, '').slice(0, 40),
        }),
      });

      // Defensive JSON parsing - never throw "The string did not match the expected pattern" on non-JSON
      let orderData: any = null;
      const rawText = await res.text();
      try {
        orderData = JSON.parse(rawText);
      } catch {
        throw new Error(
          res.ok
            ? 'Invalid response format from payment server.'
            : `Payment server error (${res.status}): ${rawText.slice(0, 100) || res.statusText}`
        );
      }

      const orderId = orderData?.order_id || orderData?.orderId;

      if (!res.ok || !orderData?.success || !orderId) {
        setErrorMessage(
          orderData?.message ||
          orderData?.error ||
          'Razorpay order creation failed. Please try again.'
        );
        setPaymentStatus('failed');
        return;
      }

      // Validate orderId format before passing to Razorpay SDK
      if (typeof orderId !== 'string' || !/^order_[a-zA-Z0-9]+$/.test(orderId)) {
        throw new Error(`Invalid order ID format received from server (${orderId}).`);
      }

      setPaymentStatus('opening_checkout');

      // 3. Initialize Standard Razorpay Checkout with server-created order_id
      const checkoutDescription = 'Premium Love Page Unlock';
      const viteKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;

      // Sanitize prefill name (strip emojis and special characters that cause Razorpay input pattern failure)
      const sanitizedName = (proposal.yourName || 'Romantic Creator')
        .replace(/[^\w\s-]/gi, '')
        .trim() || 'Romantic Creator';

      const options: any = {
        key: orderData.keyId || orderData.key || viteKey,
        amount: orderData.amount, // in paise (6900 paise for ₹69)
        currency: orderData.currency || 'INR',
        name: 'LoveLetter',
        description: checkoutDescription,
        order_id: orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // Strictly verify payment on backend!
            await verifyBackendStatus(response);
          } catch (handlerErr: any) {
            console.error('Handler verification error:', handlerErr);
            setErrorMessage(handlerErr?.message || 'Payment verification encountered an issue.');
            setPaymentStatus('verification_failed');
          }
        },
        prefill: {
          name: sanitizedName,
          email: 'romantic@loveletter.app',
        },
        notes: {
          proposalId: (proposal.id || '').replace(/[^\w-]/g, '').slice(0, 40),
          plan: 'PREMIUM',
        },
        theme: {
          color: '#F43F5E',
        },
        modal: {
          ondismiss: function () {
            setPaymentStatus((prev) => {
              if (prev === 'verifying' || prev === 'success') return prev;
              setErrorMessage('Payment was cancelled or closed. You can retry anytime to unlock your page.');
              return 'cancelled';
            });
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (failResp: any) {
        console.warn('Razorpay payment failed:', failResp);
        const failMessage = failResp?.error?.description || failResp?.error?.reason || 'Payment was unsuccessful or cancelled.';
        setErrorMessage(failMessage);
        setPaymentStatus('failed');
      });

      setPaymentStatus('processing');
      razorpayInstance.open();
    } catch (err: any) {
      console.error('Razorpay payment initiation error:', err);
      setErrorMessage(err?.message || 'Unable to open Razorpay checkout. Please try again.');
      setPaymentStatus('failed');
    }
  };

  // Verify payment status strictly via Backend HMAC SHA256 & API check
  const verifyBackendStatus = async (paymentDetails: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setPaymentStatus('verifying');
    setErrorMessage(null);

    const paymentId = (paymentDetails.razorpay_payment_id || '').trim();
    const orderId = (paymentDetails.razorpay_order_id || '').trim();
    const signature = (paymentDetails.razorpay_signature || '').trim();

    if (!paymentId || !orderId || !signature) {
      setPaymentStatus('verification_failed');
      setErrorMessage('Incomplete payment response from Razorpay.');
      return;
    }

    const permanentSlug = (proposal.slug && proposal.slug.startsWith('loveletter-'))
      ? proposal.slug
      : generatePermanentSlug(proposal.yourName, proposal.recipientName, proposal.slug || proposal.id);

    try {
      const verifyRes = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: signature,
          order_id: orderId,
          payment_id: paymentId,
          signature: signature,
          proposalId: proposal.id,
          slug: permanentSlug,
        }),
      });

      // Defensive JSON parsing
      let verifyData: any = null;
      const vText = await verifyRes.text();
      try {
        verifyData = JSON.parse(vText);
      } catch {
        throw new Error(
          verifyRes.ok
            ? 'Invalid verification response from server.'
            : `Verification server error (${verifyRes.status}): ${vText.slice(0, 100) || verifyRes.statusText}`
        );
      }

      // STRICT BACKEND VERIFICATION CHECK
      if (verifyData.success && verifyData.verified) {
        const confirmedSlug = verifyData.slug || permanentSlug;

        // Record payment strictly bound to this exact proposal ID
        markProposalPaid(proposal.id, {
          orderId: verifyData.orderId || orderId,
          paymentId: verifyData.paymentId || paymentId,
        });

        // 2. Save user's personalized LoveLetter data with unlocked status
        const unlockedProposal: LoveProposal = {
          ...proposal,
          isUnlocked: true,
          slug: confirmedSlug,
        };
        saveProposal(unlockedProposal);
        setLastPaidProposal(unlockedProposal);
        onUnlocked(unlockedProposal);

        // Update browser address bar to permanent link for persistent recovery
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', `/love/${encodeURIComponent(confirmedSlug)}`);
          } catch {
            // ignore
          }
        }

        // 3. Construct permanent shareable link safely
        let payload = '';
        try {
          payload = encodeProposalToPayload(unlockedProposal);
        } catch {
          payload = '';
        }

        const permanentLink = `${VERCEL_PRODUCTION_ORIGIN}/love/${confirmedSlug}${payload ? `#${payload}` : ''}`;
        setShareableUrl(permanentLink);

        // 4. Switch to success
        setPaymentStatus('success');
        setStep('success');
      } else {
        // Payment was not verified: DO NOT UNLOCK
        setPaymentStatus('verification_failed');
        setErrorMessage(verifyData.message || 'Payment could not be verified. Link cannot be unlocked.');
      }
    } catch (err: any) {
      console.error('Razorpay payment verification error:', err);
      setPaymentStatus('verification_failed');
      setErrorMessage(err?.message || 'Payment could not be verified due to server error. Link cannot be unlocked.');
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

  const handleInstagramShare = async () => {
    const instagramUrl = formatVercelShareUrl(shareableUrl);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(instagramUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = instagramUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      // fallback
    }
    setInstagramMessage(true);
    setTimeout(() => setInstagramMessage(false), 4000);
    // Open Instagram app or web
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  };

  const isActionDisabled =
    paymentStatus === 'creating_order' ||
    paymentStatus === 'opening_checkout' ||
    paymentStatus === 'verifying';

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
                {step === 'success' ? 'Payment Successful ❤️' : 'Make This Moment Yours Forever ❤️'}
              </h3>
              <p className="text-xs text-rose-500 font-medium">
                {step === 'success' ? 'Your LoveLetter is ready.' : '💖 PREMIUM'}
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
          {/* STEP 1: PAYMENT PLAN & UNLOCK */}
          {step === 'plan' && (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                  Make This Moment Yours Forever ❤️
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Your preview is ready. Unlock your personal shareable page.
                </p>
              </div>

              {/* Mode Notice */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  Secured by Razorpay (UPI, Cards, NetBanking, Wallets)
                </span>
              </div>

              {/* Plan Card: 💖 PREMIUM */}
              <div className="rounded-3xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/80 to-pink-50/40 p-5 shadow-sm relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-xs">
                    💖 PREMIUM
                  </span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-rose-600">₹{currentDisplayPrice}</span>
                    <p className="text-[11px] text-gray-500 font-medium">One-time payment</p>
                  </div>
                </div>

                {/* Exactly 8 Features Checklist */}
                <div className="space-y-1.5 pt-3 border-t border-rose-200/80">
                  {PREMIUM_FEATURES.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 font-medium">
                      <span className="text-rose-600 font-bold text-sm">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* If Razorpay is not configured in environment */}
              {isSetupRequired && (
                <div
                  id="payment-setup-required-box"
                  className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1 animate-fade-in shadow-xs"
                >
                  <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Razorpay is not configured yet.</span>
                  </div>
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Please provide <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> in your environment variables to enable the Razorpay checkout flow.
                  </p>
                </div>
              )}

              {/* Payment Error / Cancellation Notice */}
              {errorMessage && (
                <div
                  id="payment-error-retry-notice"
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2 animate-fade-in shadow-xs"
                >
                  <div className="flex items-center justify-center gap-1.5 text-rose-700 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>
                      {paymentStatus === 'verification_failed'
                        ? 'Payment Verification Failed'
                        : 'Unlock Not Completed'}
                    </span>
                  </div>
                  <p className="text-xs text-rose-600 font-medium">
                    {errorMessage}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Your proposal data is safe. Please retry to unlock your permanent link.
                  </p>
                </div>
              )}

              {/* Payment Processing & Verification Spinners */}
              {paymentStatus === 'verifying' && (
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex items-center justify-center gap-2 text-rose-600 text-xs font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Razorpay signature with backend...</span>
                </div>
              )}

              {paymentStatus === 'opening_checkout' && (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 flex items-center justify-center gap-2 text-rose-600 text-xs font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Opening Razorpay Checkout...</span>
                </div>
              )}

              {/* Action Button: UNLOCK FOR ₹69 ❤️ */}
              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  id="unlock-my-love-page-razorpay-btn"
                  disabled={isActionDisabled}
                  onClick={handleInitiatePayment}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-base shadow-[0_6px_20px_rgba(244,63,94,0.35)] active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paymentStatus === 'creating_order' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating Razorpay Order...</span>
                    </>
                  ) : paymentStatus === 'opening_checkout' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Opening Razorpay Checkout...</span>
                    </>
                  ) : paymentStatus === 'verifying' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying Signature...</span>
                    </>
                  ) : paymentStatus === 'processing' && !errorMessage ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Checkout in Progress...</span>
                    </>
                  ) : errorMessage || paymentStatus === 'failed' || paymentStatus === 'cancelled' ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        Retry — UNLOCK FOR ₹{currentDisplayPrice} ❤️
                      </span>
                    </>
                  ) : (
                    <span>UNLOCK FOR ₹{currentDisplayPrice} ❤️</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SUCCESS & Payment Successful */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center pt-1 pb-1">
                <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Payment Successful ❤️
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Your LoveLetter is ready.
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

              {/* EXACT REQUIRED ACTION BUTTONS */}
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

                {/* 3. SHARE ON INSTAGRAM 📸 */}
                <button
                  type="button"
                  id="modal-instagram-share-btn"
                  onClick={handleInstagramShare}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-95 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <span>📸</span>
                  <span>Share on Instagram</span>
                </button>

                {/* Instagram copy confirmation notice */}
                {instagramMessage && (
                  <p className="text-center text-xs text-rose-600 font-semibold animate-fade-in">
                    Link copied ❤️ Open Instagram and paste it.
                  </p>
                )}

                {/* 4. OPEN MY PAGE ❤️ */}
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

