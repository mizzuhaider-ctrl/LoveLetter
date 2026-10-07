import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// =============================================================
// PRICING & RAZORPAY CONFIGURATION (Single source of truth)
// =============================================================
import crypto from 'crypto';
import Razorpay from 'razorpay';
import {
  PAYMENT_CONFIG as SHARED_PAYMENT_CONFIG,
  getDisplayPrice,
  getOrderAmountPaise,
} from './src/config/payment';
import {
  recordOrder,
  recordVerifiedPayment,
  getVerifiedPayment,
  getVerifiedPaymentByOrderId,
  getOrderIdForProposal,
} from './src/server/paymentStore';

/**
 * Server-side payment configuration derived directly from src/config/payment.ts
 * Single source of truth.
 */
export const FREE_TEST_MODE = SHARED_PAYMENT_CONFIG.FREE_TEST_MODE;
export const PAYMENT_TEST_MODE = SHARED_PAYMENT_CONFIG.PAYMENT_TEST_MODE;
export const DISPLAY_PRICE = getDisplayPrice(PAYMENT_TEST_MODE, FREE_TEST_MODE);
export const TEST_PAYMENT_AMOUNT = SHARED_PAYMENT_CONFIG.TEST_PAYMENT_AMOUNT;
export const PRODUCTION_PRICE = SHARED_PAYMENT_CONFIG.PRODUCTION_PRICE;

export const PAYMENT_CONFIG = {
  freeTestMode: FREE_TEST_MODE,
  testMode: PAYMENT_TEST_MODE,
  displayPrice: DISPLAY_PRICE,
  /** Internal amount sent to Razorpay in paise from getOrderAmountPaise() */
  amountInPaise: getOrderAmountPaise(PAYMENT_TEST_MODE),
  currency: SHARED_PAYMENT_CONFIG.currency,
  planName: FREE_TEST_MODE
    ? `${SHARED_PAYMENT_CONFIG.planNameTest} (FREE TEST MODE)`
    : PAYMENT_TEST_MODE
    ? `${SHARED_PAYMENT_CONFIG.planNameTest} (TEST MODE)`
    : SHARED_PAYMENT_CONFIG.planNameProd,
};

