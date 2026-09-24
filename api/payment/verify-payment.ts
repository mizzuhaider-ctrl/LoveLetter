import crypto from 'crypto';

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
      verified: false,
      error: 'Payment setup required',
      message: 'Payment setup required. Razorpay credentials are not configured.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { orderId, paymentId, signature } = body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing payment verification parameters',
        message: 'Order ID, payment ID, and signature are required.',
      });
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    let signatureVerified = false;
    if (expectedBuffer.length === receivedBuffer.length) {
      signatureVerified = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    }

    if (!signatureVerified) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Signature verification failed',
        message: 'Payment verification failed. Razorpay signature mismatch.',
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      orderId,
      paymentId,
      message: 'Payment signature verified successfully.',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Verification error',
      message: error?.message || 'Server error while verifying Razorpay signature.',
    });
  }
}
