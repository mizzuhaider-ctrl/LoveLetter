import {
  getVerifiedPayment,
  getOrderIdForProposal,
  recordVerifiedPayment,
} from '../paymentStore';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawProposalId = req.query?.proposalId || req.body?.proposalId || '';
    const proposalId = String(rawProposalId).trim();

    const rawOrderId = req.query?.orderId || req.body?.orderId || '';
    const queryOrderId = String(rawOrderId).trim();

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing proposal ID',
        message: 'proposalId is required to check payment status.',
      });
    }

    // 1. Check local persistent store
    const verified = getVerifiedPayment(proposalId);
    if (verified) {
      return res.status(200).json({
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

    // 2. If not verified locally yet, check if there is an active order on Razorpay for this proposal
    const orderId = queryOrderId || getOrderIdForProposal(proposalId);
    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID?.trim();
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (orderId && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      try {
        const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
        const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          const items = paymentsData.items || [];
          const successfulPayment = items.find((p: any) => p.status === 'captured' || p.status === 'authorized');

          if (successfulPayment) {
            const record = {
              proposalId,
              orderId,
              paymentId: successfulPayment.id,
              verifiedAt: Date.now(),
            };
            recordVerifiedPayment(record);

            return res.status(200).json({
              success: true,
              verified: true,
              proposalId,
              orderId,
              paymentId: successfulPayment.id,
              verifiedAt: record.verifiedAt,
              message: 'Payment confirmed via Razorpay API.',
            });
          }
        }
      } catch (checkErr) {
        console.warn('Note: Razorpay live order lookup error:', checkErr);
      }
    }

    // 3. Fallback: If orderId was not cached, query recent Razorpay orders by notes.proposalId
    if (!orderId && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      try {
        const authHeader = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
        const ordersRes = await fetch('https://api.razorpay.com/v1/orders?count=25', {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const items = ordersData.items || [];
          const cleanPid = proposalId.toLowerCase();
          const matchingOrder = items.find((o: any) => {
            const pId = String(o?.notes?.proposalId || '').trim().toLowerCase();
            return pId && (pId === cleanPid || cleanPid.startsWith(pId) || pId.startsWith(cleanPid));
          });

          if (matchingOrder && (matchingOrder.status === 'paid' || (matchingOrder.amount_paid && matchingOrder.amount_paid > 0))) {
            const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(matchingOrder.id)}/payments`, {
              method: 'GET',
              headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            });
            let paymentId = matchingOrder.id;
            if (paymentsRes.ok) {
              const payData = await paymentsRes.json();
              const captured = (payData.items || []).find((p: any) => p.status === 'captured' || p.status === 'authorized');
              if (captured) paymentId = captured.id;
            }

            const record = {
              proposalId,
              orderId: matchingOrder.id,
              paymentId,
              verifiedAt: Date.now(),
            };
            recordVerifiedPayment(record);

            return res.status(200).json({
              success: true,
              verified: true,
              proposalId,
              orderId: matchingOrder.id,
              paymentId,
              verifiedAt: record.verifiedAt,
              message: 'Payment confirmed via Razorpay orders search.',
            });
          }
        }
      } catch (searchErr) {
        console.warn('Note: Razorpay live orders search error:', searchErr);
      }
    }

    // Unpaid or not verified
    return res.status(200).json({
      success: true,
      verified: false,
      proposalId,
      message: 'No verified payment found for this LoveLetter.',
    });
  } catch (error: any) {
    console.error('Payment status lookup error:', error);
    return res.status(200).json({
      success: true,
      verified: false,
      message: 'Could not confirm payment status at this time.',
    });
  }
}