const getCleanEnv = (val?: string) => (val ? val.trim().replace(/^["']|["']$/g, '') : undefined);

export const getRazorpayCredentials = () => {
  const keyId = getCleanEnv(process.env.RAZORPAY_KEY_ID);
  const keySecret = getCleanEnv(process.env.RAZORPAY_KEY_SECRET);
  return {
    keyId,
    keySecret,
    isConfigured: Boolean(keyId && keySecret),
  };
};

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

// Server-side cache of verified orders
const verifiedOrders = new Map<string, { orderId: string; paymentId: string; verifiedAt: number; proposalId?: string }>();

// -------------------------------------------------------------
// API ROUTES FIRST
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});



// Razorpay Payment Public Config (Never exposes secret key)
app.get('/api/payment/config', (_req: Request, res: Response) => {
  const { keyId, isConfigured } = getRazorpayCredentials();
  res.json({
    freeTestMode: FREE_TEST_MODE,
    isConfigured: FREE_TEST_MODE ? true : isConfigured,
    gateway: FREE_TEST_MODE ? 'simulator' : 'razorpay',
    keyId: keyId || '',
    currency: PAYMENT_CONFIG.currency,
    price: PAYMENT_CONFIG.displayPrice, // ₹69 in production
    displayPrice: PAYMENT_CONFIG.displayPrice,
    testMode: PAYMENT_TEST_MODE,
    simulatedTestAmount: PAYMENT_TEST_MODE ? (TEST_PAYMENT_AMOUNT / 100) : 0, // ₹1 test amount
    amountInPaise: PAYMENT_CONFIG.amountInPaise,
    planName: PAYMENT_CONFIG.planName,
  });
});

// Persistent Payment Status API: Single source of truth for payment recovery
app.get('/api/payment/status', async (req: Request, res: Response) => {
  try {
    const proposalId = (
      (req.query.proposalId as string) ||
      (req.body?.proposalId as string) ||
      ''
    ).trim();

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing proposal ID',
        message: 'proposalId is required to query payment status.',
      });
    }

    // 1. Check persistent verified store on server
    const verified = getVerifiedPayment(proposalId);
    if (verified) {
      return res.json({
        success: true,
        verified: true,
        proposalId: verified.proposalId,
        orderId: verified.orderId,
        paymentId: verified.paymentId,
        slug: verified.slug,
        verifiedAt: verified.verifiedAt,
        message: 'Payment verified from persistent backend store.',
      });
    }

    // 2. Direct Razorpay check if order exists for this proposal
    const orderId = getOrderIdForProposal(proposalId);
    const { keyId, keySecret, isConfigured } = getRazorpayCredentials();
    if (orderId && isConfigured) {
      try {
        const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
        const paymentsRes = await fetch(`${RAZORPAY_BASE_URL}/orders/${encodeURIComponent(orderId)}/payments`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          const items = paymentsData.items || [];
          const capturedPayment = items.find((p: any) => p.status === 'captured' || p.status === 'authorized');

          if (capturedPayment) {
            const record = {
              proposalId,
              orderId,
              paymentId: capturedPayment.id,
              verifiedAt: Date.now(),
            };
            recordVerifiedPayment(record);

            return res.json({
              success: true,
              verified: true,
              proposalId,
              orderId,
              paymentId: capturedPayment.id,
              verifiedAt: record.verifiedAt,
              message: 'Payment confirmed via Razorpay API.',
            });
          }
        }
      } catch (err) {
        console.warn('Note: Razorpay live order check error:', err);
      }
    }

    return res.json({
      success: true,
      verified: false,
      proposalId,
      message: 'No verified payment found for this LoveLetter.',
    });
  } catch (error: any) {
    console.error('Error fetching payment status:', error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Status lookup failed',
      message: error?.message || 'Could not fetch payment status.',
    });
  }
});

// Free Test Mode Backend Unlock API (Simulation only for development/testing without Razorpay KYC)
app.post('/api/payment/free-test-unlock', async (req: Request, res: Response) => {
  try {
    // Security check: Only allowed if FREE_TEST_MODE is enabled on server
    if (!FREE_TEST_MODE) {
      return res.status(403).json({
        success: false,
        verified: false,
        error: 'Free test mode is disabled',
        message: 'Free test mode is disabled on this server. Please use standard Razorpay checkout.',
      });
    }

    const { proposalId, yourName, recipientName } = req.body || {};
    const randomHex = crypto.randomBytes(4).toString('hex');
    const orderId = `FREE_TEST_${Date.now()}_${randomHex}`;
    const paymentId = `pay_sim_${randomHex}`;

    // Mark test order as verified only through backend cache
    verifiedOrders.set(orderId, {
      orderId,
      paymentId,
      verifiedAt: Date.now(),
      proposalId,
    });

    return res.json({
      success: true,
      verified: true,
      orderId,
      paymentId,
      proposalId: proposalId || '',
      creator: yourName || '',
      recipient: recipientName || '',
      mode: 'FREE_TEST_MODE',
      message: 'FREE TEST MODE — No real payment was made. Test authorization verified.',
    });
  } catch (error: any) {
    console.error('Error in free-test-unlock:', error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Test unlock failed',
      message: 'Could not complete free test authorization.',
    });
  }
});

