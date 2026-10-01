import crypto from 'crypto';
import {
  recordVerifiedPayment,
  getVerifiedPayment,
  getVerifiedPaymentByOrderId,
} from '../../src/server/paymentStore';

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
    const orderId = body.razorpay_order_id || body.orderId;
    const paymentId = body.razorpay_payment_id || body.paymentId;
    const signature = body.razorpay_signature || body.signature;
    const proposalId = (body.proposalId || '').trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing payment verification parameters',
        message: 'Order ID, payment ID, and signature are required.',
      });
    }

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing proposal ID',
        message: 'proposalId is required for payment verification.',
      });
    }

    // Idempotent check: if already verified in persistent store
    const existing = getVerifiedPayment(proposalId) || getVerifiedPaymentByOrderId(orderId);
    if (existing) {
      if (existing.proposalId.toLowerCase() !== proposalId.toLowerCase()) {
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
        orderId: existing.orderId,
        paymentId: existing.paymentId,
        proposalId: existing.proposalId,
        slug: existing.slug,
        message: 'Payment verified (idempotent).',
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

    // Verify that the Razorpay order was indeed created for this exact proposalId
    try {
      const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const orderProposalId = (orderData?.notes?.proposalId || '').trim();
        if (orderProposalId && orderProposalId.toLowerCase() !== proposalId.toLowerCase()) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: 'Proposal mismatch',
            message: 'This payment order belongs to a different LoveLetter. Each LoveLetter requires its own payment.',
          });
        }
      }
    } catch (orderCheckErr) {
      console.warn('Note: order details lookup warning:', orderCheckErr);
    }

    const slug = (body.slug || '').trim() || undefined;

    // Record verified payment in server persistent store
    recordVerifiedPayment({
      proposalId,
      orderId,
      paymentId,
      slug,
      verifiedAt: Date.now(),
    });

    return res.status(200).json({
      success: true,
      verified: true,
      orderId,
      paymentId,
      proposalId,
      slug,
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
