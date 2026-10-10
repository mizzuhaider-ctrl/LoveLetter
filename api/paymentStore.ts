export interface PaymentRecord {
  proposalId: string;
  orderId: string;
  paymentId: string;
  slug?: string;
  verifiedAt: number;
}

export interface OrderRecord {
  orderId: string;
  proposalId: string;
  createdAt: number;
}

interface StoreData {
  orders: Record<string, OrderRecord>;
  proposalOrders: Record<string, string>;
  verified: Record<string, PaymentRecord>;
  verifiedByOrder: Record<string, PaymentRecord>;
}

// In-memory store attached to globalThis to survive across module reloads in warm lambdas
const globalScope = globalThis as unknown as {
  __loveletter_payment_store?: StoreData;
};

if (!globalScope.__loveletter_payment_store) {
  globalScope.__loveletter_payment_store = {
    orders: {},
    proposalOrders: {},
    verified: {},
    verifiedByOrder: {},
  };
}

const memoryStore: StoreData = globalScope.__loveletter_payment_store;

export function recordOrder(proposalId: string, orderId: string): void {
  try {
    if (!proposalId || !orderId) return;
    const cleanProposalId = String(proposalId).trim();
    const cleanOrderId = String(orderId).trim();

    const record: OrderRecord = {
      orderId: cleanOrderId,
      proposalId: cleanProposalId,
      createdAt: Date.now(),
    };

    memoryStore.orders[cleanOrderId] = record;
    memoryStore.proposalOrders[cleanProposalId] = cleanOrderId;
  } catch {
    // Fail silently, never crash order creation
  }
}

export function recordVerifiedPayment(payment: PaymentRecord): void {
  try {
    if (!payment || !payment.proposalId || !payment.orderId) return;
    const cleanProposalId = String(payment.proposalId).trim();
    const cleanOrderId = String(payment.orderId).trim();

    const cleanPayment: PaymentRecord = {
      ...payment,
      proposalId: cleanProposalId,
      orderId: cleanOrderId,
      verifiedAt: payment.verifiedAt || Date.now(),
    };

    memoryStore.verified[cleanProposalId] = cleanPayment;
    memoryStore.verifiedByOrder[cleanOrderId] = cleanPayment;
  } catch {
    // Fail silently, never crash payment verification
  }
}

export function getVerifiedPayment(proposalId: string): PaymentRecord | null {
  try {
    if (!proposalId) return null;
    const cleanProposalId = String(proposalId).trim();
    return memoryStore.verified[cleanProposalId] || null;
  } catch {
    return null;
  }
}

export function getVerifiedPaymentByOrderId(orderId: string): PaymentRecord | null {
  try {
    if (!orderId) return null;
    const cleanOrderId = String(orderId).trim();
    return memoryStore.verifiedByOrder[cleanOrderId] || null;
  } catch {
    return null;
  }
}

export function getOrderIdForProposal(proposalId: string): string | null {
  try {
    if (!proposalId) return null;
    const cleanProposalId = String(proposalId).trim();
    return memoryStore.proposalOrders[cleanProposalId] || null;
  } catch {
    return null;
  }
}

export function getProposalIdForOrder(orderId: string): string | null {
  try {
    if (!orderId) return null;
    const cleanOrderId = String(orderId).trim();
    return memoryStore.orders[cleanOrderId]?.proposalId || null;
  } catch {
    return null;
  }
}

export default function handler(_req: any, res: any) {
  if (res && typeof res.status === 'function') {
    return res.status(200).json({ status: 'ok', service: 'paymentStore' });
  }
  return { status: 'ok' };
}
