/**
 * Central Payment Configuration
 *
 * Switch modes with simple boolean flags:
 * - FREE_TEST_MODE: true   => Free simulated backend unlock (no Razorpay credentials or onboarding required), ₹0 display, demo test mode
 * - FREE_TEST_MODE: false  => Uses standard Razorpay Gateway integration:
 *     - PAYMENT_TEST_MODE: true  => ₹0 display (simulated ₹1 / 100 paise Razorpay Test Mode order)
 *     - PAYMENT_TEST_MODE: false => ₹69 display (6900 paise Razorpay Live Mode order)
 */

export const PAYMENT_CONFIG = {
  /**
   * Master Toggle for Free Testing / Demo Simulator:
   * Set to `false` for real production payments.
   */
  FREE_TEST_MODE: false,

  /** Razorpay Live Mode (false = Live production ₹69 / 6900 paise) */
  PAYMENT_TEST_MODE: false,

  /** Display price when in test mode (₹0) */
  DISPLAY_PRICE_TEST: 0,

  /** Display price when in production (₹69) */
  DISPLAY_PRICE_PROD: 69,

  /**
   * Internal Razorpay transaction amount in paise.
   * Razorpay requires minimum ₹1 (100 paise) to create an order.
   * In TEST MODE, this ₹1 (100 paise) simulated transaction is used internally for testing.
   * In PRODUCTION, 6900 paise (₹69) is charged.
   */
  TEST_PAYMENT_AMOUNT: 100, // 100 paise = ₹1 simulated test order
  PRODUCTION_PRICE: 6900,    // 6900 paise = ₹69 real production order

  currency: 'INR',
  planNameTest: 'PREMIUM',
  planNameProd: 'PREMIUM',
} as const;

/** Get active display price in INR (₹0 in test, ₹69 in prod) */
export function getDisplayPrice(
  isTestMode = PAYMENT_CONFIG.PAYMENT_TEST_MODE,
  isFreeTest = PAYMENT_CONFIG.FREE_TEST_MODE
): number {
  if (isFreeTest) return PAYMENT_CONFIG.DISPLAY_PRICE_TEST;
  return isTestMode ? PAYMENT_CONFIG.DISPLAY_PRICE_TEST : PAYMENT_CONFIG.DISPLAY_PRICE_PROD;
}

/** Get active Razorpay order amount in paise */
export function getOrderAmountPaise(isTestMode = PAYMENT_CONFIG.PAYMENT_TEST_MODE): number {
  return isTestMode ? PAYMENT_CONFIG.TEST_PAYMENT_AMOUNT : PAYMENT_CONFIG.PRODUCTION_PRICE;
}
