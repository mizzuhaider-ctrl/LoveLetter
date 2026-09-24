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
import {
  PAYMENT_CONFIG as SHARED_PAYMENT_CONFIG,
  getDisplayPrice,
  getOrderAmountPaise,
} from './src/config/payment';

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

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID?.trim();
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();
const isRazorpayConfigured = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

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
  res.json({
    freeTestMode: FREE_TEST_MODE,
    isConfigured: FREE_TEST_MODE ? true : isRazorpayConfigured,
    gateway: FREE_TEST_MODE ? 'simulator' : 'razorpay',
    keyId: RAZORPAY_KEY_ID || '',
    currency: PAYMENT_CONFIG.currency,
    price: PAYMENT_CONFIG.displayPrice, // ₹0 in test mode, ₹99 in production
    displayPrice: PAYMENT_CONFIG.displayPrice,
    testMode: PAYMENT_TEST_MODE,
    simulatedTestAmount: PAYMENT_TEST_MODE ? (TEST_PAYMENT_AMOUNT / 100) : 0, // ₹1 test amount
    amountInPaise: PAYMENT_CONFIG.amountInPaise,
    planName: PAYMENT_CONFIG.planName,
  });
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

// Razorpay Create Order API
app.post('/api/payment/create-order', async (req: Request, res: Response) => {
  try {
    if (!isRazorpayConfigured) {
      return res.status(400).json({
        success: false,
        error: 'Payment setup required',
        message: 'Payment setup required. Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured.',
      });
    }

    const { proposalId, yourName } = req.body || {};

    // Razorpay amount is calculated server-side in paise (never trust frontend amount)
    const amountInPaise = PAYMENT_CONFIG.amountInPaise;

    // Sanitized receipt identifier (max 40 chars)
    const sanitizedId = (proposalId || 'love').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10);
    const receipt = `rcpt_${sanitizedId}_${Date.now().toString().slice(-6)}`;

    const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;

    const orderPayload = {
      amount: amountInPaise,
      currency: PAYMENT_CONFIG.currency,
      receipt,
      notes: {
        proposalId: (proposalId || '').slice(0, 40),
        creator: (yourName || 'Romantic Creator').trim().slice(0, 40),
        plan: PAYMENT_CONFIG.planName,
        testMode: String(PAYMENT_TEST_MODE),
      },
    };

    const response = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      console.warn('Razorpay order creation error:', data?.error?.description || data?.message || response.statusText);
      return res.status(response.status || 400).json({
        success: false,
        error: data?.error?.description || data?.message || 'Failed to create Razorpay order',
        message: data?.error?.description || 'Unable to generate Razorpay order.',
      });
    }

    return res.json({
      success: true,
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: RAZORPAY_KEY_ID,
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
});

// Razorpay Payment Verification API (Backend HMAC SHA256 signature check & Direct API verification)
app.post('/api/payment/verify-payment', async (req: Request, res: Response) => {
  try {
    if (!isRazorpayConfigured) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Payment setup required',
        message: 'Payment setup required. Razorpay credentials are not configured.',
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId: legacyOrderId,
      paymentId: legacyPaymentId,
      signature: legacySignature,
    } = req.body || {};

    const orderId = razorpay_order_id || legacyOrderId;
    const paymentId = razorpay_payment_id || legacyPaymentId;
    const signature = razorpay_signature || legacySignature;

    if (!orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing order details',
        message: 'Razorpay order ID and payment ID are required to verify payment.',
      });
    }

    // Check if already verified in this server instance
    if (verifiedOrders.has(orderId)) {
      const cached = verifiedOrders.get(orderId)!;
      return res.json({
        success: true,
        verified: true,
        orderId,
        paymentId: cached.paymentId,
        message: 'Payment already verified.',
      });
    }

    // 1. HMAC SHA-256 Signature Verification (Razorpay Official Standard: order_id + "|" + payment_id)
    let signatureVerified = false;
    if (signature && RAZORPAY_KEY_SECRET) {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', RAZORPAY_KEY_SECRET)
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

    if (!signatureVerified) {
      console.warn('Razorpay signature mismatch for order:', orderId);
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Invalid signature',
        message: 'Payment verification failed. Razorpay signature mismatch.',
      });
    }

    // 2. Direct API Check against Razorpay Server for double authorization
    const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
    const paymentRes = await fetch(`${RAZORPAY_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!paymentRes.ok) {
      console.warn('Could not fetch payment from Razorpay API:', paymentRes.status);
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Payment lookup failed',
        message: 'Could not verify payment with Razorpay servers.',
      });
    }

    const paymentData = await paymentRes.json();
    const isPaymentCaptured = paymentData.status === 'captured' || paymentData.status === 'authorized';
    const matchesOrder = paymentData.order_id === orderId;

    // Strict Backend Check: ONLY unlock when HMAC signature is verified AND payment belongs to this order AND status is captured/authorized
    if (signatureVerified && isPaymentCaptured && matchesOrder) {
      verifiedOrders.set(orderId, {
        orderId,
        paymentId,
        verifiedAt: Date.now(),
      });

      return res.json({
        success: true,
        verified: true,
        orderId,
        paymentId,
        amount: paymentData.amount,
        status: paymentData.status,
      });
    }

    // If verification failed or payment was not captured/authorized: DO NOT UNLOCK
    return res.status(200).json({
      success: false,
      verified: false,
      error: 'Payment verification failed',
      message: 'Payment was not captured or signature could not be verified. Link cannot be unlocked.',
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
});

// -------------------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSETS
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