// Audio Tracks Auto-Detection API (Detects uploaded Hindi MP3 and preserves English)
app.get('/api/audio/detect-tracks', (_req: Request, res: Response) => {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const assetsDir = path.join(publicDir, 'assets');
    const rootDir = process.cwd();

    const englishTrack = '/assets/i-think-they-call-this-love.mp3';
    let hindiTrack = '/assets/Ishq_Wala_Love_smooth_cut.mp3';

    const scanDir = (dir: string, urlPrefix: string) => {
      if (!fs.existsSync(dir)) return [];
      try {
        const files = fs.readdirSync(dir);
        return files
          .filter((f) => /\.(mp3|m4a|wav|aac|ogg)$/i.test(f))
          .map((f) => ({
            name: f,
            url: `${urlPrefix}/${f}`.replace(/\/+/g, '/'),
            fullPath: path.join(dir, f),
          }));
      } catch {
        return [];
      }
    };

    const assetsAudio = scanDir(assetsDir, '/assets');
    const publicAudio = scanDir(publicDir, '');
    const allAudio = [...assetsAudio, ...publicAudio];

    // Priority 1: Filename matches Ishq_Wala_Love (exact user request) or hindi
    const explicitIshq = allAudio.find((item) => /ishq.*wala.*love/i.test(item.name));
    const explicitHindi = allAudio.find((item) => /hindi/i.test(item.name));
    if (explicitIshq) {
      hindiTrack = explicitIshq.url;
    } else if (explicitHindi) {
      hindiTrack = explicitHindi.url;
    } else {
      // Priority 2: Any audio file other than the English love track
      const alternative = allAudio.find(
        (item) => !/i-think-they-call-this-love/i.test(item.name)
      );
      if (alternative) {
        hindiTrack = alternative.url;
      } else {
        // Priority 3: Check if uploaded directly to root directory and copy to assets
        try {
          const rootFiles = fs.readdirSync(rootDir);
          const rootAudio = rootFiles.find(
            (f) =>
              /\.(mp3|m4a|wav|aac|ogg)$/i.test(f) &&
              !/i-think-they-call-this-love/i.test(f)
          );
          if (rootAudio) {
            const target = path.join(assetsDir, rootAudio);
            fs.copyFileSync(path.join(rootDir, rootAudio), target);
            hindiTrack = `/assets/${rootAudio}`;
          }
        } catch {
          // ignore
        }
      }
    }

    res.json({
      success: true,
      english: englishTrack,
      hindi: hindiTrack,
    });
  } catch (err: any) {
    res.json({
      success: true,
      english: '/assets/i-think-they-call-this-love.mp3',
      hindi: '/assets/Ishq_Wala_Love_smooth_cut.mp3',
    });
  }
});

// Razorpay Create Order Handler (POST /api/create-order & POST /api/payment/create-order)
const handleCreateOrder = async (req: Request, res: Response) => {
  try {
    const { keyId, keySecret, isConfigured } = getRazorpayCredentials();

    if (!isConfigured) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Payment setup required. Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in environment.',
      });
    }

    const { proposalId, yourName, currency: reqCurrency, receipt: reqReceipt } = req.body || {};

    // Validate amount: req.body.amount if provided, otherwise default to PAYMENT_CONFIG.amountInPaise
    const rawAmount = req.body?.amount !== undefined ? Number(req.body.amount) : PAYMENT_CONFIG.amountInPaise;

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
    const currency = reqCurrency || PAYMENT_CONFIG.currency || 'INR';

    const orderPayload = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        proposalId: cleanProposalId.slice(0, 40),
        creator: (yourName || 'Romantic Creator').toString().trim().slice(0, 40),
        plan: PAYMENT_CONFIG.planName,
        testMode: String(PAYMENT_TEST_MODE),
      },
    };

    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
    const response = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await response.json();

    if (!response.ok || !orderData.id) {
      const status = response.status === 401 ? 401 : (response.status || 500);
      const desc = orderData?.error?.description || orderData?.message || 'Failed to create Razorpay order';
      return res.status(status).json({
        success: false,
        error: desc,
        message: status === 401
          ? `Razorpay authentication failed: ${desc}. Please verify that your RAZORPAY_KEY_SECRET in .env matches your RAZORPAY_KEY_ID.`
          : `Unable to generate Razorpay order: ${desc}.`,
      });
    }

    // Persist order mapping to proposal ID in server store
    recordOrder(cleanProposalId, orderData.id);

    return res.json({
      success: true,
      order_id: orderData.id,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
      key: keyId,
      planName: PAYMENT_CONFIG.planName,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Order creation failed',
      message: error?.message || 'Server error while contacting Razorpay.',
    });
  }
};

app.post('/api/create-order', handleCreateOrder);
app.post('/api/payment/create-order', handleCreateOrder);

