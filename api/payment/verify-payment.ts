import crypto from 'crypto';
import {
  recordVerifiedPayment,
  getVerifiedPayment,
  getVerifiedPaymentByOrderId,
} from '../paymentStore';

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
      message: 'Payment setup required. Razorpay credentials are not configured.',
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

    const orderId = razorpay_order_id || altOrderId || legacyOrderId;
    const paymentId = razorpay_payment_id || altPaymentId || legacyPaymentId;
    const signature = razorpay_signature || altSignature || legacySignature;
    const proposalId = (rawProposalId || '').trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing required fields',
        message: 'order_id, payment_id, and signature are required to verify payment.',
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
      order_id: orderId,
      orderId,
      payment_id: paymentId,
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
