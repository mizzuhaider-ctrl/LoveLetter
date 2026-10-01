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
  orders: Record<string, OrderRecord>; // orderId -> OrderRecord
  proposalOrders: Record<string, string>; // proposalId -> latest orderId
  verified: Record<string, PaymentRecord>; // proposalId -> PaymentRecord
  verifiedByOrder: Record<string, PaymentRecord>; // orderId -> PaymentRecord
}

// In-memory cache
const memoryStore: StoreData = {
  orders: {},
  proposalOrders: {},
  verified: {},
  verifiedByOrder: {},
};

// Choose writable path: .data or /tmp/.data
function getDataFilePath(): string {
  try {
    const localDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'verified_payments.json');
  } catch {
    const tmpDir = path.resolve('/tmp', '.loveletter_data');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return path.join(tmpDir, 'verified_payments.json');
  }
}

let isLoaded = false;

function loadStore(): StoreData {
  if (isLoaded) return memoryStore;
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
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
    console.warn('Note: Could not read payment store from disk:', err);
  }
  isLoaded = true;
  return memoryStore;
}

function persistStore(): void {
  try {
    const filePath = getDataFilePath();
    const data = JSON.stringify(memoryStore, null, 2);
    fs.writeFileSync(filePath, data, 'utf8');
  } catch (err) {
    console.warn('Note: Could not write payment store to disk:', err);
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
