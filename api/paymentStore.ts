import fs from 'fs';
import path from 'path';

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

// Global in-memory cache preserved across warm Lambda invocations
const memoryStore: StoreData = {
  orders: {},
  proposalOrders: {},
  verified: {},
  verifiedByOrder: {},
};

function getDataFilePath(): string | null {
  try {
    const tmpDir = path.resolve('/tmp', '.loveletter_data');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        return null;
      }
    }
    return path.join(tmpDir, 'verified_payments.json');
  } catch {
    return null;
  }
}

let isLoaded = false;

function loadStore(): StoreData {
  if (isLoaded) return memoryStore;
  try {
    const filePath = getDataFilePath();
    if (filePath && fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        memoryStore.orders = parsed.orders || {};
        memoryStore.proposalOrders = parsed.proposalOrders || {};
        memoryStore.verified = parsed.verified || {};
        memoryStore.verifiedByOrder = parsed.verifiedByOrder || {};
      }
    }
  } catch {
    // Graceful in-memory fallback
  }
  isLoaded = true;
  return memoryStore;
}

function persistStore(): void {
  try {
    const filePath = getDataFilePath();
    if (!filePath) return;
    const data = JSON.stringify(memoryStore, null, 2);
    fs.writeFileSync(filePath, data, 'utf8');
  } catch {
    // In-memory persistence is preserved
  }
}

export function recordOrder(proposalId: string, orderId: string): void {
  try {
    if (!proposalId || !orderId) return;
    loadStore();
    const cleanProposalId = String(proposalId).trim();
    const cleanOrderId = String(orderId).trim();

    const record: OrderRecord = {
      orderId: cleanOrderId,
      proposalId: cleanProposalId,
      createdAt: Date.now(),
    };

    memoryStore.orders[cleanOrderId] = record;
    memoryStore.proposalOrders[cleanProposalId] = cleanOrderId;
    persistStore();
  } catch {
    // Fail silently, never crash order creation
  }
}

export function recordVerifiedPayment(payment: PaymentRecord): void {
  try {
    if (!payment || !payment.proposalId || !payment.orderId) return;
    loadStore();
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
    persistStore();
  } catch {
    // Fail silently, never crash payment verification
  }
}

export function getVerifiedPayment(proposalId: string): PaymentRecord | null {
  try {
    if (!proposalId) return null;
    loadStore();
    const cleanProposalId = String(proposalId).trim();
    return memoryStore.verified[cleanProposalId] || null;
  } catch {
    return null;
  }
}

export function getVerifiedPaymentByOrderId(orderId: string): PaymentRecord | null {
  try {
    if (!orderId) return null;
    loadStore();
    const cleanOrderId = String(orderId).trim();
    return memoryStore.verifiedByOrder[cleanOrderId] || null;
  } catch {
    return null;
  }
}

export function getOrderIdForProposal(proposalId: string): string | null {
  try {
    if (!proposalId) return null;
    loadStore();
    const cleanProposalId = String(proposalId).trim();
    return memoryStore.proposalOrders[cleanProposalId] || null;
  } catch {
    return null;
  }
}

export function getProposalIdForOrder(orderId: string): string | null {
  try {
    if (!orderId) return null;
    loadStore();
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