// Razorpay Payment Verification API (POST /api/verify-payment & POST /api/payment/verify-payment)
const handleVerifyPayment = async (req: Request, res: Response) => {
  try {
    const { keyId, keySecret, isConfigured } = getRazorpayCredentials();

    if (!isConfigured) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: 'Authentication failed',
        message: 'Payment setup required. Razorpay credentials are not configured in environment.',
      });
    }

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
    } = req.body || {};

    const orderId = razorpay_order_id || altOrderId || legacyOrderId;
    const paymentId = razorpay_payment_id || altPaymentId || legacyPaymentId;
    const signature = razorpay_signature || altSignature || legacySignature;
    const proposalId = (rawProposalId || '').trim();

    // Validate missing fields: return 400
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing required fields',
        message: 'order_id, payment_id, and signature are required to verify payment.',
      });
    }

    // Check persistent store or memory instance
    if (proposalId) {
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
        return res.json({
          success: true,
          verified: true,
          order_id: existing.orderId,
          orderId: existing.orderId,
          payment_id: existing.paymentId,
          paymentId: existing.paymentId,
          proposalId: existing.proposalId,
          slug: existing.slug,
          message: 'Payment already verified.',
        });
      }
    }

    // 1. HMAC SHA-256 Signature Verification: order_id + "|" + payment_id
    let signatureVerified = false;
    if (signature && keySecret) {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        // Timing-safe buffer comparison to prevent timing attacks
        const expectedBuf = Buffer.from(expectedSignature, 'utf8');
        const incomingBuf = Buffer.from(signature, 'utf8');
        if (expectedBuf.length === incomingBuf.length && crypto.timingSafeEqual(expectedBuf, incomingBuf)) {
          signatureVerified = true;
        }
      } catch (err) {
        console.warn('HMAC calculation error:', err);
      }
    }

    // Signature mismatch: return 400, do NOT mark as paid
    if (!signatureVerified) {
      console.warn('Razorpay signature mismatch for order:', orderId);
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Signature mismatch',
        message: 'Payment verification failed. Razorpay signature mismatch.',
      });
    }

    // 2. Direct API Check against Razorpay Server for double authorization
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

    if (proposalId) {
      try {
        const orderRes = await fetch(`${RAZORPAY_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
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
        console.warn('Order check error:', orderCheckErr);
      }
    }

    let paymentData: any = null;
    try {
      const paymentRes = await fetch(`${RAZORPAY_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (paymentRes.ok) {
        paymentData = await paymentRes.json();
      }
    } catch (payLookupErr) {
      console.warn('Note: Razorpay payment details lookup warning:', payLookupErr);
    }

    // Strict Backend Check: ONLY unlock when HMAC signature is verified
    if (signatureVerified) {
      const slug = (req.body?.slug || '').trim() || undefined;

      verifiedOrders.set(orderId, {
        orderId,
        paymentId,
        verifiedAt: Date.now(),
        proposalId: proposalId || undefined,
      });

      if (proposalId) {
        recordVerifiedPayment({
          proposalId,
          orderId,
          paymentId,
          slug,
          verifiedAt: Date.now(),
        });
      }

      return res.json({
        success: true,
        verified: true,
        order_id: orderId,
        orderId,
        payment_id: paymentId,
        paymentId,
        proposalId,
        slug,
        amount: paymentData?.amount || PAYMENT_CONFIG.amountInPaise,
        status: paymentData?.status || 'captured',
        message: 'Payment signature verified successfully.',
      });
    }

    return res.status(400).json({
      success: false,
      verified: false,
      error: 'Payment verification failed',
      message: 'Signature could not be verified. Link cannot be unlocked.',
    });
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error?.message || error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Verification failed',
      message: error?.message || 'Server error while verifying Razorpay payment.',
    });
  }
};

app.post('/api/verify-payment', handleVerifyPayment);
app.post('/api/payment/verify-payment', handleVerifyPayment);

// -------------------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSETS
// -------------------------------------------------------------
// Long-term cache headers for static public assets (cat gif, mp3 audio, etc.)
app.use('/assets', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
