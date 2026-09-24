import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  // Set CORS and response headers
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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { proposalId, yourName, recipientName } = body;

    const randomHex = crypto.randomBytes(4).toString('hex');
    const orderId = `FREE_TEST_${Date.now()}_${randomHex}`;
    const paymentId = `pay_sim_${randomHex}`;

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Test unlock failed',
      message: error?.message || 'Could not complete free test authorization.',
    });
  }
}
