import { recordOrder } from './paymentStore';

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

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID?.trim();
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Payment setup required. Razorpay credentials are not configured.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { proposalId, yourName, currency: reqCurrency, receipt: reqReceipt } = body;

    const rawAmount = body.amount !== undefined ? Number(body.amount) : 6900;

    // Minimum amount: 100 paise (₹1)
    if (isNaN(rawAmount) || rawAmount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Amount must be at least 100 paise (₹1).',
      });
    }

    const amountInPaise = Math.round(rawAmount);
    const cleanProposalId = (proposalId || '').toString().trim() || `prop_${Date.now().toString(36)}`;
    const sanitizedId = cleanProposalId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'love';
    const receipt = reqReceipt || `rcpt_${sanitizedId}_${Date.now().toString().slice(-6)}`;
    const currency = reqCurrency || 'INR';

    const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;

    const orderPayload = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        proposalId: cleanProposalId.slice(0, 40),
        creator: (yourName || 'Romantic Creator').toString().replace(/[^\w\s-]/gi, '').trim().slice(0, 40) || 'Romantic Creator',
        plan: 'PREMIUM',
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
      return res.status(status).json({
        success: false,
        error: data?.error?.description || data?.message || 'Failed to create Razorpay order',
        message: data?.error?.description || 'Unable to generate Razorpay order. Please check your Razorpay credentials in .env.',
      });
    }

    // Persist order mapping to proposal ID safely
    try {
      recordOrder(cleanProposalId, data.id);
    } catch {
      // Non-fatal
    }

    return res.status(200).json({
      success: true,
      order_id: data.id,
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: RAZORPAY_KEY_ID,
      key: RAZORPAY_KEY_ID,
      planName: 'PREMIUM',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Order creation failed',
      message: error?.message || 'Server error while contacting Razorpay.',
    });
  }
}
