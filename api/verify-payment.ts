import crypto from 'crypto';
import {
  recordVerifiedPayment,
  getVerifiedPayment,
  getVerifiedPaymentByOrderId,
} from './paymentStore.js';

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
    if (testKeySecret) {
      activeKeySecret = testKeySecret;
      activeKeyId = testKeyId || liveKeyId;
    } else if (liveKeyId?.startsWith('rzp_test_') && liveKeySecret) {
      activeKeySecret = liveKeySecret;
      activeKeyId = liveKeyId;
    }
  }

  if (!activeKeySecret) {
    console.error('[Diagnostic] verify-payment missing Razorpay credentials in environment.');
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
      console.warn('[Diagnostic] verify-payment called with missing required fields.');
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing required fields',
        message: 'order_id, payment_id, and signature are required to verify payment.',
      });
    }

    const expectedAmount = IS_TEST_MODE ? 100 : 6900;

    // Idempotent check: if already verified in persistent store
    if (proposalId) {
      const existing = getVerifiedPayment(proposalId) || getVerifiedPaymentByOrderId(orderId);
      if (existing) {
        if (existing.proposalId && proposalId && existing.proposalId.toLowerCase() !== proposalId.toLowerCase()) {
          console.warn('[Diagnostic] verify-payment duplicate redemption attempt for different proposal.');
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
          amount: expectedAmount,
          message: 'Payment verified (idempotent).',
        });
      }
    }

    // 1. Genuine HMAC SHA-256 Signature Verification: order_id + "|" + payment_id
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', activeKeySecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    const signatureMatch =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!signatureMatch) {
      console.warn('[Diagnostic] verify-payment HMAC SHA-256 signature mismatch.');
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Signature mismatch',
        message: 'Payment signature could not be verified. Razorpay signature mismatch.',
      });
    }

    // 2. Validate Order & Amount against Razorpay API if credentials allow
    if (activeKeyId && activeKeySecret) {
      const authHeader = `Basic ${Buffer.from(`${activeKeyId}:${activeKeySecret}`).toString('base64')}`;

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
            console.warn('[Diagnostic] verify-payment proposal mismatch against order notes.');
            return res.status(400).json({
              success: false,
              verified: false,
              error: 'Proposal mismatch',
              message: 'This payment order belongs to a different LoveLetter. Each LoveLetter requires its own payment.',
            });
          }

          // Validate amount
          if (orderData.amount && orderData.amount !== expectedAmount) {
            console.warn(`[Diagnostic] verify-payment amount mismatch: ${orderData.amount} != ${expectedAmount}`);
            return res.status(400).json({
              success: false,
              verified: false,
              error: 'Invalid payment amount',
              message: `Payment amount does not match required transaction amount.`,
            });
          }
        }
      } catch (orderCheckErr: any) {
        console.warn('[Diagnostic] Razorpay live order lookup notice:', orderCheckErr?.message || orderCheckErr);
      }
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
      amount: expectedAmount,
      isTestMode: IS_TEST_MODE,
      message: 'Payment signature verified successfully.',
    });
  } catch (error: any) {
    console.error('[Diagnostic] Error in /api/verify-payment handler:', error?.message || error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Verification error',
      message: error?.message || 'Server error while verifying Razorpay signature.',
    });
  }
}
