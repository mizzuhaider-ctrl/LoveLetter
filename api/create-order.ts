import { recordOrder } from './paymentStore.js';

// Set to true for safe ₹1 Razorpay sandbox testing, false for live ₹69 production
export const IS_TEST_MODE = false;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Only POST requests are supported.',
    });
  }

  const liveKeyId = process.env.RAZORPAY_KEY_ID?.trim();
  const liveKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const testKeyId = process.env.RAZORPAY_TEST_KEY_ID?.trim();
  const testKeySecret = process.env.RAZORPAY_TEST_KEY_SECRET?.trim();

  let activeKeyId = liveKeyId;
  let activeKeySecret = liveKeySecret;

  if (IS_TEST_MODE) {
    if (testKeyId && testKeySecret) {
      activeKeyId = testKeyId;
      activeKeySecret = testKeySecret;
    } else if (liveKeyId?.startsWith('rzp_test_') && liveKeySecret) {
      activeKeyId = liveKeyId;
      activeKeySecret = liveKeySecret;
    } else {
      console.warn('[Diagnostic] create-order: Test Mode active but test credentials not found.');
      return res.status(401).json({
        success: false,
        error: 'Test credentials required',
        message: 'Razorpay Test Mode requires RAZORPAY_TEST_KEY_ID and RAZORPAY_TEST_KEY_SECRET in environment variables. Your live keys remain untouched.',
      });
    }
  } else {
    if (!liveKeyId || !liveKeySecret) {
      console.error('[Diagnostic] create-order missing Razorpay credentials in environment.');
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Payment setup required. Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in environment variables.',
      });
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { proposalId, yourName, receipt: reqReceipt } = body;

    // In Test Mode: ₹1 = 100 paise. In Production: ₹69 = 6900 paise.
    const amountInPaise = IS_TEST_MODE ? 100 : 6900;
    const cleanProposalId = (proposalId || '').toString().trim() || `prop_${Date.now().toString(36)}`;
    const sanitizedId = cleanProposalId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'love';
    const receipt = reqReceipt || `rcpt_${sanitizedId}_${Date.now().toString().slice(-6)}`;
    const currency = 'INR';

    const authHeader = `Basic ${Buffer.from(`${activeKeyId}:${activeKeySecret}`).toString('base64')}`;

    const orderPayload = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        proposalId: cleanProposalId.slice(0, 40),
        creator: (yourName || 'Romantic Creator').toString().replace(/[^\w\s-]/gi, '').trim().slice(0, 40) || 'Romantic Creator',
        plan: 'PREMIUM',
        mode: IS_TEST_MODE ? 'TEST' : 'LIVE',
      },
    };

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      const status = response.status === 401 ? 401 : (response.status || 500);
      const desc = data?.error?.description || data?.message || 'Failed to create Razorpay order';
      console.error(`[Diagnostic] Razorpay order creation failed with status ${status}:`, desc);
      return res.status(status).json({
        success: false,
        error: desc,
        message: status === 401
          ? 'Razorpay credentials authentication failed. Please verify your API Key and Secret.'
          : (desc || 'Unable to generate Razorpay order. Please try again.'),
      });
    }

    // Persist order mapping to proposal ID safely in store
    recordOrder(cleanProposalId, data.id);

    return res.status(200).json({
      success: true,
      order_id: data.id,
      orderId: data.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: activeKeyId,
      key: activeKeyId,
      planName: 'PREMIUM',
      isTestMode: IS_TEST_MODE,
    });
  } catch (error: any) {
    console.error('[Diagnostic] Error in /api/create-order handler:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Order creation failed',
      message: error?.message || 'Server error while contacting Razorpay.',
    });
  }
}
