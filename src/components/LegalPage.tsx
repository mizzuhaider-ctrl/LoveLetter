import React, { useState } from 'react';
import { LegalPageType } from '../types';
import { Heart, Mail, Clock, Shield, FileText, RefreshCw, ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';
import { Footer } from './Footer';

interface LegalPageProps {
  initialPage?: LegalPageType;
  onBack: () => void;
  onNavigateLegal: (page: LegalPageType) => void;
}

const SUPPORT_EMAIL = 'mizzuhaider@gmail.com';

export const LegalPage: React.FC<LegalPageProps> = ({
  initialPage = 'contact',
  onBack,
  onNavigateLegal,
}) => {
  const [activeTab, setActiveTab] = useState<LegalPageType>(initialPage);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleTabChange = (tab: LegalPageType) => {
    setActiveTab(tab);
    onNavigateLegal(tab);
  };

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
      } else {
        const ta = document.createElement('textarea');
        ta.value = SUPPORT_EMAIL;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FFF9F9] flex flex-col justify-between text-gray-800 antialiased selection:bg-rose-200 selection:text-rose-900">
      {/* Top Navigation Bar */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-rose-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to LoveLetter</span>
          </button>

          <div className="flex items-center gap-1.5 text-sm font-bold text-rose-600">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            <span>LoveLetter</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            type="button"
            id="tab-contact-us"
            onClick={() => handleTabChange('contact')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'contact'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-white text-gray-600 border border-rose-100 hover:bg-rose-50'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Us</span>
          </button>

          <button
            type="button"
            id="tab-privacy-policy"
            onClick={() => handleTabChange('privacy')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-white text-gray-600 border border-rose-100 hover:bg-rose-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>

          <button
            type="button"
            id="tab-terms-conditions"
            onClick={() => handleTabChange('terms')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-white text-gray-600 border border-rose-100 hover:bg-rose-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms & Conditions</span>
          </button>

          <button
            type="button"
            id="tab-refund-policy"
            onClick={() => handleTabChange('refund')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'refund'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-white text-gray-600 border border-rose-100 hover:bg-rose-50'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refund & Cancellation</span>
          </button>
        </div>

        {/* 1. CONTACT US PAGE */}
        {activeTab === 'contact' && (
          <div className="bg-white rounded-3xl border border-rose-100/90 shadow-[0_10px_35px_rgba(244,63,94,0.06)] p-6 sm:p-10 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="text-center space-y-2 border-b border-rose-100/80 pb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-500 mb-2">
                <Mail className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                LoveLetter
              </h1>
              <p className="text-sm sm:text-base font-medium text-rose-600">
                Personalized digital romantic love pages.
              </p>
            </div>

            {/* Customer Support Information */}
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span>Customer Support</span>
                </h2>
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-rose-800">Support Email</span>
                    <p className="text-base sm:text-lg font-bold text-gray-900 break-all font-mono mt-0.5">
                      {SUPPORT_EMAIL}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="px-3.5 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-rose-500" />
                          <span>Copy Email</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Write to Us</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Inquiry details */}
              <div className="p-5 rounded-2xl bg-[#FFFBFB] border border-rose-100 space-y-4 text-sm text-gray-700 leading-relaxed">
                <p>
                  For questions about orders, payments, personalized pages, or technical issues, customers can contact us through this email.
                </p>

                <div className="flex items-center gap-2.5 text-xs text-gray-600 font-medium pt-2 border-t border-rose-100">
                  <Clock className="w-4 h-4 text-rose-500 shrink-0" />
                  <span><strong>Response time:</strong> 1–2 business days.</span>
                </div>

                <div className="flex items-center gap-2.5 text-xs text-rose-700 font-medium bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500 shrink-0" />
                  <span>This is a digital service. No physical products are shipped.</span>
                </div>
              </div>
            </div>

            {/* Back action */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm shadow-[0_4px_18px_rgba(244,63,94,0.25)] transition active:scale-98 cursor-pointer"
              >
                Back to Create Love Page ❤️
              </button>
            </div>
          </div>
        )}

        {/* 2. PRIVACY POLICY */}
        {activeTab === 'privacy' && (
          <div className="bg-white rounded-3xl border border-rose-100/90 shadow-[0_10px_35px_rgba(244,63,94,0.06)] p-6 sm:p-10 space-y-6 animate-fade-in text-sm text-gray-700 leading-relaxed">
            <div className="border-b border-rose-100 pb-4">
              <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-xs text-gray-500 mt-1">Last updated: September 2026</p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">1. Information We Collect</h2>
              <p>
                When you create a personalized love letter page, we process the information you provide, such as your name, your recipient’s name, custom messages, and optional couple photo URLs. We do not sell, rent, or trade your personal information.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">2. How Your Data Is Stored & Shared</h2>
              <p>
                Personalized love pages are encoded and loaded dynamically so you can share your unique moment via link. Data needed to render your page is stored locally on your device (localStorage / browser storage) or within the shareable payload.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">3. Payment Information</h2>
              <p>
                Payments for our digital services are processed securely by third-party payment gateways (Razorpay). We never store your full credit card, debit card, or UPI PIN details on our servers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">4. Contacting Us About Privacy</h2>
              <p>
                If you have questions about your data, you may contact customer support anytime at <strong className="text-rose-600 font-mono">{SUPPORT_EMAIL}</strong>.
              </p>
            </section>
          </div>
        )}

        {/* 3. TERMS & CONDITIONS */}
        {activeTab === 'terms' && (
          <div className="bg-white rounded-3xl border border-rose-100/90 shadow-[0_10px_35px_rgba(244,63,94,0.06)] p-6 sm:p-10 space-y-6 animate-fade-in text-sm text-gray-700 leading-relaxed">
            <div className="border-b border-rose-100 pb-4">
              <h1 className="text-2xl font-bold text-gray-900">Terms & Conditions</h1>
              <p className="text-xs text-gray-500 mt-1">Last updated: September 2026</p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">1. Nature of the Service</h2>
              <p>
                LoveLetter is a digital web service allowing users to design and share personalized, interactive romantic proposal web pages. This is purely a digital software service; no physical goods, parcels, or letters are shipped.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">2. Acceptable Use</h2>
              <p>
                Users agree to use LoveLetter solely for lawful, personal romantic and celebratory purposes. You may not use the service to post defamatory, harassing, obscene, or infringing content.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">3. Permanent Digital Links</h2>
              <p>
                Upon successful payment of the Premium plan, a shareable link is generated to unlock your permanent romantic love page. Users are responsible for preserving and sharing their unique link.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">4. Support & Inquiries</h2>
              <p>
                For technical support or inquiries, please contact us at <strong className="text-rose-600 font-mono">{SUPPORT_EMAIL}</strong>.
              </p>
            </section>
          </div>
        )}

        {/* 4. REFUND & CANCELLATION POLICY */}
        {activeTab === 'refund' && (
          <div className="bg-white rounded-3xl border border-rose-100/90 shadow-[0_10px_35px_rgba(244,63,94,0.06)] p-6 sm:p-10 space-y-6 animate-fade-in text-sm text-gray-700 leading-relaxed">
            <div className="border-b border-rose-100 pb-4">
              <h1 className="text-2xl font-bold text-gray-900">Refund & Cancellation Policy</h1>
              <p className="text-xs text-gray-500 mt-1">Last updated: September 2026</p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">1. Digital Service Delivery</h2>
              <p>
                LoveLetter delivers instantaneous digital access. As soon as payment is confirmed by the payment gateway, your personal shareable link is unlocked and activated immediately. No physical shipping is involved.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">2. Refund Eligibility</h2>
              <p>
                Because digital goods and permanent web links cannot be returned once generated and delivered, purchases are generally non-refundable. However, we want every customer to have a delightful romantic experience. If you experience an issue such as:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>A duplicate or erroneous charge</li>
                <li>A technical malfunction where your link was not generated after verified payment</li>
              </ul>
              <p className="pt-1">
                Please contact our customer support team within <strong>7 days</strong> of the transaction with your Order ID or payment details.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">3. Processing Refunds</h2>
              <p>
                Approved refunds will be processed back to your original payment method (bank account, card, or UPI) within <strong>5–7 business days</strong> as per banking network timelines.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">4. Cancellation Policy</h2>
              <p>
                Because service fulfillment occurs immediately upon transaction completion, orders cannot be cancelled once processed.
              </p>
            </section>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              For any payment or refund questions, email us at <strong className="font-mono">{SUPPORT_EMAIL}</strong>.
            </div>
          </div>
        )}
      </main>

      {/* Website Footer */}
      <Footer onNavigateLegal={handleTabChange} />
    </div>
  );
};
