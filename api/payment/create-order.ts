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

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(400).json({
      success: false,
      error: 'Payment setup required',
      message: 'Payment setup required. Razorpay credentials are not configured.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { proposalId, yourName } = body;

    const amountInPaise = 100; // Test mode 100 paise
    const sanitizedId = (proposalId || 'love').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10);
    const receipt = `rcpt_${sanitizedId}_${Date.now().toString().slice(-6)}`;
    const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;

    const orderPayload = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        proposalId: (proposalId || '').slice(0, 40),
        creator: (yourName || 'Romantic Creator').trim().slice(0, 40),
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
      return res.status(response.status || 400).json({
        success: false,
        error: data?.error?.description || data?.message || 'Failed to create Razorpay order',
        message: data?.error?.description || 'Unable to generate Razorpay order.',
      });
    }

    return res.status(200).json({
      success: true,
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Order creation failed',
      message: error?.message || 'Server error while contacting Razorpay.',
    });
  }
}
