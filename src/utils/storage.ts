import { LoveProposal } from '../types';

const STORAGE_PREFIX = 'love_page_maker_';
const RECENT_KEY = 'love_page_maker_recent';

// In-memory cache to guarantee persistence across route changes
let memoryRecentProposal: LoveProposal | null = null;
const memoryProposals = new Map<string, LoveProposal>();

// IndexedDB configuration for durable binary/photo storage
const DB_NAME = 'LovePageMakerDB';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistPhotoToIDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save photo to IndexedDB', err);
  }
}

export async function getPhotoFromIDB(key: string): Promise<string | null> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const req = tx.objectStore(PHOTO_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function generatePermanentSlug(_yourName?: string, _recipientName?: string, id?: string): string {
  if (id && id.toLowerCase().startsWith('loveletter-')) {
    const existingId = id.slice(11).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
    if (existingId) return `loveletter-${existingId}`;
  }
  const cleanId = (id || generateUniqueId()).replace(/^loveletter-?/i, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase() || generateUniqueId().slice(0, 4);
  return `loveletter-${cleanId}`;
}

const PAID_PREFIX = 'love_page_paid_';
const LAST_PAID_KEY = 'love_page_last_paid';
const memoryPaidProposals = new Set<string>();

export function getPaidDetails(proposalId: string): { orderId?: string; paymentId?: string } | null {
  if (!proposalId) return null;
  try {
    const raw = localStorage.getItem(`${PAID_PREFIX}${proposalId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore error
  }
  return null;
}

/**
 * Checks server-side persistent store and Razorpay API directly for verified payment status.
 * Backend remains the authoritative single source of truth.
 */
export async function checkBackendPaymentStatus(proposalId: string, optionalOrderId?: string): Promise<{
  verified: boolean;
  orderId?: string;
  paymentId?: string;
  slug?: string;
}> {
  if (!proposalId) return { verified: false };
  try {
    const paidDetails = getPaidDetails(proposalId);
    const orderIdToQuery = optionalOrderId || paidDetails?.orderId || '';
    const queryParam = orderIdToQuery ? `&orderId=${encodeURIComponent(orderIdToQuery)}` : '';
    const res = await fetch(`/api/payment/status?proposalId=${encodeURIComponent(proposalId)}${queryParam}`);
    if (!res.ok) return { verified: isProposalPaid(proposalId), orderId: paidDetails?.orderId, paymentId: paidDetails?.paymentId };
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      return { verified: isProposalPaid(proposalId), orderId: paidDetails?.orderId, paymentId: paidDetails?.paymentId };
    }
    if (data && data.verified) {
      markProposalPaid(proposalId, {
        orderId: data.orderId,
        paymentId: data.paymentId,
      });
      return {
        verified: true,
        orderId: data.orderId,
        paymentId: data.paymentId,
        slug: data.slug,
      };
    }
  } catch (err) {
    console.warn('Backend payment status check failed:', err);
  }
  return { verified: false };
}

export function setLastPaidProposal(proposal: LoveProposal): void {
  try {
    localStorage.setItem(LAST_PAID_KEY, JSON.stringify(proposal));
  } catch {
    // Ignore error
  }
}

export function getLastPaidProposal(): LoveProposal | null {
  try {
    const raw = localStorage.getItem(LAST_PAID_KEY);
    if (raw) {
      return JSON.parse(raw) as LoveProposal;
    }
  } catch {
    // Ignore error
  }
  return null;
}

/**
 * Removes local paid state for a proposal if backend verification indicates it is unverified or invalid.
 */
export function clearProposalPaid(proposalId: string): void {
  if (!proposalId) return;
  memoryPaidProposals.delete(proposalId);
  try {
    localStorage.removeItem(`${PAID_PREFIX}${proposalId}`);
    const lastPaid = getLastPaidProposal();
    if (lastPaid && lastPaid.id === proposalId) {
      localStorage.removeItem(LAST_PAID_KEY);
    }
  } catch {
    // Ignore error
  }
}

/**
 * Binds a verified payment to a specific LoveLetter proposal ID.
 */
export function markProposalPaid(proposalId: string, details?: { orderId?: string; paymentId?: string }): void {
  if (!proposalId) return;
  memoryPaidProposals.add(proposalId);
  try {
    localStorage.setItem(
      `${PAID_PREFIX}${proposalId}`,
      JSON.stringify({
        proposalId,
        orderId: details?.orderId || '',
        paymentId: details?.paymentId || '',
        verifiedAt: Date.now(),
      })
    );
  } catch (err) {
    console.warn('Unable to persist paid state to localStorage', err);
  }
}

/**
 * Checks whether this exact proposal ID has a verified paid record.
 */
export function isProposalPaid(proposalId: string): boolean {
  if (!proposalId) return false;
  if (memoryPaidProposals.has(proposalId)) return true;
  try {
    const raw = localStorage.getItem(`${PAID_PREFIX}${proposalId}`);
    if (raw) {
      memoryPaidProposals.add(proposalId);
      return true;
    }
  } catch {
    // Ignore error
  }
  return false;
}

export function saveProposal(proposal: LoveProposal): void {
  if (proposal.isUnlocked) {
    markProposalPaid(proposal.id);
  }

  memoryRecentProposal = proposal;
  memoryProposals.set(proposal.id, proposal);
  if (proposal.slug) {
    memoryProposals.set(proposal.slug, proposal);
  }

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${proposal.id}`, JSON.stringify(proposal));
    if (proposal.slug) {
      localStorage.setItem(`${STORAGE_PREFIX}${proposal.slug}`, JSON.stringify(proposal));
    }
    // Prevent love_page_maker_recent from leaking unlocked state to fresh proposals
    const recentDraft = { ...proposal, isUnlocked: false };
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentDraft));
  } catch (err) {
    console.warn('Unable to persist full proposal to localStorage (quota exceeded), offloading photo', err);
    try {
      // In case localStorage is full, save metadata in localStorage and photo in IndexedDB
      const lightweight = { ...proposal, photoUrl: undefined };
      localStorage.setItem(`${STORAGE_PREFIX}${proposal.id}`, JSON.stringify(lightweight));
      if (proposal.slug) {
        localStorage.setItem(`${STORAGE_PREFIX}${proposal.slug}`, JSON.stringify(lightweight));
      }
      const lightweightRecent = { ...lightweight, isUnlocked: false };
      localStorage.setItem(RECENT_KEY, JSON.stringify(lightweightRecent));
    } catch (fallbackErr) {
      console.warn('Fallback localStorage write failed', fallbackErr);
    }
  }

  // Always mirror photo to IndexedDB for guaranteed durable persistence
  if (proposal.photoUrl) {
    persistPhotoToIDB(`photo_${proposal.id}`, proposal.photoUrl).catch(() => {});
    if (proposal.slug) {
      persistPhotoToIDB(`photo_${proposal.slug}`, proposal.photoUrl).catch(() => {});
    }
    persistPhotoToIDB('recent_photo', proposal.photoUrl).catch(() => {});
  }
}

