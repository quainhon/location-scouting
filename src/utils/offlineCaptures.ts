import type { ScoutLocation } from '../types/scout';

export interface OfflinePhoto {
  id: string;
  name: string;
  blob: Blob;
}

export interface OfflineVideo {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
  mime: string;
}

export interface QueuedCapture {
  id: string;
  createdAt: string;
  location: ScoutLocation;
  photos: OfflinePhoto[];
  videos: OfflineVideo[];
}

const DATABASE = 'location-scout-offline';
const STORE = 'captures';
let opening: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Thiết bị chưa hỗ trợ lưu hàng đợi ngoại tuyến.'));
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = undefined; reject(new Error('Không mở được hàng đợi ngoại tuyến trên thiết bị.')); };
    request.onblocked = () => { opening = undefined; reject(new Error('Hãy đóng tab Location Scout khác rồi thử lại.')); };
  });
  return opening;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Không lưu được hàng đợi ngoại tuyến.'));
    transaction.onabort = () => reject(new Error('Không lưu được hàng đợi ngoại tuyến.'));
  });
}

export async function listQueuedCaptures(): Promise<QueuedCapture[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, 'readonly');
  const request = transaction.objectStore(STORE).getAll() as IDBRequest<QueuedCapture[]>;
  const itemsRequest = new Promise<QueuedCapture[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('Không đọc được hàng đợi ngoại tuyến.'));
  });
  const [items] = await Promise.all([itemsRequest, transactionDone(transaction)]);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export async function saveQueuedCapture(capture: QueuedCapture): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(capture);
  await transactionDone(transaction);
}

export async function removeQueuedCapture(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).delete(id);
  await transactionDone(transaction);
}
