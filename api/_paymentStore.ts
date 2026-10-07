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
  } catch (err) {
    // Graceful fallback to memory store
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
  } catch (err) {
    // In-memory persistence is preserved
  }
}

export function recordOrder(proposalId: string, orderId: string): void {
  if (!proposalId || !orderId) return;
  loadStore();
  const cleanProposalId = proposalId.trim();
  const cleanOrderId = orderId.trim();

  const record: OrderRecord = {
    orderId: cleanOrderId,
    proposalId: cleanProposalId,
    createdAt: Date.now(),
  };

  memoryStore.orders[cleanOrderId] = record;
  memoryStore.proposalOrders[cleanProposalId] = cleanOrderId;
  persistStore();
}

export function recordVerifiedPayment(payment: PaymentRecord): void {
  if (!payment || !payment.proposalId || !payment.orderId) return;
  loadStore();
  const cleanProposalId = payment.proposalId.trim();
  const cleanOrderId = payment.orderId.trim();

  const cleanPayment: PaymentRecord = {
    ...payment,
    proposalId: cleanProposalId,
    orderId: cleanOrderId,
    verifiedAt: payment.verifiedAt || Date.now(),
  };

  memoryStore.verified[cleanProposalId] = cleanPayment;
  memoryStore.verifiedByOrder[cleanOrderId] = cleanPayment;
  persistStore();
}

export function getVerifiedPayment(proposalId: string): PaymentRecord | null {
  if (!proposalId) return null;
  loadStore();
  const cleanProposalId = proposalId.trim();
  return memoryStore.verified[cleanProposalId] || null;
}

export function getVerifiedPaymentByOrderId(orderId: string): PaymentRecord | null {
  if (!orderId) return null;
  loadStore();
  const cleanOrderId = orderId.trim();
  return memoryStore.verifiedByOrder[cleanOrderId] || null;
}

export function getOrderIdForProposal(proposalId: string): string | null {
  if (!proposalId) return null;
  loadStore();
  const cleanProposalId = proposalId.trim();
  return memoryStore.proposalOrders[cleanProposalId] || null;
}

export function getProposalIdForOrder(orderId: string): string | null {
  if (!orderId) return null;
  loadStore();
  const cleanOrderId = orderId.trim();
  return memoryStore.orders[cleanOrderId]?.proposalId || null;
}
