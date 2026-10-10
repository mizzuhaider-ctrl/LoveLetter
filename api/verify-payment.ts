import crypto from 'crypto';
import {
  recordVerifiedPayment,
  getVerifiedPayment,
  getVerifiedPaymentByOrderId,
} from './paymentStore';

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
      verified: false,
      error: 'Authentication failed',
      message: 'Payment setup required. Razorpay credentials are not configured in environment variables.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id: altOrderId,
      payment_id: altPaymentId,
      signature: altSignature,
      orderId: legacyOrderId,
      paymentId: legacyPaymentId,
      signature: legacySignature,
      proposalId: rawProposalId,
    } = body;

    const orderId = String(razorpay_order_id || altOrderId || legacyOrderId || '').trim();
    const paymentId = String(razorpay_payment_id || altPaymentId || legacyPaymentId || '').trim();
    const signature = String(razorpay_signature || altSignature || legacySignature || '').trim();
    const proposalId = String(rawProposalId || '').trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing required fields',
        message: 'order_id, payment_id, and signature are required to verify payment.',
      });
    }

    // Idempotent check: if already verified in persistent store
    if (proposalId) {
      const existing = getVerifiedPayment(proposalId) || getVerifiedPaymentByOrderId(orderId);
      if (existing) {
        if (existing.proposalId && proposalId && existing.proposalId.toLowerCase() !== proposalId.toLowerCase()) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: 'Order already redeemed',
            message: 'This payment was already used to unlock a different LoveLetter.',
          });
        }
        return res.status(200).json({
          success: true,
          verified: true,
          order_id: existing.orderId,
          orderId: existing.orderId,
          payment_id: existing.paymentId,
          paymentId: existing.paymentId,
          proposalId: existing.proposalId,
          slug: existing.slug,
          amount: 6900,
          message: 'Payment verified (idempotent).',
        });
      }
    }

    // 1. Genuine HMAC SHA-256 Signature Verification: order_id + "|" + payment_id
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    const signatureMatch =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!signatureMatch) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Signature mismatch',
        message: 'Payment signature could not be verified. Razorpay signature mismatch.',
      });
    }

    // 2. Validate Order & Amount against Razorpay API
    const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;

    try {
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const orderProposalId = String(orderData?.notes?.proposalId || '').trim();
        const cleanPid = proposalId.toLowerCase();
        const cleanOrderPid = orderProposalId.toLowerCase();

        // Validate proposal association
        if (orderProposalId && proposalId && cleanOrderPid !== cleanPid && !cleanPid.startsWith(cleanOrderPid) && !cleanOrderPid.startsWith(cleanPid)) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: 'Proposal mismatch',
            message: 'This payment order belongs to a different LoveLetter. Each LoveLetter requires its own payment.',
          });
        }

        // Validate amount (6900 paise = ₹69)
        if (orderData.amount && orderData.amount !== 6900) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: 'Invalid payment amount',
            message: `Payment amount of ₹${orderData.amount / 100} does not match the required price of ₹69.`,
          });
        }
      }
    } catch (orderCheckErr) {
      console.warn('Note: Razorpay live order lookup notice:', orderCheckErr);
    }

    const slug = (body.slug || '').trim() || undefined;

    // 3. Record verified payment in store
    if (proposalId) {
      recordVerifiedPayment({
        proposalId,
        orderId,
        paymentId,
        slug,
        verifiedAt: Date.now(),
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      order_id: orderId,
      orderId,
      payment_id: paymentId,
      paymentId,
      proposalId,
      slug,
      amount: 6900,
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
