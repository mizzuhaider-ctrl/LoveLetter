/**
 * Razorpay Payment Configuration API (Public Endpoint)
 * Never exposes key secrets or sensitive information.
 */

// Set to true for safe ₹1 Razorpay sandbox testing, false for live ₹69 production
export const IS_TEST_MODE = false;

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const liveKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const liveKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const testKeyId = (process.env.RAZORPAY_TEST_KEY_ID || '').trim();
  const testKeySecret = (process.env.RAZORPAY_TEST_KEY_SECRET || '').trim();

  let activeKeyId = liveKeyId;
  let isConfigured = Boolean(liveKeyId && liveKeySecret);

  if (IS_TEST_MODE) {
    if (testKeyId && testKeySecret) {
      activeKeyId = testKeyId;
      isConfigured = true;
    } else if (liveKeyId.startsWith('rzp_test_') && liveKeySecret) {
      activeKeyId = liveKeyId;
      isConfigured = true;
    } else {
      activeKeyId = testKeyId || liveKeyId;
      // In test mode, needs a test key (either RAZORPAY_TEST_KEY_ID or rzp_test_ key in RAZORPAY_KEY_ID)
      isConfigured = Boolean((testKeyId && testKeySecret) || (liveKeyId.startsWith('rzp_test_') && liveKeySecret));
    }
  }

  return res.status(200).json({
    isConfigured,
    keyId: activeKeyId,
    currency: 'INR',
    price: 69,
    displayPrice: 69,
    amountInPaise: IS_TEST_MODE ? 100 : 6900,
    isTestMode: IS_TEST_MODE,
    planName: 'PREMIUM',
  });
}
