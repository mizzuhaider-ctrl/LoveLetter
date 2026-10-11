/**
 * Central Payment Configuration
 * Customer Display Price: Strictly ₹69
 *
 * TEST MODE TOGGLE:
 * - When IS_TEST_MODE is true: Order amount is set to ₹1 (100 paise) for safe Razorpay sandbox testing.
 * - When IS_TEST_MODE is false: Live production checkout strictly charges ₹69 (6900 paise).
 * - Customer-facing UI always displays ₹69 in both modes.
 */

export const PAYMENT_CONFIG = {
  /** Customer-facing display price in INR (always ₹69) */
  DISPLAY_PRICE: 69,

  /** Live Razorpay transaction amount in paise (6900 paise = ₹69) */
  PRODUCTION_PRICE: 6900,

  /** Test Razorpay transaction amount in paise (100 paise = ₹1) */
  TEST_PRICE_PAISE: 100,

  /**
   * Set to true for safe ₹1 Razorpay sandbox testing.
   * Set to false to restore ₹69 live customer checkout.
   */
  IS_TEST_MODE: false,

  currency: 'INR',
  planName: 'PREMIUM',
} as const;

/** Get customer-facing display price in INR (always ₹69) */
export function getDisplayPrice(_isTestMode?: boolean, _isFreeTest?: boolean): number {
  return PAYMENT_CONFIG.DISPLAY_PRICE;
}

/** Get active Razorpay order amount in paise (100 paise in test mode, 6900 paise in live mode) */
export function getOrderAmountPaise(isTestMode?: boolean): number {
  const activeTest = typeof isTestMode === 'boolean' ? isTestMode : PAYMENT_CONFIG.IS_TEST_MODE;
  return activeTest ? PAYMENT_CONFIG.TEST_PRICE_PAISE : PAYMENT_CONFIG.PRODUCTION_PRICE;
}
