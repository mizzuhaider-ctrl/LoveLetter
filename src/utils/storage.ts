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

export function generatePermanentSlug(yourName: string, recipientName: string, id: string): string {
  const sanitize = (str: string) =>
    (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'love';

  const sender = sanitize(yourName || 'me');
  const receiver = sanitize(recipientName || 'you');
  const shortId = (id || generateUniqueId()).slice(0, 4).toLowerCase();

  return `${sender}-${receiver}-${shortId}`;
}

export function saveProposal(proposal: LoveProposal): void {
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
    localStorage.setItem(RECENT_KEY, JSON.stringify(proposal));
  } catch (err) {
    console.warn('Unable to persist full proposal to localStorage (quota exceeded), offloading photo', err);
    try {
      // In case localStorage is full, save metadata in localStorage and photo in IndexedDB
      const lightweight = { ...proposal, photoUrl: undefined };
      localStorage.setItem(`${STORAGE_PREFIX}${proposal.id}`, JSON.stringify(lightweight));
      if (proposal.slug) {
        localStorage.setItem(`${STORAGE_PREFIX}${proposal.slug}`, JSON.stringify(lightweight));
      }
      localStorage.setItem(RECENT_KEY, JSON.stringify(lightweight));
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
    return memoryProposals.get(id)!;
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw) {
      const parsed = JSON.parse(raw) as LoveProposal;
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
    return memoryRecentProposal;
  }
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LoveProposal;
      memoryRecentProposal = parsed;
      return parsed;
    }
  } catch {
    // Ignore error
  }
  return null;
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
      // If photoUrl is small (dataUrl < 100KB) or external url, include it
      p: proposal.photoUrl && proposal.photoUrl.length < 150000 ? proposal.photoUrl : undefined,
    };
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  } catch (err) {
    console.warn('Encoding error', err);
    return '';
  }
}

export function decodeProposalFromPayload(payloadStr: string): Partial<LoveProposal> | null {
  try {
    const decodedStr = decodeURIComponent(escape(atob(decodeURIComponent(payloadStr))));
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