export function getProposal(id: string): LoveProposal | null {
  if (memoryProposals.has(id)) {
    const cached = memoryProposals.get(id)!;
    if (isProposalPaid(cached.id)) {
      cached.isUnlocked = true;
    }
    return cached;
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw) {
      const parsed = JSON.parse(raw) as LoveProposal;
      if (isProposalPaid(parsed.id) || isProposalPaid(id)) {
        parsed.isUnlocked = true;
      }
      memoryProposals.set(id, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('Error reading proposal from localStorage', err);
  }
  return null;
}

export function getRecentProposal(): LoveProposal | null {
  if (memoryRecentProposal) {
    const isPaid = isProposalPaid(memoryRecentProposal.id);
    return { ...memoryRecentProposal, isUnlocked: isPaid };
  }
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LoveProposal;
      // Strictly prevent unlocked state transfer to any new letter
      parsed.isUnlocked = isProposalPaid(parsed.id);
      memoryRecentProposal = parsed;
      return parsed;
    }
  } catch {
    // Ignore error
  }
  return null;
}

/**
 * Helper to safely convert UTF-8 string to Base64 in all browsers
 */
function utf8ToBase64(str: string): string {
  try {
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(str);
      const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
      return btoa(binString);
    }
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      return '';
    }
  }
}

