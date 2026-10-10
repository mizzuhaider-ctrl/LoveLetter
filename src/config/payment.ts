/**
 * Central Payment Configuration
 * Premium unlock price: strictly ₹69 (6900 paise)
 */

export const PAYMENT_CONFIG = {
  /** Display price in INR (₹69) */
  DISPLAY_PRICE: 69,

  /** Razorpay transaction amount in paise (6900 paise = ₹69) */
  PRODUCTION_PRICE: 6900,

  currency: 'INR',
  planName: 'PREMIUM',
} as const;

/** Get active display price in INR (always ₹69) */
export function getDisplayPrice(_isTestMode?: boolean, _isFreeTest?: boolean): number {
  return PAYMENT_CONFIG.DISPLAY_PRICE;
}

/** Get active Razorpay order amount in paise (always 6900 paise) */
export function getOrderAmountPaise(_isTestMode?: boolean): number {
  return PAYMENT_CONFIG.PRODUCTION_PRICE;
}
