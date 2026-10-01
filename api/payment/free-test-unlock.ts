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

  // Free test mode is disabled completely for real production customers
  return res.status(403).json({
    success: false,
    verified: false,
    error: 'Free test mode is disabled',
    message: 'Free test unlock is disabled in production. Please complete the secure Razorpay payment to unlock your page.',
  });
}