/**
 * Helper to safely convert Base64 back to UTF-8 string in all browsers
 */
function base64ToUtf8(base64: string): string {
  try {
    if (!base64 || typeof base64 !== 'string') return '';
    // Normalize URL-safe base64 (- and _) to standard (+ and /)
    let sanitized = base64.replace(/-/g, '+').replace(/_/g, '/').trim();
    // Add missing padding
    while (sanitized.length % 4 !== 0) {
      sanitized += '=';
    }
    const binString = atob(sanitized);
    if (typeof TextDecoder !== 'undefined') {
      const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(binString));
  } catch {
    return '';
  }
}

/**
 * Packs lightweight proposal data into URL hash or param for universal instant sharing
 * even across different browsers or devices when backend DB is not configured.
 */
export function encodeProposalToPayload(proposal: LoveProposal): string {
  try {
    const payload = {
      i: proposal.id,
      r: proposal.recipientName,
      y: proposal.yourName,
      q: proposal.questionChoice,
      cq: proposal.customQuestion,
      m: proposal.message,
      s: proposal.slug,
      u: proposal.isUnlocked ? 1 : 0,
      ml: proposal.musicLanguage || 'hindi',
      // If photoUrl is small (dataUrl < 100KB) or external url, include it
      p: proposal.photoUrl && proposal.photoUrl.length < 150000 ? proposal.photoUrl : undefined,
    };
    const jsonStr = JSON.stringify(payload);
    const b64 = utf8ToBase64(jsonStr);
    return b64 ? encodeURIComponent(b64) : '';
  } catch (err) {
    console.warn('Encoding error', err);
    return '';
  }
}

export function decodeProposalFromPayload(payloadStr: string): Partial<LoveProposal> | null {
  try {
    if (!payloadStr) return null;
    const cleanB64 = decodeURIComponent(payloadStr);
    const decodedStr = base64ToUtf8(cleanB64);
    if (!decodedStr) return null;
    const parsed = JSON.parse(decodedStr);
    return {
      id: parsed.i,
      recipientName: parsed.r,
      yourName: parsed.y,
      questionChoice: parsed.q,
      customQuestion: parsed.cq || '',
      message: parsed.m || '',
      slug: parsed.s,
      isUnlocked: parsed.u === 1,
      musicLanguage: parsed.ml === 'english' ? 'english' : 'hindi',
      photoUrl: parsed.p,
      createdAt: Date.now(),
    };
  } catch (err) {
    console.warn('Decoding error', err);
    return null;
  }
}

export function generateUniqueId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Public Vercel LoveLetter production domain.
 * Never exposes AI Studio preview, ais-dev, run.app, localhost, or GitHub URLs when sharing externally.
 */
export const VERCEL_PRODUCTION_ORIGIN = 'https://loveletter-blush.vercel.app';

/**
 * Converts any local, preview, or internal URL into the public Vercel LoveLetter URL
 * preserving the exact path, slug, and hash payload.
 */
export function formatVercelShareUrl(urlOrPath: string): string {
  if (!urlOrPath) return VERCEL_PRODUCTION_ORIGIN;
  // If it's already a full URL, replace internal/preview origins with the Vercel domain
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      const parsed = new URL(urlOrPath);
      // If host is an internal preview or non-vercel host (e.g. ais-dev, run.app, localhost, etc.)
      if (!parsed.hostname.endsWith('vercel.app')) {
        return `${VERCEL_PRODUCTION_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return urlOrPath;
    } catch {
      // fallback regex replacement
      return urlOrPath.replace(/^https?:\/\/[^/]+/, VERCEL_PRODUCTION_ORIGIN);
    }
  }

  // If it's a relative path e.g. /love/slug#payload
  const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${VERCEL_PRODUCTION_ORIGIN}${cleanPath}`;
}
