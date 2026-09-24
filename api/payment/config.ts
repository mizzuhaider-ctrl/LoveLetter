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
    freeTestMode: true,
    isConfigured: true,
    gateway: 'simulator',
    keyId: keyId,
    currency: 'INR',
    price: 0,
    displayPrice: 0,
    testMode: true,
    simulatedTestAmount: 1,
    amountInPaise: 100,
    planName: 'PREMIUM (FREE TEST MODE)',
  });
}
