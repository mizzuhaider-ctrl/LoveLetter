import React from 'react';
import { LegalPageType } from '../types';
import { Heart } from 'lucide-react';

interface FooterProps {
  onNavigateLegal: (page: LegalPageType) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateLegal }) => {
  const handleLinkClick = (e: React.MouseEvent, page: LegalPageType) => {
    e.preventDefault();
    onNavigateLegal(page);
  };

  return (
    <footer id="website-footer" className="w-full py-8 px-4 text-center mt-auto border-t border-rose-100/80 bg-white/60 backdrop-blur-xs">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        {/* Brand statement */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600/90 tracking-wide">
          <span>LoveLetter</span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-500 font-normal">Personalized digital romantic love pages</span>
          <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 inline ml-0.5" />
        </div>

        {/* Footer Navigation Links */}
        <nav aria-label="Footer Legal Navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-gray-600">
          <a
            href="/contact"
            id="footer-link-contact"
            onClick={(e) => handleLinkClick(e, 'contact')}
            className="hover:text-rose-600 transition-colors py-1 cursor-pointer"
          >
            Contact Us
          </a>
          <span className="text-gray-300 hidden sm:inline">•</span>
          <a
            href="/privacy"
            id="footer-link-privacy"
            onClick={(e) => handleLinkClick(e, 'privacy')}
            className="hover:text-rose-600 transition-colors py-1 cursor-pointer"
          >
            Privacy Policy
          </a>
          <span className="text-gray-300 hidden sm:inline">•</span>
          <a
            href="/terms"
            id="footer-link-terms"
            onClick={(e) => handleLinkClick(e, 'terms')}
            className="hover:text-rose-600 transition-colors py-1 cursor-pointer"
          >
            Terms & Conditions
          </a>
          <span className="text-gray-300 hidden sm:inline">•</span>
          <a
            href="/refund"
            id="footer-link-refund"
            onClick={(e) => handleLinkClick(e, 'refund')}
            className="hover:text-rose-600 transition-colors py-1 cursor-pointer"
          >
            Refund & Cancellation Policy
          </a>
        </nav>

        {/* Copyright notice */}
        <p className="text-[11px] text-gray-400">
          © {new Date().getFullYear()} LoveLetter. All rights reserved. This is a digital service.
        </p>
      </div>
    </footer>
  );
};
