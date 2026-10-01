export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const isConfigured = Boolean(keyId && keySecret);

  return res.status(200).json({
    freeTestMode: false,
    isConfigured: isConfigured,
    keyId: keyId,
    currency: 'INR',
    price: 69,
    displayPrice: 69,
    testMode: false,
    amountInPaise: 6900,
    planName: 'PREMIUM',
  });
}
